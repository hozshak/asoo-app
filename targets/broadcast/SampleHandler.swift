// Einstieg der Erweiterung „Bildschirm teilen“: iOS ruft sie auf, wenn man im Übertragungs-Fenster „Asoo“ wählt.
// Sie verbindet sich mit der App (SocketConnection) und schickt bis zu 30 Bilder pro Sekunde hinüber (nach der Uhr,
// nicht „jedes zweite Bild“ – iOS liefert je nach Gerät 30 oder 60 Bilder, das ergab oft nur ≈ 15 und ruckelte).
// Ist die App mit dem letzten Bild noch beschäftigt, lässt SampleUploader das neue aus.
// Nach dem Vorbild der Bildschirm-Teilen-Erweiterung von Jitsi (jitsi-meet-sdk-samples, Apache-2.0).
import ReplayKit

private enum Constants {
  static let appGroupIdentifier = "group.de.feierabendcode.asoo"
}

class SampleHandler: RPBroadcastSampleHandler {
  private var clientConnection: SocketConnection?
  private var uploader: SampleUploader?
  private var lastSent: TimeInterval = 0

  var socketFilePath: String {
    let sharedContainer = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: Constants.appGroupIdentifier)
    return sharedContainer?.appendingPathComponent("rtc_SSFD").path ?? ""
  }

  override init() {
    super.init()
    if let connection = SocketConnection(filePath: socketFilePath) {
      clientConnection = connection
      setupConnection()
      uploader = SampleUploader(connection: connection)
    }
  }

  override func broadcastStarted(withSetupInfo setupInfo: [String: NSObject]?) {
    lastSent = 0
    openConnection()
  }

  override func broadcastPaused() {}
  override func broadcastResumed() {}

  override func broadcastFinished() {
    clientConnection?.close()
  }

  override func processSampleBuffer(_ sampleBuffer: CMSampleBuffer, with sampleBufferType: RPSampleBufferType) {
    switch sampleBufferType {
    case .video:
      let now = ProcessInfo.processInfo.systemUptime
      if now - lastSent >= 1.0 / 31.0 {
        if uploader?.send(sample: sampleBuffer) == true {
          lastSent = now
        }
      }
    default:
      break
    }
  }
}

private extension SampleHandler {
  func setupConnection() {
    clientConnection?.didClose = { [weak self] error in
      if let error = error {
        self?.finishBroadcastWithError(error)
      } else {
        // Die App hat das Teilen beendet (oder wurde geschlossen) – mit einer verständlichen Meldung aufhören
        let stopped = NSError(domain: RPRecordingErrorDomain, code: 10001, userInfo: [NSLocalizedDescriptionKey: "Bildschirm teilen wurde beendet."])
        self?.finishBroadcastWithError(stopped)
      }
    }
  }

  func openConnection() {
    // Die App öffnet die Socket-Datei erst, wenn „Bildschirm teilen“ gestartet ist – bis dahin alle 0,1 s neu versuchen
    let queue = DispatchQueue(label: "de.feierabendcode.asoo.broadcast.connectTimer")
    let timer = DispatchSource.makeTimerSource(queue: queue)
    timer.schedule(deadline: .now(), repeating: .milliseconds(100), leeway: .milliseconds(500))
    timer.setEventHandler { [weak self] in
      guard self?.clientConnection?.open() == true else { return }
      timer.cancel()
    }
    timer.resume()
  }
}
