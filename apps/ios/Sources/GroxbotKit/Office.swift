import Foundation

/// Cap'n Web expression helpers for the office Pi host (subscribe / send / stop / events).
public enum CapnWeb {
  public static func push(_ expression: JSONValue) -> JSONValue {
    .array([.string("push"), expression])
  }

  public static func pull(_ importId: Int) -> JSONValue {
    .array([.string("pull"), .int(importId)])
  }

  public static func pipeline(importId: Int, path: [String], arguments: [JSONValue]) -> JSONValue {
    .array([
      .string("pipeline"),
      .int(importId),
      .array(path.map { .string($0) }),
      .array(arguments),
    ])
  }

  public static func exportStub(_ exportId: Int) -> JSONValue {
    .array([.string("export"), .int(exportId)])
  }

  public static func encodeValue(_ value: JSONValue) -> JSONValue {
    switch value {
    case .array(let items):
      return .array([.array(items.map(encodeValue))])
    case .object(let object):
      return .object(object.mapValues(encodeValue))
    default:
      return value
    }
  }

  public static func decodeValue(_ expression: JSONValue) -> JSONValue {
    if case .object(let object) = expression {
      return .object(object.mapValues(decodeValue))
    }
    guard case .array(let parts) = expression else { return expression }
    if parts.count == 1, case .array(let inner) = parts[0] {
      return .array(inner.map(decodeValue))
    }
    guard let tag = parts.first?.string else {
      return .array(parts.map(decodeValue))
    }
    switch tag {
    case "undefined":
      return .null
    case "date":
      return parts.count > 1 ? parts[1] : .null
    case "error":
      return .object([
        "type": parts.count > 1 ? parts[1] : .string("Error"),
        "message": parts.count > 2 ? parts[2] : .string(""),
      ])
    case "export", "import", "pipeline", "promise":
      return expression
    default:
      return .array(parts.map(decodeValue))
    }
  }

  public static func subscribeMessages(subscriberExportId: Int = -1) -> [JSONValue] {
    [
      push(pipeline(importId: 0, path: ["subscribe"], arguments: [exportStub(subscriberExportId)])),
      pull(1),
    ]
  }

  public static func sendMessages(content: String, id: String, targetBotId: String? = nil) -> [JSONValue] {
    var payload: [String: JSONValue] = [
      "content": .string(content),
      "id": .string(id),
    ]
    if let targetBotId, !targetBotId.isEmpty {
      payload["targetBotId"] = .string(targetBotId)
    }
    return [
      push(pipeline(importId: 0, path: ["send"], arguments: [encodeValue(.object(payload))])),
      pull(2),
    ]
  }

  public static func stopMessages() -> [JSONValue] {
    [
      push(pipeline(importId: 0, path: ["stop"], arguments: [])),
      pull(3),
    ]
  }

  public static func parseIncoming(_ message: JSONValue) -> Incoming? {
    guard case .array(let parts) = message, let tag = parts.first?.string else { return nil }
    switch tag {
    case "push" where parts.count > 1:
      return parseCall(parts[1])
    case "resolve":
      return .resolve(exportId: parts.count > 1 ? parts[1].int ?? 0 : 0, value: parts.count > 2 ? parts[2] : .null)
    case "reject":
      let err = parts.count > 2 ? decodeValue(parts[2]) : .null
      return .reject(exportId: parts.count > 1 ? parts[1].int ?? 0 : 0, error: err)
    case "abort":
      return .abort(parts.count > 1 ? decodeValue(parts[1]) : .null)
    default:
      return nil
    }
  }

  public static func parseCall(_ expression: JSONValue) -> Incoming? {
    guard case .array(let parts) = expression, let tag = parts.first?.string else { return nil }
    guard tag == "pipeline" || tag == "import", parts.count >= 3 else { return nil }
    let importId = parts[1].int ?? 0
    let path = parts[2].array?.compactMap(\.string) ?? []
    let args = parts.count > 3 ? (parts[3].array ?? []) : []
    return .call(importId: importId, path: path, arguments: args.map(decodeValue))
  }

  public enum Incoming: Sendable, Equatable {
    case call(importId: Int, path: [String], arguments: [JSONValue])
    case resolve(exportId: Int, value: JSONValue)
    case reject(exportId: Int, error: JSONValue)
    case abort(JSONValue)
  }
}

public protocol OfficeTransport: Sendable {
  func send(_ text: String) async throws
}

/// In-memory office RPC helper: encodes Cap'n Web frames and applies subscriber callbacks.
public final class OfficeSession: @unchecked Sendable {
  public private(set) var outgoing: [JSONValue] = []
  public var messages: [OfficeMessage] = []
  public var status: String = "idle"
  public var error: String = ""
  public var connected = false
  public var generation: Int = 0

  public init() {}

  public func connect() -> [JSONValue] {
    let frames = CapnWeb.subscribeMessages()
    outgoing.append(contentsOf: frames)
    return frames
  }

  public func send(content: String, id: String, targetBotId: String? = nil) -> [JSONValue] {
    let optimistic = OfficeMessage(id: id, role: "user", text: content)
    if !messages.contains(where: { $0.id == id }) {
      messages.append(optimistic)
    }
    status = status == "streaming" ? "streaming" : "submitted"
    let frames = CapnWeb.sendMessages(content: content, id: id, targetBotId: targetBotId)
    outgoing.append(contentsOf: frames)
    return frames
  }

