import Foundation

public actor OrpcClient {
  public var apiOrigin: String
  public var cookie: String
  public var workspaceId: String?
  public var transport: any GroxbotTransport

  public init(
    apiOrigin: String,
    cookie: String = "",
    workspaceId: String? = nil,
    transport: any GroxbotTransport = URLSessionTransport()
  ) {
    self.apiOrigin = apiOrigin
    self.cookie = cookie
    self.workspaceId = workspaceId
    self.transport = transport
  }

  public func call(_ path: [String], input: JSONValue? = nil) async throws -> JSONValue {
    var request = HTTPRequest(url: GroxbotOrigins.rpcURL(apiOrigin: apiOrigin, path: path))
    request.method = "POST"
    request.headers["Content-Type"] = "application/json"
    if !cookie.isEmpty {
      request.headers["Cookie"] = cookie
    }
    if let workspaceId, !workspaceId.isEmpty {
      request.headers[GroxbotOrigins.workspaceHeader] = workspaceId
    }
    request.body = try OrpcCodec.encodeBody(input)
    let result = try await transport.send(request)
    if (200..<300).contains(result.status) {
      return try OrpcCodec.decodeSuccess(result.data)
    }
    throw OrpcCodec.decodeError(status: result.status, data: result.data)
  }

  public func health() async throws -> JSONValue { try await call(["health"]) }
  public func me() async throws -> JSONValue { try await call(["me"]) }
  public func botsList() async throws -> JSONValue { try await call(["bots", "list"]) }
  public func botsGet(id: String) async throws -> JSONValue {
    try await call(["bots", "get"], input: .object(["botId": .string(id)]))
  }
  public func botsCreate(_ input: JSONValue) async throws -> JSONValue {
    try await call(["bots", "create"], input: input)
  }
  public func botsUpdate(_ input: JSONValue) async throws -> JSONValue {
    try await call(["bots", "update"], input: input)
  }
  public func botsArchive(id: String) async throws -> JSONValue {
    try await call(["bots", "archive"], input: .object(["botId": .string(id)]))
  }
  public func botsUnarchive(id: String) async throws -> JSONValue {
    try await call(["bots", "unarchive"], input: .object(["botId": .string(id)]))
  }
  public func botsPin(id: String) async throws -> JSONValue {
    try await call(["bots", "pin"], input: .object(["botId": .string(id)]))
  }
  public func botsUnpin(id: String) async throws -> JSONValue {
    try await call(["bots", "unpin"], input: .object(["botId": .string(id)]))
  }
  public func botsDelete(id: String) async throws -> JSONValue {
    try await call(["bots", "delete"], input: .object(["botId": .string(id)]))
  }
  public func roomsList() async throws -> JSONValue { try await call(["rooms", "list"]) }
  public func roomsGet(id: String) async throws -> JSONValue {
    try await call(["rooms", "get"], input: .object(["roomId": .string(id)]))
  }
  public func roomsCreate(_ input: JSONValue) async throws -> JSONValue {
    try await call(["rooms", "create"], input: input)
  }
  public func sectionsList() async throws -> JSONValue { try await call(["sections", "list"]) }
  public func sectionsCreate(name: String) async throws -> JSONValue {
    try await call(["sections", "create"], input: .object(["name": .string(name)]))
  }
  public func computerList(botId: String) async throws -> JSONValue {
    try await call(["computer", "list"], input: .object(["botId": .string(botId)]))
  }
  public func computerRead(botId: String, path: String) async throws -> JSONValue {
    try await call(
      ["computer", "read"],
      input: .object(["botId": .string(botId), "path": .string(path)])
    )
  }
  public func computerDownload(botId: String, path: String) async throws -> JSONValue {
    try await call(
      ["computer", "download"],
      input: .object(["botId": .string(botId), "path": .string(path)])
    )
  }
  public func knowledgeList() async throws -> JSONValue { try await call(["knowledge", "list"]) }
  public func knowledgeSearch(query: String) async throws -> JSONValue {
    try await call(["knowledge", "search"], input: .object(["query": .string(query)]))
  }
  public func knowledgeRead(path: String) async throws -> JSONValue {
    try await call(["knowledge", "read"], input: .object(["path": .string(path)]))
  }
  public func knowledgeWrite(path: String, content: String) async throws -> JSONValue {
    try await call(
      ["knowledge", "write"],
      input: .object(["path": .string(path), "content": .string(content)])
    )
  }
  public func workspacesCreate(name: String) async throws -> JSONValue {
    try await call(["workspaces", "create"], input: .object(["name": .string(name)]))
  }
  public func workspacesJoin(invitationId: String) async throws -> JSONValue {
    try await call(
      ["workspaces", "join"],
      input: .object(["invitationId": .string(invitationId)])
    )
  }
  public func workspacesPeek(invitationId: String) async throws -> JSONValue {
    try await call(
      ["workspaces", "peek"],
      input: .object(["invitationId": .string(invitationId)])
    )
  }
  public func workspacesList() async throws -> JSONValue { try await call(["workspaces", "list"]) }
  public func workspacesActivate(id: String) async throws -> JSONValue {
    try await call(["workspaces", "activate"], input: .object(["workspaceId": .string(id)]))
  }
  public func modelsGet() async throws -> JSONValue { try await call(["models", "get"]) }
  public func modelsSave(_ input: JSONValue) async throws -> JSONValue {
    try await call(["models", "save"], input: input)
  }
  public func pluginsList() async throws -> JSONValue { try await call(["plugins", "list"]) }
  public func pluginsStatus() async throws -> JSONValue { try await call(["plugins", "status"]) }
  public func billingStatus() async throws -> JSONValue { try await call(["billing", "status"]) }
  public func billingCheckout(plan: String, interval: String = "month") async throws -> JSONValue {
    try await call(
      ["billing", "checkout"],
      input: .object(["plan": .string(plan), "interval": .string(interval)])
    )
  }
  public func billingPortal() async throws -> JSONValue { try await call(["billing", "portal"]) }
  public func appsList() async throws -> JSONValue { try await call(["apps", "list"]) }
  public func routinesList(botId: String) async throws -> JSONValue {
    try await call(["routines", "list"], input: .object(["botId": .string(botId)]))
  }
  public func accountUpdate(name: String) async throws -> JSONValue {
    try await call(["account", "update"], input: .object(["name": .string(name)]))
  }
}
