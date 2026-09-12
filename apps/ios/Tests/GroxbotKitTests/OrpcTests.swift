import Foundation
import GroxbotKit
import Testing

@Suite("oRPC codec")
struct OrpcCodecTests {
  @Test func wrapsInputUnderJson() throws {
    let body = try OrpcCodec.encodeBody(.object(["botId": .string("bot_1")]))
    let parsed = try JSONValue.parse(body!)
    #expect(parsed["json"]?["botId"]?.string == "bot_1")
  }

  @Test func omitsBodyWhenInputIsNil() throws {
    #expect(try OrpcCodec.encodeBody(nil) == nil)
    #expect(try OrpcCodec.encodeBody(.null) == nil)
  }

  @Test func unwrapsJsonSuccess() throws {
    let data = try JSONValue.object(["json": .object(["ok": .bool(true)])]).encode()
    #expect(try OrpcCodec.decodeSuccess(data)["ok"]?.bool == true)
  }

  @Test func readsErrorMessage() {
    let data = try! JSONValue.object(["json": .object(["message": .string("Paste a key")])]).encode()
    let error = OrpcCodec.decodeError(status: 400, data: data)
    #expect(error.message == "Paste a key")
    #expect(error.status == 400)
  }
}

@Suite("OrpcClient")
struct OrpcClientTests {
  @Test func postsProcedurePathWithCookieAndWorkspace() async throws {
    let transport = ScriptedTransport { request in
      #expect(request.url.path == "/rpc/bots/get")
      #expect(request.method == "POST")
      #expect(request.headers["Cookie"] == "sid=1")
      #expect(request.headers["x-workspace-id"] == "ws_1")
      let body = try JSONValue.parse(request.body ?? Data())
      #expect(body["json"]?["botId"]?.string == "bot_1")
      let payload = try JSONValue.object(["json": .object(["id": .string("bot_1"), "name": .string("Reja")])]).encode()
      return HTTPResult(status: 200, data: payload)
    }
    let client = OrpcClient(
      apiOrigin: "http://127.0.0.1:3100",
      cookie: "sid=1",
      workspaceId: "ws_1",
      transport: transport
    )
    let bot = try await client.botsGet(id: "bot_1")
    #expect(bot["name"]?.string == "Reja")
  }

  @Test func healthHasNoBody() async throws {
    let transport = ScriptedTransport { request in
      #expect(request.url.path == "/rpc/health")
      #expect(request.body == nil || request.body?.isEmpty == true)
      let payload = try JSONValue.object(["json": .object(["ok": .bool(true), "oauth": .array([.string("google")])])]).encode()
      return HTTPResult(status: 200, data: payload)
    }
    let client = OrpcClient(apiOrigin: "http://127.0.0.1:3100", transport: transport)
    let health = try await client.health()
    #expect(health["ok"]?.bool == true)
  }

  @Test func unauthorizedThrows() async {
    let transport = ScriptedTransport { _ in
      let payload = try JSONValue.object(["json": .object(["message": .string("Unauthorized")])]).encode()
      return HTTPResult(status: 401, data: payload)
    }
    let client = OrpcClient(apiOrigin: "http://127.0.0.1:3100", transport: transport)
    do {
      _ = try await client.me()
      Issue.record("expected throw")
    } catch let error as OrpcError {
      #expect(error.status == 401)
    } catch {
      Issue.record("wrong error \(error)")
    }
  }
}

@Suite("Origins")
struct OriginsTests {
  @Test func localAndCloud() {
    #expect(GroxbotOrigins.apiOrigin(production: false) == "http://127.0.0.1:3100")
    #expect(GroxbotOrigins.webOrigin(production: false) == "http://127.0.0.1:5173")
    #expect(GroxbotOrigins.apiOrigin(production: true) == "https://api.whip.computer")
    #expect(GroxbotOrigins.apiOrigin(explicit: "http://192.168.1.9:3100/", production: true) == "http://192.168.1.9:3100")
  }

  @Test func officeRpcUsesRoomIdAndQueryCookie() {
    let url = GroxbotOrigins.officeRpcURL(
      roomId: "room_1",
      apiOrigin: "http://127.0.0.1:3100",
      cookie: "better-auth.session_token=abc",
      workspaceId: "ws_1",
      cookieInQuery: true
    )
    #expect(url.absoluteString.contains("ws://127.0.0.1:3100/rooms/room_1/rpc"))
    #expect(url.absoluteString.contains("Cookie="))
    #expect(url.absoluteString.contains("x-workspace-id=ws_1"))
  }

  @Test func officeRpcKeepsLongCookieOffTheURL() {
    let fat = String(repeating: "a", count: 800)
    let url = GroxbotOrigins.officeRpcURL(
      roomId: "room_1",
      apiOrigin: "https://api.groxbot.com",
      cookie: "better-auth.session_token=\(fat)",
      workspaceId: "ws_1"
    )
    #expect(!url.absoluteString.contains("Cookie="))
    #expect(url.absoluteString.contains("x-workspace-id=ws_1"))
  }

  @Test func officeThreadAndApp() {
    #expect(
      GroxbotOrigins.officeThreadURL(botId: "bot_1", webOrigin: "http://127.0.0.1:5173")
        .absoluteString == "http://127.0.0.1:5173/bot_1"
    )
    #expect(
      GroxbotOrigins.officeAppURL(botId: "bot_1", appId: "app_9", webOrigin: "http://127.0.0.1:5173")
        .absoluteString.contains("pane=app")
    )
  }

  @Test func nativeSchemeDoesNotCollideWithExpo() {
    #expect(GroxbotOrigins.appScheme == "groxbot-ios")
    #expect(GroxbotOrigins.callbackURL().absoluteString == "groxbot-ios://")
  }
}
