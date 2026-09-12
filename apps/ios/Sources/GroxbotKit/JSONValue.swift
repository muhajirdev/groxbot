import Foundation

/// JSON tree used by oRPC payloads and the Cap'n Web expression codec.
public enum JSONValue: Sendable, Equatable, Hashable {
  case null
  case bool(Bool)
  case number(Double)
  case string(String)
  case array([JSONValue])
  case object([String: JSONValue])

  public static func int(_ value: Int) -> JSONValue {
    .number(Double(value))
  }

  public var string: String? {
    if case .string(let value) = self { return value }
    return nil
  }

  public var bool: Bool? {
    if case .bool(let value) = self { return value }
    return nil
  }

  public var number: Double? {
    if case .number(let value) = self { return value }
    return nil
  }

  public var int: Int? {
    guard case .number(let value) = self, value.rounded() == value else { return nil }
    return Int(value)
  }

  public var array: [JSONValue]? {
    if case .array(let value) = self { return value }
    return nil
  }

  public var object: [String: JSONValue]? {
    if case .object(let value) = self { return value }
    return nil
  }

  public subscript(key: String) -> JSONValue? {
    object?[key]
  }

  public static func from(_ any: Any?) -> JSONValue {
    switch any {
    case nil, is NSNull:
      return .null
    case let value as JSONValue:
      return value
    case let value as NSNumber:
      // JSONSerialization boxes numbers as NSNumber; `as Bool` matches 0/1. Use objCType.
      let objCType = String(cString: value.objCType)
      if objCType == "c" || objCType == "B" {
        return .bool(value.boolValue)
      }
      return .number(value.doubleValue)
    case let value as Bool:
      return .bool(value)
    case let value as Int:
      return .int(value)
    case let value as Int64:
      return .number(Double(value))
    case let value as Double:
      return .number(value)
    case let value as String:
      return .string(value)
    case let value as [Any]:
      return .array(value.map { from($0) })
    case let value as [String: Any]:
      return .object(value.mapValues { from($0) })
    default:
      return .null
    }
  }

  public func jsonObject() -> Any {
    switch self {
    case .null: return NSNull()
    case .bool(let value): return value
    case .number(let value):
      if value.rounded() == value, let asInt = Int(exactly: value) {
        return asInt
      }
      return value
    case .string(let value): return value
    case .array(let value): return value.map { $0.jsonObject() }
    case .object(let value): return value.mapValues { $0.jsonObject() }
    }
  }

  public func encode() throws -> Data {
    try JSONSerialization.data(
      withJSONObject: jsonObject(),
      options: [.sortedKeys]
    )
  }

  public static func parse(_ data: Data) throws -> JSONValue {
    if data.isEmpty { return .null }
    let raw = try JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed])
    return from(raw)
  }

  public static func parse(_ text: String) throws -> JSONValue {
    try parse(Data(text.utf8))
  }
}

extension JSONValue: CustomStringConvertible {
  public var description: String {
    switch self {
    case .null: return "null"
    case .bool(let value): return value ? "true" : "false"
    case .number(let value): return String(value)
    case .string(let value): return value
    case .array, .object:
      guard let data = try? encode(), let text = String(data: data, encoding: .utf8) else {
        return "<json>"
      }
      return text
    }
  }
}
