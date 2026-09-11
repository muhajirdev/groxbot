import Foundation

/// oRPC fetch serializer: `{ "json": <input>, "meta"?: [...] }`.
public enum OrpcCodec: Sendable {
  public static func encodeBody(_ input: JSONValue?) throws -> Data? {
    guard let input, input != .null else { return nil }
    return try JSONValue.object(["json": input]).encode()
  }

  public static func decodeSuccess(_ data: Data) throws -> JSONValue {
    if data.isEmpty { return .null }
    let parsed = try JSONValue.parse(data)
    if let json = parsed["json"] { return json }
    return parsed
  }

  public static func decodeError(status: Int, data: Data) -> OrpcError {
    let parsed = (try? JSONValue.parse(data)) ?? .null
    let payload = parsed["json"] ?? parsed
    let message =
      payload["message"]?.string
      ?? payload["data"]?["message"]?.string
      ?? (status == 401 ? "Unauthorized" : "Request failed")
    let code = payload["code"]?.string
    return OrpcError(status: status, code: code, message: message)
  }
}

public struct OrpcError: Error, Sendable, Equatable {
  public var status: Int
  public var code: String?
  public var message: String

  public init(status: Int, code: String? = nil, message: String) {
    self.status = status
    self.code = code
    self.message = message
  }
}
