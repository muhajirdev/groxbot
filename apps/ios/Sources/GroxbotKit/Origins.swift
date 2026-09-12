import Foundation

public enum GroxbotOrigins: Sendable {
  public static let cloudLanding = "https://groxbot.com"
  public static let cloudWeb = "https://app.groxbot.com"
  public static let cloudApi = "https://api.groxbot.com"
  public static let localApi = "http://127.0.0.1:3100"
  public static let localWeb = "http://127.0.0.1:5173"
  /// Native iOS companion. Expo keeps `groxbot://`.
  public static let appScheme = "groxbot-ios"
  public static let workspaceHeader = "x-workspace-id"

  public static func apiOrigin(explicit: String? = nil, production: Bool) -> String {
    if let explicit, !explicit.isEmpty {
      return trimSlash(explicit)
    }
    return production ? cloudApi : localApi
  }

  public static func webOrigin(explicit: String? = nil, production: Bool) -> String {
    if let explicit, !explicit.isEmpty {
      return trimSlash(explicit)
    }
    return production ? cloudWeb : localWeb
  }

  public static func officeRpcURL(
    roomId: String,
    apiOrigin: String,
    cookie: String? = nil,
    workspaceId: String? = nil
  ) -> URL {
    var url = websocketURL(from: apiOrigin)
    url.append(path: "/rooms/\(encodePath(roomId))/rpc")
    var items: [URLQueryItem] = []
    if let cookie, !cookie.isEmpty {
      items.append(URLQueryItem(name: "Cookie", value: cookie))
    }
    if let workspaceId, !workspaceId.isEmpty {
      items.append(URLQueryItem(name: workspaceHeader, value: workspaceId))
    }
    if !items.isEmpty {
      url.append(queryItems: items)
    }
    return url
  }

  public static func officeThreadURL(botId: String, webOrigin: String) -> URL {
    var url = URL(string: trimSlash(webOrigin))!
    url.append(path: "/\(encodePath(botId))")
    return url
  }

  public static func officeAppURL(botId: String, appId: String, webOrigin: String) -> URL {
    var url = officeThreadURL(botId: botId, webOrigin: webOrigin)
    url.append(queryItems: [
      URLQueryItem(name: "pane", value: "app"),
      URLQueryItem(name: "app", value: appId),
    ])
    return url
  }

  public static func rpcURL(apiOrigin: String, path: [String]) -> URL {
    var url = URL(string: trimSlash(apiOrigin))!
    url.append(path: "/rpc")
    for segment in path {
      url.append(path: "/\(encodePath(segment))")
    }
    return url
  }

  public static func authURL(apiOrigin: String, path: String) -> URL {
    var url = URL(string: trimSlash(apiOrigin))!
    url.append(path: path.hasPrefix("/") ? path : "/\(path)")
    return url
  }

  public static func callbackURL() -> URL {
    URL(string: "\(appScheme)://")!
  }

  private static func websocketURL(from httpOrigin: String) -> URL {
    let trimmed = trimSlash(httpOrigin)
    if trimmed.hasPrefix("https://") {
      return URL(string: "wss://" + trimmed.dropFirst("https://".count))!
    }
    if trimmed.hasPrefix("http://") {
      return URL(string: "ws://" + trimmed.dropFirst("http://".count))!
    }
    return URL(string: trimmed)!
  }

  private static func trimSlash(_ value: String) -> String {
    value.hasSuffix("/") ? String(value.dropLast()) : value
  }

  private static func encodePath(_ value: String) -> String {
    value.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? value
  }
}