  public func stop() -> [JSONValue] {
    let frames = CapnWeb.stopMessages()
    outgoing.append(contentsOf: frames)
    return frames
  }

  public func apply(raw: JSONValue) {
    guard let incoming = CapnWeb.parseIncoming(raw) else { return }
    switch incoming {
    case .call(_, let path, let arguments):
      handle(path: path, arguments: arguments)
    case .resolve:
      connected = true
    case .reject(_, let error):
      self.error = error["message"]?.string ?? error.description
      status = "error"
    case .abort(let error):
      self.error = error["message"]?.string ?? error.description
      connected = false
    }
  }

  public func apply(text: String) {
    guard let json = try? JSONValue.parse(text) else { return }
    apply(raw: json)
  }

  private func handle(path: [String], arguments: [JSONValue]) {
    switch path.first {
    case "streamGeneration":
      generation = arguments.first?.int ?? generation
    case "status":
      if let next = arguments.first?.string { status = next }
    case "error":
      error = arguments.first?.string ?? ""
      status = "error"
    case "event":
      applyEvent(arguments.first ?? .null)
    default:
      break
    }
  }

  private func applyEvent(_ raw: JSONValue) {
    if let snapshot = OfficeSnapshot.parse(raw) ?? OfficeSnapshot.parse(raw["snapshot"] ?? .null) {
      messages = snapshot.messages
      if snapshot.status == "running" { status = "streaming" }
      else if snapshot.status == "failed" { status = "error" }
      else { status = "idle" }
      if let lastError = snapshot.lastError { error = lastError }
      return
    }
    if let event = OfficeEvent.parse(raw) {
      applyClientEvent(event)
    }
  }
}

public struct OfficeMessage: Sendable, Equatable, Identifiable {
  public var id: String
  public var role: String
  public var text: String

  public init(id: String, role: String, text: String) {
    self.id = id
    self.role = role
    self.text = text
  }
}

public struct OfficeSnapshot: Sendable, Equatable {
  public var id: String
  public var status: String
  public var messages: [OfficeMessage]
  public var lastError: String?

  public static func parse(_ json: JSONValue) -> OfficeSnapshot? {
    let meta = json["metadata"] ?? .null
    let id = meta["id"]?.string ?? ""
    let status = meta["status"]?.string ?? ""
    if id.isEmpty { return nil }
    if status != "idle" && status != "running" && status != "failed" { return nil }
    return OfficeSnapshot(
      id: id,
      status: status,
      messages: OfficeMessage.parseList(json["messages"] ?? .array([])),
      lastError: json["lastError"]?.string
    )
  }
}

public struct OfficeEvent: Sendable, Equatable {
  public var threadId: String
  public var seq: Int
  public var type: String
  public var raw: JSONValue

  public static func parse(_ json: JSONValue) -> OfficeEvent? {
    guard let threadId = json["threadId"]?.string, !threadId.isEmpty,
      let seq = json["seq"]?.int, seq >= 0,
      let type = json["type"]?.string, !type.isEmpty
    else { return nil }
    return OfficeEvent(threadId: threadId, seq: seq, type: type, raw: json)
  }
}

extension OfficeMessage {
  public static func parseList(_ json: JSONValue) -> [OfficeMessage] {
    (json.array ?? []).compactMap(parse)
  }

  public static func parse(_ json: JSONValue) -> OfficeMessage? {
    let message = json["message"] ?? json
    let role = message["role"]?.string ?? ""
    if role.isEmpty { return nil }
    let id = json["id"]?.string ?? message["id"]?.string ?? UUID().uuidString
    return OfficeMessage(id: id, role: role, text: extractText(message["content"] ?? .null))
  }

  public static func extractText(_ content: JSONValue) -> String {
    if let text = content.string { return text.trimmingCharacters(in: .whitespacesAndNewlines) }
    guard let parts = content.array else { return "" }
    return parts.compactMap { part in
      if part["type"]?.string == "text" { return part["text"]?.string }
      return nil
    }
    .joined()
    .trimmingCharacters(in: .whitespacesAndNewlines)
  }
}

extension OfficeSession {
  public func applyClientEvent(_ event: OfficeEvent) {
    switch event.type {
    case "snapshot":
      if let snapshot = OfficeSnapshot.parse(event.raw["snapshot"] ?? .null) {
        messages = snapshot.messages
      }
    case "turn_start", "submitted":
      status = "submitted"
    case "turn_end", "idle":
      status = "idle"
    case "text_delta", "assistant_delta":
      let delta = event.raw["text"]?.string ?? event.raw["delta"]?.string ?? ""
      if !delta.isEmpty {
        if let index = messages.lastIndex(where: { $0.role == "assistant" }) {
          messages[index].text += delta
        } else {
          messages.append(OfficeMessage(id: "live", role: "assistant", text: delta))
        }
      }
      status = "streaming"
    default:
      if let snapshot = OfficeSnapshot.parse(event.raw["snapshot"] ?? .null) {
        messages = snapshot.messages
      }
    }
  }
}
