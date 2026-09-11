import Foundation

public struct CookieJar: Sendable, Equatable {
  public var cookie: String

  public init(_ cookie: String = "") {
    self.cookie = cookie
  }

  public mutating func merge(setCookieHeaders: [String]) {
    var map = Self.parse(cookie)
    for header in setCookieHeaders {
      let pair = header.split(separator: ";", maxSplits: 1, omittingEmptySubsequences: true)
        .first?
        .trimmingCharacters(in: .whitespaces)
      guard let pair, let eq = pair.firstIndex(of: "=") else { continue }
      let name = String(pair[..<eq])
      let value = String(pair[pair.index(after: eq)...])
      if value.isEmpty || value == "deleted" {
        map.removeValue(forKey: name)
      } else {
        map[name] = value
      }
    }
    cookie = Self.format(map)
  }

  public static func parse(_ header: String) -> [String: String] {
    guard !header.isEmpty else { return [:] }
    var map: [String: String] = [:]
    for part in header.split(separator: ";") {
      let trimmed = part.trimmingCharacters(in: .whitespaces)
      guard let eq = trimmed.firstIndex(of: "=") else { continue }
      map[String(trimmed[..<eq])] = String(trimmed[trimmed.index(after: eq)...])
    }
    return map
  }

  public static func format(_ map: [String: String]) -> String {
    map.keys.sorted().map { "\($0)=\(map[$0] ?? "")" }.joined(separator: "; ")
  }
}

public struct AuthClient: Sendable {
  public var apiOrigin: String
  public var transport: any GroxbotTransport

  public init(apiOrigin: String, transport: any GroxbotTransport = URLSessionTransport()) {
    self.apiOrigin = apiOrigin
    self.transport = transport
  }

  public func sendMagicLink(email: String, callbackURL: URL) async throws -> CookieJar {
    try await post(
      "/api/auth/sign-in/magic-link",
      body: .object([
        "email": .string(email),
        "callbackURL": .string(callbackURL.absoluteString),
        "errorCallbackURL": .string(callbackURL.absoluteString),
      ])
    ).1
  }

  public func signInEmailOTP(email: String, otp: String) async throws -> CookieJar {
    try await post(
      "/api/auth/sign-in/email-otp",
      body: .object([
        "email": .string(email),
        "otp": .string(otp),
      ])
    ).1
  }

  public func getSession(cookie: String) async throws -> JSONValue {
    var request = HTTPRequest(
      url: GroxbotOrigins.authURL(apiOrigin: apiOrigin, path: "/api/auth/get-session"),
      method: "GET"
    )
    if !cookie.isEmpty {
      request.headers["Cookie"] = cookie
    }
    let result = try await transport.send(request)
    if result.status == 401 || result.data.isEmpty { return .null }
    if !(200..<300).contains(result.status) {
      throw OrpcCodec.decodeError(status: result.status, data: result.data)
    }
    return try JSONValue.parse(result.data)
  }

  public func signOut(cookie: String) async throws {
    var request = HTTPRequest(
      url: GroxbotOrigins.authURL(apiOrigin: apiOrigin, path: "/api/auth/sign-out"),
      method: "POST"
    )
    request.headers["Content-Type"] = "application/json"
    if !cookie.isEmpty {
      request.headers["Cookie"] = cookie
    }
    _ = try await transport.send(request)
  }

  public func socialSignInURL(provider: String, callbackURL: URL) -> URL {
    var url = GroxbotOrigins.authURL(apiOrigin: apiOrigin, path: "/api/auth/sign-in/social")
    url.append(queryItems: [
      URLQueryItem(name: "provider", value: provider),
      URLQueryItem(name: "callbackURL", value: callbackURL.absoluteString),
      URLQueryItem(name: "errorCallbackURL", value: callbackURL.absoluteString),
    ])
    return url
  }

  private func post(_ path: String, body: JSONValue) async throws -> (JSONValue, CookieJar) {
    var request = HTTPRequest(url: GroxbotOrigins.authURL(apiOrigin: apiOrigin, path: path), method: "POST")
    request.headers["Content-Type"] = "application/json"
    request.body = try body.encode()
    let result = try await transport.send(request)
    var jar = CookieJar()
    jar.merge(setCookieHeaders: result.setCookie)
    if !(200..<300).contains(result.status) {
      throw OrpcCodec.decodeError(status: result.status, data: result.data)
    }
    let parsed = result.data.isEmpty ? .null : (try? JSONValue.parse(result.data)) ?? .null
    return (parsed, jar)
  }
}
