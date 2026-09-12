import Foundation

/// Cap'n Web expression helpers for the office Pi host (subscribe / send / stop / events).
public enum CapnWeb {
  public static func push(_ expression: JSONValue) -> JSONValue {
    .array([.string("push"), expression])
  }

  public static func pull(_ importId: Int) -> JSONValue {
    .array([.string("pull"), .int(importId)])
  }

  /// Void result for an incoming `pull` (server is awaiting a subscriber callback).
  public static func resolveUndefined(_ exportId: Int) -> JSONValue {
    .array([.string("resolve"), .int(exportId), .array([.string("undefined")])])
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

  public static func subscribeMessages(
    subscriberExportId: Int = -1,
    pullId: Int = 1
  ) -> [JSONValue] {
    [
      push(pipeline(importId: 0, path: ["subscribe"], arguments: [exportStub(subscriberExportId)])),
      pull(pullId),
    ]
  }

  public static func sendMessages(
    content: String,
    id: String,
    targetBotId: String? = nil,
    pullId: Int = 2
  ) -> [JSONValue] {
    var payload: [String: JSONValue] = [
      "content": .string(content),
      "id": .string(id),
    ]
    if let targetBotId, !targetBotId.isEmpty {
      payload["targetBotId"] = .string(targetBotId)
    }
    return [
      push(pipeline(importId: 0, path: ["send"], arguments: [encodeValue(.object(payload))])),
      pull(pullId),
    ]
  }

  public static func stopMessages(pullId: Int = 3) -> [JSONValue] {
    [
      push(pipeline(importId: 0, path: ["stop"], arguments: [])),
      pull(pullId),
    ]
  }

  public static func answerAskMessages(
    toolCallId: String,
    answers: JSONValue,
    pullId: Int
  ) -> [JSONValue] {
    [
      push(
        pipeline(
          importId: 0,
          path: ["answerAsk"],
          arguments: [.string(toolCallId), encodeValue(answers)]
        )
      ),
      pull(pullId),
    ]
  }

  public static func skipAskMessages(toolCallId: String, pullId: Int) -> [JSONValue] {
    [
      push(pipeline(importId: 0, path: ["skipAsk"], arguments: [.string(toolCallId)])),
      pull(pullId),
    ]
  }

  public static func parseIncoming(_ message: JSONValue) -> Incoming? {
    guard case .array(let parts) = message else { return nil }
    if parts.first?.array != nil {
      return nil
    }
    guard let tag = parts.first?.string else { return nil }
    switch tag {
    case "push" where parts.count > 1:
      return parseCall(parts[1])
    case "pull":
      return .pull(exportId: parts.count > 1 ? parts[1].int ?? 0 : 0)
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
    case pull(exportId: Int)
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
  public var streaming: OfficeMessage?
  public var toolResults: [String: JSONValue] = [:]
  public var status: String = "idle"
  public var error: String = ""
  public var connected = false
  public var generation: Int = 0
  public var seq: Int = 0
  /// Next client import id for `pull`. Subscribe takes 1; each later RPC increments.
  public private(set) var nextImportId = 1

  public init() {}

  public var isWorking: Bool {
    status == "streaming" || status == "submitted" || status == "running"
  }

  /// Projected assistant-ui rows: tool results folded onto calls, hidden kicks gone.
  public var viewMessages: [OfficeMessage] {
    OfficeProjection.project(
      messages: messages,
      streaming: streaming,
      toolResults: toolResults,
      working: isWorking
    )
  }

  public func connect() -> [JSONValue] {
    let frames = CapnWeb.subscribeMessages(pullId: takeImportId())
    outgoing.append(contentsOf: frames)
    return frames
  }

  public func send(content: String, id: String, targetBotId: String? = nil) -> [JSONValue] {
    let optimistic = OfficeMessage(id: id, role: "user", text: content)
    if !messages.contains(where: { $0.id == id }) {
      messages.append(optimistic)
    }
    status = status == "streaming" ? "streaming" : "submitted"
    let frames = CapnWeb.sendMessages(
      content: content,
      id: id,
      targetBotId: targetBotId,
      pullId: takeImportId()
    )
    outgoing.append(contentsOf: frames)
    return frames
  }

  public func stop() -> [JSONValue] {
    let frames = CapnWeb.stopMessages(pullId: takeImportId())
    outgoing.append(contentsOf: frames)
    return frames
  }

  public func answerAsk(toolCallId: String, answers: JSONValue) -> [JSONValue] {
    let frames = CapnWeb.answerAskMessages(
      toolCallId: toolCallId,
      answers: answers,
      pullId: takeImportId()
    )
    outgoing.append(contentsOf: frames)
    return frames
  }

  public func skipAsk(toolCallId: String) -> [JSONValue] {
    let frames = CapnWeb.skipAskMessages(toolCallId: toolCallId, pullId: takeImportId())
    outgoing.append(contentsOf: frames)
    return frames
  }

  /// Apply one Cap’n Web frame (or a batch / NDJSON). Returns frames the socket must send —
  /// incoming `pull`s need a `resolve` or the host’s `subscribe()` never finishes.
  @discardableResult
  public func apply(raw: JSONValue) -> [JSONValue] {
    if let items = raw.array, items.first?.array != nil {
      return items.flatMap { apply(raw: $0) }
    }
    guard let incoming = CapnWeb.parseIncoming(raw) else { return [] }
    switch incoming {
    case .call(_, let path, let arguments):
      handle(path: path, arguments: arguments)
      connected = true
      return []
    case .pull(let exportId):
      return [CapnWeb.resolveUndefined(exportId)]
    case .resolve:
      connected = true
      return []
    case .reject(_, let error):
      self.error = error["message"]?.string ?? error.description
      status = "error"
      return []
    case .abort(let error):
      self.error = error["message"]?.string ?? error.description
      connected = false
      return []
    }
  }

  @discardableResult
  public func apply(text: String) -> [JSONValue] {
    let pieces = text.split(whereSeparator: \.isNewline)
      .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
      .filter { !$0.isEmpty }
    if pieces.count > 1 {
      return pieces.flatMap { apply(text: $0) }
    }
    guard let json = try? JSONValue.parse(text) else { return [] }
    return apply(raw: json)
  }

  private func takeImportId() -> Int {
    let id = nextImportId
    nextImportId += 1
    return id
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
    if let snapshot = OfficeSnapshot.parse(raw) ?? OfficeSnapshot.parse(raw["snapshot"] ?? .null),
      raw["type"]?.string == nil || raw["type"]?.string == "snapshot"
    {
      replace(with: snapshot)
      return
    }
    if let event = OfficeEvent.parse(raw) {
      applyClientEvent(event)
    }
  }

  private func replace(with snapshot: OfficeSnapshot) {
    messages = mergeSnapshot(incoming: snapshot.messages)
    streaming = nil
    ingestToolResults(snapshot.messages)
    if snapshot.status == "running" {
      status = status == "ready" || status == "idle" ? "submitted" : status
    } else if snapshot.status == "failed" {
      status = "error"
    } else if !isWorking {
      status = "ready"
    }
    if let lastError = snapshot.lastError { error = lastError }
  }

  private func mergeSnapshot(incoming: [OfficeMessage]) -> [OfficeMessage] {
    if incoming.isEmpty { return messages }
    let seen = Set(incoming.map(\.id))
    let extras = messages.filter { !seen.contains($0.id) && $0.role == "user" }
    return extras.isEmpty ? incoming : incoming + extras
  }

  private func ingestToolResults(_ rows: [OfficeMessage]) {
    for row in rows {
      guard row.role == "toolResult", let toolCallId = row.toolCallId, !toolCallId.isEmpty else {
        continue
      }
      if let result = row.toolResult {
        toolResults[toolCallId] = result
      }
    }
  }

  private func upsert(_ message: OfficeMessage) {
    if let index = messages.firstIndex(where: { $0.id == message.id }) {
      messages[index] = message
    } else {
      messages.append(message)
    }
  }
}

public struct OfficePart: Sendable, Equatable, Identifiable {
  public enum Kind: String, Sendable {
    case text
    case thinking
    case toolCall
  }

  public var id: String
  public var kind: Kind
  public var text: String
  public var toolName: String?
  public var toolCallId: String?
  public var arguments: JSONValue?
  public var result: JSONValue?
  public var isError: Bool

  public init(
    id: String = UUID().uuidString,
    kind: Kind,
    text: String = "",
    toolName: String? = nil,
    toolCallId: String? = nil,
    arguments: JSONValue? = nil,
    result: JSONValue? = nil,
    isError: Bool = false
  ) {
    self.id = id
    self.kind = kind
    self.text = text
    self.toolName = toolName
    self.toolCallId = toolCallId
    self.arguments = arguments
    self.result = result
    self.isError = isError
  }
}

public struct OfficeMessage: Sendable, Equatable, Identifiable {
  public var id: String
  public var role: String
  public var text: String
  public var parts: [OfficePart]
  public var toolCallId: String?
  public var toolName: String?
  public var toolResult: JSONValue?
  public var metadata: JSONValue?

  public init(
    id: String,
    role: String,
    text: String,
    parts: [OfficePart] = [],
    toolCallId: String? = nil,
    toolName: String? = nil,
    toolResult: JSONValue? = nil,
    metadata: JSONValue? = nil
  ) {
    self.id = id
    self.role = role
    self.text = text
    self.parts = parts.isEmpty && !text.isEmpty
      ? [OfficePart(id: "\(id)-text", kind: .text, text: text)]
      : parts
    self.toolCallId = toolCallId
    self.toolName = toolName
    self.toolResult = toolResult
    self.metadata = metadata
  }

  public var isVisible: Bool {
    role != "toolResult"
  }

  public var hasDisplayContent: Bool {
    !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
      || parts.contains { $0.kind == .toolCall || !$0.text.isEmpty }
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

  public init(threadId: String, seq: Int, type: String, raw: JSONValue) {
    self.threadId = threadId
    self.seq = seq
    self.type = type
    self.raw = raw
  }

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
    let metadata = json["metadata"]
    if role == "toolResult" {
      let toolCallId = message["toolCallId"]?.string ?? json["toolCallId"]?.string
      let toolName = message["toolName"]?.string ?? json["toolName"]?.string
      let result = message["details"] ?? message["content"] ?? json["result"]
      return OfficeMessage(
        id: id,
        role: role,
        text: extractText(message["content"] ?? .null),
        toolCallId: toolCallId,
        toolName: toolName,
        toolResult: result,
        metadata: metadata
      )
    }
    let parts = parseParts(message["content"] ?? .null, idPrefix: id)
    let text = parts.filter { $0.kind == .text }.map(\.text).joined()
    return OfficeMessage(id: id, role: role, text: text, parts: parts, metadata: metadata)
  }

  public static func parseParts(_ content: JSONValue, idPrefix: String = "part") -> [OfficePart] {
    if let text = content.string, !text.isEmpty {
      return [OfficePart(id: "\(idPrefix)-text", kind: .text, text: text)]
    }
    guard let items = content.array else { return [] }
    return items.enumerated().compactMap { index, part -> OfficePart? in
      let type = part["type"]?.string ?? ""
      switch type {
      case "text":
        let text = part["text"]?.string ?? ""
        return text.isEmpty ? nil : OfficePart(id: "\(idPrefix)-text-\(index)", kind: .text, text: text)
      case "thinking":
        let text = part["thinking"]?.string ?? part["text"]?.string ?? ""
        return OfficePart(id: "\(idPrefix)-think-\(index)", kind: .thinking, text: text)
      case "toolCall", "tool-call":
        let name = part["name"]?.string ?? part["toolName"]?.string ?? "tool"
        let toolCallId = part["id"]?.string ?? part["toolCallId"]?.string
        let args = part["arguments"] ?? part["args"] ?? part["input"]
        return OfficePart(
          id: toolCallId ?? "\(idPrefix)-tool-\(index)",
          kind: .toolCall,
          text: Present.preview(args ?? .null),
          toolName: name,
          toolCallId: toolCallId,
          arguments: args
        )
      default:
        if type.hasPrefix("tool-") {
          let name = String(type.dropFirst(5))
          let args = part["input"] ?? part["args"] ?? part["arguments"]
          let toolCallId = part["toolCallId"]?.string
          return OfficePart(
            id: toolCallId ?? "\(idPrefix)-tool-\(index)",
            kind: .toolCall,
            text: Present.preview(args ?? .null),
            toolName: name,
            toolCallId: toolCallId,
            arguments: args
          )
        }
        return nil
      }
    }
  }

  public static func extractText(_ content: JSONValue) -> String {
    parseParts(content).filter { $0.kind == .text }.map(\.text).joined()
  }
}

extension OfficeSession {
  public func applyClientEvent(_ event: OfficeEvent) {
    if event.seq < seq { return }
    seq = event.seq
    switch event.type {
    case "snapshot":
      if let snapshot = OfficeSnapshot.parse(event.raw["snapshot"] ?? .null) {
        replace(with: snapshot)
      }
    case "message_update":
      guard let message = parseEventMessage(event) else { break }
      streaming = message
      status = "streaming"
    case "message_start", "message_end":
      guard let message = parseEventMessage(event) else { break }
      upsert(message)
      ingestToolResults([message])
      streaming = nil
      if event.type == "message_end", !isWorking {
        status = "ready"
      }
    case "tool_execution_end":
      if let toolCallId = event.raw["toolCallId"]?.string, !toolCallId.isEmpty {
        toolResults[toolCallId] = event.raw["result"] ?? .null
      }
    case "error":
      if let message = event.raw["error"]?.string, !message.isEmpty {
        error = message
        status = "error"
      }
    case "turn_start", "submitted":
      status = "submitted"
    case "turn_end", "idle":
      status = "ready"
    case "text_delta", "assistant_delta":
      let delta = event.raw["text"]?.string ?? event.raw["delta"]?.string ?? ""
      if !delta.isEmpty {
        if var live = streaming, live.role == "assistant" {
          live.text += delta
          live.parts = [OfficePart(kind: .text, text: live.text)]
          streaming = live
        } else if let index = messages.lastIndex(where: { $0.role == "assistant" }) {
          messages[index].text += delta
        } else {
          streaming = OfficeMessage(id: event.raw["id"]?.string ?? "stream", role: "assistant", text: delta)
        }
      }
      status = "streaming"
    default:
      if let snapshot = OfficeSnapshot.parse(event.raw["snapshot"] ?? .null) {
        replace(with: snapshot)
      }
    }
  }

  private func parseEventMessage(_ event: OfficeEvent) -> OfficeMessage? {
    guard let raw = event.raw["message"] else { return nil }
    let wrapped = JSONValue.object([
      "id": event.raw["id"] ?? streaming.map { .string($0.id) } ?? .string("stream"),
      "message": raw,
    ])
    return OfficeMessage.parse(wrapped)
  }
}

public enum Present {
  public static let toolName = "present"
  public static let askToolName = "ask"
  public static let stampAppToolName = "stamp_app"

  public static func coerce(_ input: JSONValue) -> JSONValue {
    if let text = input.string, let parsed = try? JSONValue.parse(text) {
      return coerce(parsed)
    }
    guard case .object(let object) = input else { return input }
    if object["$type"]?.string == nil, object["type"]?.string == nil {
      for key in ["raw", "tree", "card", "ui", "present", "component", "node"] {
        if let inner = object[key] {
          return coerce(inner)
        }
      }
    }
    var next = object
    if next["$type"]?.string == nil, let type = next["type"]?.string {
      next["$type"] = .string(type)
    }
    return .object(next)
  }

  public static func preview(_ tree: JSONValue) -> String {
    let node = coerce(tree)
    guard case .object(let object) = node else { return "" }
    if let title = object["title"]?.string?.trimmingCharacters(in: .whitespacesAndNewlines), !title.isEmpty {
      return clip(title)
    }
    if object["$type"]?.string == "File" {
      let path = object["path"]?.string ?? ""
      let name = path.split(separator: "/").last.map(String.init) ?? path
      if !name.isEmpty { return clip(name) }
    }
    let text = object["text"]?.string ?? object["value"]?.string ?? ""
    if object["$type"]?.string == "Fact" {
      let label = object["label"]?.string ?? ""
      if !label.isEmpty, !text.isEmpty { return clip("\(label) \(text)") }
    }
    if !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      return clip(text)
    }
    if let label = object["label"]?.string, !label.isEmpty { return clip(label) }
    if let children = object["children"]?.array {
      for child in children {
        let next = preview(child)
        if !next.isEmpty { return next }
      }
    }
    return clip(object["$type"]?.string ?? "")
  }

  private static func clip(_ text: String) -> String {
    let next = text.trimmingCharacters(in: .whitespacesAndNewlines)
    if next.count <= 80 { return next }
    return String(next.prefix(79)).trimmingCharacters(in: .whitespacesAndNewlines) + "…"
  }
}

public struct OfficeAskOption: Sendable, Equatable, Identifiable {
  public var id: String
  public var label: String
}

public struct OfficeAskQuestion: Sendable, Equatable, Identifiable {
  public var id: String
  public var prompt: String
  public var options: [OfficeAskOption]
  public var multi: Bool
}

public struct OfficeAskSettled: Sendable, Equatable {
  public var skipped: Bool
  public var message: String
  public var answers: [(id: String, prompt: String, value: String)]

  public static func == (lhs: OfficeAskSettled, rhs: OfficeAskSettled) -> Bool {
    lhs.skipped == rhs.skipped
      && lhs.message == rhs.message
      && lhs.answers.map(\.id) == rhs.answers.map(\.id)
      && lhs.answers.map(\.value) == rhs.answers.map(\.value)
  }
}

public enum OfficeAsk {
  public static func parseQuestions(_ value: JSONValue) -> [OfficeAskQuestion] {
    if let text = value.string, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      return [OfficeAskQuestion(id: "q-1", prompt: text.trimmingCharacters(in: .whitespacesAndNewlines), options: [], multi: false)]
    }
    guard case .object(let object) = value else { return [] }
    if let listed = object["questions"]?.array {
      return listed.prefix(4).enumerated().compactMap { index, item in
        question(from: item, fallbackId: "q-\(index + 1)")
      }
    }
    if let single = question(
      from: .object([
        "prompt": object["question"] ?? object["prompt"] ?? .null,
        "options": object["options"] ?? .null,
        "multi": object["multi"] ?? object["multiSelect"] ?? .null,
        "id": object["id"] ?? .null,
      ]),
      fallbackId: "q-1"
    ) {
      return [single]
    }
    return []
  }

  public static func parseSettled(_ value: JSONValue?) -> OfficeAskSettled? {
    guard let value else { return nil }
    if let text = value.string?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty {
      if let parsed = try? JSONValue.parse(text) { return parseSettled(parsed) }
      let skipped = text.range(of: "skipped|best judgment|no human", options: .regularExpression) != nil
      return OfficeAskSettled(skipped: skipped, message: text, answers: [])
    }
    guard case .object(let object) = value, object["ok"]?.bool != false else { return nil }
    let skipped = object["skipped"]?.bool == true
    let answers = (object["answers"]?.array ?? []).compactMap { item -> (id: String, prompt: String, value: String)? in
      let id = item["id"]?.string ?? ""
      let prompt = item["prompt"]?.string ?? ""
      let text = item["value"]?.string ?? ""
      guard !id.isEmpty, !text.isEmpty else { return nil }
      return (id, prompt, text)
    }
    let message = object["message"]?.string?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    if !skipped && answers.isEmpty && message.isEmpty { return nil }
    return OfficeAskSettled(skipped: skipped, message: message, answers: answers)
  }

  private static func question(from value: JSONValue, fallbackId: String) -> OfficeAskQuestion? {
    if let text = value.string?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty {
      return OfficeAskQuestion(id: fallbackId, prompt: text, options: [], multi: false)
    }
    guard case .object(let object) = value else { return nil }
    let prompt = (
      object["prompt"]?.string ?? object["question"]?.string ?? object["text"]?.string ?? ""
    )
    .trimmingCharacters(in: .whitespacesAndNewlines)
    if prompt.isEmpty { return nil }
    let id = object["id"]?.string?.trimmingCharacters(in: .whitespacesAndNewlines)
    let options = (object["options"]?.array ?? []).prefix(6).enumerated().compactMap { index, item -> OfficeAskOption? in
      if let label = item.string?.trimmingCharacters(in: .whitespacesAndNewlines), !label.isEmpty {
        return OfficeAskOption(id: "opt-\(index + 1)", label: label)
      }
      let label = (item["label"]?.string ?? item["text"]?.string ?? "")
        .trimmingCharacters(in: .whitespacesAndNewlines)
      if label.isEmpty { return nil }
      return OfficeAskOption(id: item["id"]?.string ?? "opt-\(index + 1)", label: label)
    }
    return OfficeAskQuestion(
      id: (id?.isEmpty == false ? id : nil) ?? fallbackId,
      prompt: prompt,
      options: Array(options),
      multi: object["multi"]?.bool == true || object["multiSelect"]?.bool == true
    )
  }
}
