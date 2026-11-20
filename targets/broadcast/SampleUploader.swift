// Bilder vom Bildschirm verkleinern, als JPEG verpacken und in Stücken an die App schicken. Format (Kopfzeilen wie bei
// HTTP: Content-Length, Buffer-Width, Buffer-Height, Buffer-Orientation) erwartet react-native-webrtc (ScreenCapturer.m).
// Nach dem Vorbild der Bildschirm-Teilen-Erweiterung von Jitsi (jitsi-meet-sdk-samples, Apache-2.0).
import Foundation
import ReplayKit
import CoreImage
import ImageIO

private enum Constants {
  static let bufferMaxLength = 10240
}

class SampleUploader {
  private static var imageContext = CIContext(options: nil)
  /**
   * Längere Bildseite in Pixeln (0 = volle Auflösung). Die App schreibt die Wahl vor dem Start in die Datei
   * „screen-quality.txt“ im gemeinsamen App-Group-Ordner: „720“, „1080“ oder „max“. Ohne Datei: 1080p.
   */
  static let targetLongSide: Double = {
    guard let dir = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.de.feierabendcode.asoo"),
          let s = try? String(contentsOf: dir.appendingPathComponent("screen-quality.txt"), encoding: .utf8) else { return 1920 }
    switch s.trimmingCharacters(in: .whitespacesAndNewlines) {
    case "720": return 1280
    case "max": return 0
    default: return 1920
    }
  }()

  @Atomic private var isReady = false
  private var connection: SocketConnection

  private var dataToSend: Data?
  private var byteIndex = 0

  private let serialQueue: DispatchQueue

  init(connection: SocketConnection) {
    self.connection = connection
    self.serialQueue = DispatchQueue(label: "de.feierabendcode.asoo.broadcast.sampleUploader")
    setupConnection()
  }

  @discardableResult
  func send(sample buffer: CMSampleBuffer) -> Bool {
    guard isReady else { return false }
    isReady = false
    dataToSend = prepare(sample: buffer)
    byteIndex = 0
    serialQueue.async { [weak self] in
      self?.sendDataChunk()
    }
    return true
  }
}

private extension SampleUploader {
  func setupConnection() {
    connection.didOpen = { [weak self] in
      self?.isReady = true
    }
    connection.streamHasSpaceAvailable = { [weak self] in
      self?.serialQueue.async {
        if let success = self?.sendDataChunk() {
          self?.isReady = !success
        }
      }
    }
  }

  @discardableResult
  func sendDataChunk() -> Bool {
    guard let data = dataToSend else { return false }
    var bytesLeft = data.count - byteIndex
    var length = bytesLeft > Constants.bufferMaxLength ? Constants.bufferMaxLength : bytesLeft
    let start = byteIndex
    length = data[start..<(start + length)].withUnsafeBytes { raw -> Int in
      guard let ptr = raw.bindMemory(to: UInt8.self).baseAddress else { return 0 }
      return connection.writeToStream(buffer: ptr, maxLength: length)
    }
    if length > 0 {
      byteIndex += length
      bytesLeft -= length
      if bytesLeft == 0 {
        dataToSend = nil
        byteIndex = 0
      }
    }
    return true
  }

  func prepare(sample buffer: CMSampleBuffer) -> Data? {
    guard let imageBuffer = CMSampleBufferGetImageBuffer(buffer) else { return nil }
    CVPixelBufferLockBaseAddress(imageBuffer, .readOnly)

    // Auflösung nach Wahl in der App (720p, 1080p oder volle Auflösung): die längere Seite wird höchstens so groß.
    // Volle Auflösung mit etwas stärkerer Kompression – so bleibt die Erweiterung unter Apples Speichergrenze (50 MB).
    let w0 = Double(CVPixelBufferGetWidth(imageBuffer)), h0 = Double(CVPixelBufferGetHeight(imageBuffer))
    let target = SampleUploader.targetLongSide
    let scaleFactor = target > 0 ? max(1.0, max(w0, h0) / target) : 1.0
    let width = Int(w0 / scaleFactor)
    let height = Int(h0 / scaleFactor)
    let orientation = (CMGetAttachment(buffer, key: RPVideoSampleOrientationKey as CFString, attachmentModeOut: nil) as? NSNumber)?.uintValue ?? 0
    let scaleTransform = CGAffineTransform(scaleX: CGFloat(1.0 / scaleFactor), y: CGFloat(1.0 / scaleFactor))
    let bufferData = jpegData(from: imageBuffer, scale: scaleTransform, quality: target > 0 ? 0.72 : 0.6)

    CVPixelBufferUnlockBaseAddress(imageBuffer, .readOnly)

    guard let messageData = bufferData else { return nil }

    let httpResponse = CFHTTPMessageCreateResponse(nil, 200, nil, kCFHTTPVersion1_1).takeRetainedValue()
    CFHTTPMessageSetHeaderFieldValue(httpResponse, "Content-Length" as CFString, String(messageData.count) as CFString)
    CFHTTPMessageSetHeaderFieldValue(httpResponse, "Buffer-Width" as CFString, String(width) as CFString)
    CFHTTPMessageSetHeaderFieldValue(httpResponse, "Buffer-Height" as CFString, String(height) as CFString)
    CFHTTPMessageSetHeaderFieldValue(httpResponse, "Buffer-Orientation" as CFString, String(orientation) as CFString)
    CFHTTPMessageSetBody(httpResponse, messageData as CFData)

    return CFHTTPMessageCopySerializedMessage(httpResponse)?.takeRetainedValue() as Data?
  }

  func jpegData(from buffer: CVPixelBuffer, scale scaleTransform: CGAffineTransform, quality: Double) -> Data? {
    let image = CIImage(cvPixelBuffer: buffer).transformed(by: scaleTransform)
    guard let colorSpace = image.colorSpace else { return nil }
    let options: [CIImageRepresentationOption: Any] = [CIImageRepresentationOption(rawValue: kCGImageDestinationLossyCompressionQuality as String): quality]
    return SampleUploader.imageContext.jpegRepresentation(of: image, colorSpace: colorSpace, options: options)
  }
}
