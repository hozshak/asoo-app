// Wert, der von mehreren Threads aus sicher gelesen und gesetzt werden kann.
// Nach dem Vorbild der Bildschirm-Teilen-Erweiterung von Jitsi (jitsi-meet-sdk-samples, Apache-2.0).
import Foundation

@propertyWrapper
struct Atomic<Value> {
  private var value: Value
  private let lock = NSLock()

  init(wrappedValue value: Value) {
    self.value = value
  }

  var wrappedValue: Value {
    get { load() }
    set { store(newValue: newValue) }
  }

  func load() -> Value {
    lock.lock()
    defer { lock.unlock() }
    return value
  }

  mutating func store(newValue: Value) {
    lock.lock()
    defer { lock.unlock() }
    value = newValue
  }
}
