// Eingehende Anrufe wie am Telefon: CallKit (Apples Anruf-Bildschirm, auch gesperrt und bei geschlossener App) und
// PushKit (Anruf-Push, weckt die App). Der Server schickt den Anruf-Push direkt an Apple (zuno-app/src/worker.js,
// ringVoip); kommt der Anruf über die offene Verbindung, meldet ihn die App über reportIncoming – dieselbe Kennung
// (UUID) sorgt dafür, dass es nur einmal klingelt.
// Ab iOS 13 muss jeder Anruf-Push sofort als Anruf gemeldet werden, sonst beendet iOS die App – deshalb passiert das
// hier im nativen Teil, bevor JavaScript überhaupt läuft.
import ExpoModulesCore
import CallKit
import PushKit
import AVFoundation
import UIKit

final class TolobbyCallCenter: NSObject, PKPushRegistryDelegate, CXProviderDelegate {
  static let shared = TolobbyCallCenter()

  let provider: CXProvider
  private var registry: PKPushRegistry?
  private(set) var voipToken: String = ""
  /// laufende Anrufe: UUID → Angaben (dm, from, name, answered)
  private var calls: [UUID: [String: Any]] = [:]
  private var timeouts: [UUID: DispatchWorkItem] = [:]
  /// Ereignisse, bis JavaScript zuhört (z. B. „angenommen“ bei kaltem Start aus dem Sperrbildschirm)
  private var pending: [[String: Any]] = []
  weak var module: TolobbyCallModule?
  var listening = false

  override init() {
    let cfg = CXProviderConfiguration()
    cfg.supportsVideo = true
    cfg.maximumCallGroups = 1
    cfg.maximumCallsPerCallGroup = 1
    cfg.supportedHandleTypes = [.generic]
    cfg.includesCallsInRecents = false
    if Bundle.main.url(forResource: "ring_puls", withExtension: "wav") != nil {
      cfg.ringtoneSound = "ring_puls.wav"
    }
    provider = CXProvider(configuration: cfg)
    super.init()
    provider.setDelegate(self, queue: nil)
  }

  /// Klingelton von Apples Anruf-Bildschirm umstellen (Datei im App-Paket, z. B. ring_glocken.wav)
  func setRingtone(_ file: String) {
    let parts = file.split(separator: ".")
    guard parts.count == 2, Bundle.main.url(forResource: String(parts[0]), withExtension: String(parts[1])) != nil else { return }
    let cfg = provider.configuration
    cfg.ringtoneSound = file
    provider.configuration = cfg
  }

  func startPushKit() {
    if registry != nil { return }
    let r = PKPushRegistry(queue: DispatchQueue.main)
    r.delegate = self
    r.desiredPushTypes = [.voIP]
    registry = r
  }

  // MARK: Ereignisse an JavaScript

  func emit(_ body: [String: Any]) {
    DispatchQueue.main.async {
      if self.listening, let m = self.module {
        m.sendEvent("onCall", body)
      } else {
        self.pending.append(body)
        if self.pending.count > 30 { self.pending.removeFirst() }
      }
    }
  }

  func flush() {
    DispatchQueue.main.async {
      guard self.listening, let m = self.module else { return }
      let list = self.pending
      self.pending.removeAll()
      for e in list { m.sendEvent("onCall", e) }
    }
  }

  func active() -> [[String: Any]] {
    var out: [[String: Any]] = []
    for (id, info) in calls {
      var o = info
      o["id"] = id.uuidString
      out.append(o)
    }
    return out
  }

  // MARK: PushKit

  func pushRegistry(_ registry: PKPushRegistry, didUpdate pushCredentials: PKPushCredentials, for type: PKPushType) {
    let tok = pushCredentials.token.map { String(format: "%02x", $0) }.joined()
    voipToken = tok
    emit(["type": "token", "token": tok])
  }

  func pushRegistry(_ registry: PKPushRegistry, didInvalidatePushTokenFor type: PKPushType) {
    voipToken = ""
    emit(["type": "token", "token": ""])
  }

  func pushRegistry(_ registry: PKPushRegistry, didReceiveIncomingPushWith payload: PKPushPayload, for type: PKPushType, completion: @escaping () -> Void) {
    let d = payload.dictionaryPayload
    let uuid = (d["id"] as? String).flatMap { UUID(uuidString: $0) } ?? UUID()
    report(
      uuid: uuid,
      dm: d["dm"] as? String ?? "",
      from: d["from"] as? String ?? "",
      name: d["name"] as? String ?? "ToLobby",
      video: d["video"] as? Bool ?? false,
      done: completion
    )
  }

  // MARK: Anruf melden / beenden

  /// Meldet den Anruf bei iOS (klingelt). Gibt es ihn schon (gleiche UUID), passiert nichts weiter.
  func report(uuid: UUID, dm: String, from: String, name: String, video: Bool, done: (() -> Void)? = nil) {
    let upd = CXCallUpdate()
    upd.remoteHandle = CXHandle(type: .generic, value: from.isEmpty ? dm : from)
    upd.localizedCallerName = name
    upd.hasVideo = video
    upd.supportsHolding = false
    upd.supportsGrouping = false
    upd.supportsUngrouping = false
    upd.supportsDTMF = false
    // Immer melden – auch wenn die UUID schon klingelt (iOS verlangt für jeden Anruf-Push eine Meldung)
    provider.reportNewIncomingCall(with: uuid, update: upd) { error in
      DispatchQueue.main.async {
        if error == nil {
          self.calls[uuid] = ["dm": dm, "from": from, "name": name, "answered": false]
          self.emit(["type": "incoming", "id": uuid.uuidString, "dm": dm, "from": from, "name": name])
          // Niemand nimmt ab: nach 45 Sekunden aufhören zu klingeln
          let w = DispatchWorkItem { [weak self] in self?.end(uuid, reason: .unanswered) }
          self.timeouts[uuid] = w
          DispatchQueue.main.asyncAfter(deadline: .now() + 45, execute: w)
        }
        done?()
      }
    }
  }

