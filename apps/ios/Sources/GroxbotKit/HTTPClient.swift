import Foundation

#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public struct HTTPRequest: Sendable {
  public var url: URL
  public var method: String
  public var headers: [String: String]
  public var body: Data?

  public init(url: URL, method: String = "POST", headers: [String: String] = [:], body: Data? = nil) {
    self.url = url
    self.method = method
    self.headers = headers
    self.body = body
  }
}

public struct HTTPResult: Sendable {
  public var status: Int
  public var data: Data
  public var headers: [String: String]

  public init(status: Int, data: Data, headers: [String: String] = [:]) {
    self.status = status
    self.data = data
    self.headers = headers
  }

  public var setCookie: [String] {
    if let value = headers["Set-Cookie"] ?? headers["set-cookie"] { return [value] }
    return []
  }
}

public protocol GroxbotTransport: Sendable {
  func send(_ request: HTTPRequest) async throws -> HTTPResult
}

public struct URLSessionTransport: GroxbotTransport, @unchecked Sendable {
  public init() {}

  public func send(_ request: HTTPRequest) async throws -> HTTPResult {
    var urlRequest = URLRequest(url: request.url)
    urlRequest.httpMethod = request.method
    for (key, value) in request.headers {
      urlRequest.setValue(value, forHTTPHeaderField: key)
    }
    urlRequest.httpBody = request.body
    let (data, response) = try await URLSession.shared.data(for: urlRequest)
    let http = response as? HTTPURLResponse
    var headers: [String: String] = [:]
    if let fields = http?.allHeaderFields {
      for (key, value) in fields {
        headers[String(describing: key)] = String(describing: value)
      }
    }
    return HTTPResult(status: http?.statusCode ?? 0, data: data, headers: headers)
  }
}

public struct ScriptedTransport: GroxbotTransport, @unchecked Sendable {
  public typealias Handler = @Sendable (HTTPRequest) throws -> HTTPResult
  private let handler: Handler

  public init(handler: @escaping Handler) {
    self.handler = handler
  }

  public func send(_ request: HTTPRequest) async throws -> HTTPResult {
    try handler(request)
  }
}
