import Foundation

/// Fold Pi assistant + toolResult rows into one UI bubble — same job as
/// `projectPiOfficeView` in `@groxbot/core`. assistant-ui on web/Expo does this
/// before `ThreadMessageLike`; SwiftUI needs the same store shape.
public enum OfficeProjection {
  public static let reviewSource = "office-review"
  public static let introSource = "office-intro"
  public static let reviewSkip = "Skip"

  public static func project(
    messages: [OfficeMessage],
    streaming: OfficeMessage? = nil,
    toolResults: [String: JSONValue] = [:],
    working _: Bool = false
  ) -> [OfficeMessage] {
    let rows = viewRows(messages: messages, streaming: streaming)
    var results = toolResultMap(rows)
    for (id, value) in toolResults {
      if results[id] == nil { results[id] = value }
    }

    var out: [OfficeMessage] = []
    var group: OfficeMessage?
    var groupParts: [OfficePart] = []

    func speaker(_ message: OfficeMessage) -> String {
      message.metadata?["custom"]?["speaker"]?["botId"]?.string
        ?? message.metadata?["speaker"]?["botId"]?.string
        ?? ""
    }

    func flush() {
      guard var next = group else { return }
      next.parts = groupParts
      next.text = groupParts.filter { $0.kind == .text }.map(\.text).joined()
      out.append(next)
      group = nil
      groupParts = []
    }

    for row in rows {
      if row.role == "toolResult" { continue }
      if row.role == "assistant" {
        if let current = group, speaker(current) != speaker(row) {
          flush()
        }
        if group == nil {
          group = row
        }
        merge(parts: row.parts, into: &groupParts, results: results)
        continue
      }
      flush()
      if row.role == "user" {
        out.append(row)
      }
    }
    flush()
    return out.filter(isVisible)
  }

  public static func isVisible(_ message: OfficeMessage) -> Bool {
    if message.role == "user", isHiddenUser(message) { return false }
    if message.role == "assistant", message.text.trimmingCharacters(in: .whitespacesAndNewlines) == reviewSkip {
      return false
    }
    return message.hasDisplayContent || message.role == "user"
  }

  public static func isHiddenUser(_ message: OfficeMessage) -> Bool {
    guard message.role == "user" else { return false }
    let source = message.metadata?["source"]?.string
      ?? message.metadata?["custom"]?["source"]?.string
      ?? ""
    return source == reviewSource || source == introSource
  }

  private static func viewRows(messages: [OfficeMessage], streaming: OfficeMessage?) -> [OfficeMessage] {
    guard let streaming else { return messages }
    if let index = messages.firstIndex(where: { $0.id == streaming.id }) {
      var copy = messages
      copy[index] = streaming
      return copy
    }
    return messages + [streaming]
  }

  private static func toolResultMap(_ messages: [OfficeMessage]) -> [String: JSONValue] {
    var map: [String: JSONValue] = [:]
    for row in messages where row.role == "toolResult" {
      if let id = row.toolCallId, !id.isEmpty, let result = row.toolResult {
        map[id] = result
      }
    }
    return map
  }

  private static func merge(
    parts: [OfficePart],
    into dest: inout [OfficePart],
    results: [String: JSONValue]
  ) {
    for var part in parts {
      if part.kind == .toolCall, let id = part.toolCallId, let result = results[id] {
        part.result = result
      }
      if part.kind == .toolCall, let id = part.toolCallId,
        let index = dest.firstIndex(where: { $0.kind == .toolCall && $0.toolCallId == id })
      {
        let prev = dest[index]
        if part.result == nil { part.result = prev.result }
        if prev.isError { part.isError = true }
        if part.text.isEmpty { part.text = prev.text }
        dest[index] = part
      } else {
        dest.append(part)
      }
    }
  }
}