  /// Anruf von außen beenden (aufgelegt, woanders angenommen, in der App beendet) – ohne Rückmeldung an JavaScript.
  func end(_ uuid: UUID, reason: CXCallEndedReason) {
    timeouts.removeValue(forKey: uuid)?.cancel()
    guard calls.removeValue(forKey: uuid) != nil else { return }
    provider.reportCall(with: uuid, endedAt: Date(), reason: reason)
  }

  func endByDm(_ dm: String, reason: CXCallEndedReason) {
    for (id, info) in calls where (info["dm"] as? String) == dm { end(id, reason: reason) }
  }

  func endAll() {
    for id in Array(calls.keys) { end(id, reason: .remoteEnded) }
  }

  // MARK: CXProviderDelegate

  func providerDidReset(_ provider: CXProvider) {
    for (_, w) in timeouts { w.cancel() }
    timeouts.removeAll()
    calls.removeAll()
    emit(["type": "reset"])
  }

  /// Audio-Sitzung auf „Gespräch“ (Mikrofon + Lautsprecher) stellen, BEVOR iOS sie für den Anruf einschaltet – wie in
  /// Apples Beispiel. Sonst schaltet iOS sie im Sperrbildschirm ohne Mikrofon ein und man hört sich nicht.
  private func configureAudio() {
    let s = AVAudioSession.sharedInstance()
    do { try s.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetooth, .allowBluetoothA2DP]) } catch {}
  }

  func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
    configureAudio()
    let id = action.callUUID
    timeouts.removeValue(forKey: id)?.cancel()
    var info = calls[id] ?? [:]
    info["answered"] = true
    calls[id] = info
    emit(["type": "answer", "id": id.uuidString, "dm": info["dm"] as? String ?? ""])
    action.fulfill()
  }

  func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
    let id = action.callUUID
    timeouts.removeValue(forKey: id)?.cancel()
    let info = calls.removeValue(forKey: id) ?? [:]
    emit(["type": "end", "id": id.uuidString, "dm": info["dm"] as? String ?? "", "answered": info["answered"] as? Bool ?? false])
    action.fulfill()
  }

  func provider(_ provider: CXProvider, perform action: CXSetMutedCallAction) {
    emit(["type": "mute", "id": action.callUUID.uuidString, "muted": action.isMuted])
    action.fulfill()
  }

  func provider(_ provider: CXProvider, perform action: CXSetHeldCallAction) {
    action.fail()
  }

  // Ton: iOS schaltet die Audio-Sitzung für den Anruf frei – JavaScript gibt es an WebRTC weiter
  // (RTCAudioSession.audioSessionDidActivate aus react-native-webrtc)
  func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
    emit(["type": "audio", "active": true])
  }

  func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {
    emit(["type": "audio", "active": false])
  }
}

public class TolobbyCallModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TolobbyCall")

    Events("onCall")

    OnCreate {
      TolobbyCallCenter.shared.module = self
      TolobbyCallCenter.shared.startPushKit()
    }

    OnStartObserving("onCall") {
      TolobbyCallCenter.shared.module = self
      TolobbyCallCenter.shared.listening = true
      TolobbyCallCenter.shared.flush()
    }

    OnStopObserving("onCall") {
      TolobbyCallCenter.shared.listening = false
    }

    Function("setRingtone") { (file: String) in
      DispatchQueue.main.async {
        TolobbyCallCenter.shared.setRingtone(file)
      }
    }

    Function("voipToken") { () -> String in
      return TolobbyCallCenter.shared.voipToken
    }

    Function("activeCalls") { () -> [[String: Any]] in
      return TolobbyCallCenter.shared.active()
    }

    Function("reportIncoming") { (id: String, dm: String, from: String, name: String, video: Bool) in
      guard let uuid = UUID(uuidString: id) else { return }
      DispatchQueue.main.async {
        TolobbyCallCenter.shared.report(uuid: uuid, dm: dm, from: from, name: name, video: video)
      }
    }

    /// reason: "remote" (aufgelegt), "elsewhere" (anderes Gerät), "unanswered", "local" (in der App beendet)
    Function("endCall") { (id: String, reason: String) in
      guard let uuid = UUID(uuidString: id) else { return }
      DispatchQueue.main.async {
        TolobbyCallCenter.shared.end(uuid, reason: TolobbyCallModule.reason(reason))
      }
    }

    Function("endCallsFor") { (dm: String, reason: String) in
      DispatchQueue.main.async {
        TolobbyCallCenter.shared.endByDm(dm, reason: TolobbyCallModule.reason(reason))
      }
    }

  }

  static func reason(_ r: String) -> CXCallEndedReason {
    switch r {
    case "elsewhere": return .answeredElsewhere
    case "declined": return .declinedElsewhere
    case "unanswered": return .unanswered
    case "failed": return .failed
    default: return .remoteEnded
    }
  }
}

public class TolobbyCallAppDelegate: ExpoAppDelegateSubscriber {
  public func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
    // Früh starten: Wird die App von einem Anruf-Push geweckt, muss PushKit bereitstehen
    TolobbyCallCenter.shared.startPushKit()
    return true
  }
}
