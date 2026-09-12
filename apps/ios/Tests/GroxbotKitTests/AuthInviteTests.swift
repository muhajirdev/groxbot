import Foundation
import GroxbotKit
import Testing

@Suite("Invite")
struct InviteTests {
  @Test func readsInviteFromOnboardingURL() {
    #expect(Invite.fromHref("http://127.0.0.1:5173/onboarding?invite=inv_abc") == "inv_abc")
    #expect(Invite.fromHref("/onboarding?invite=inv_abc") == "inv_abc")
    #expect(Invite.fromHref("/onboarding") == nil)
  }

  @Test func invitationIdAcceptsRawOrLink() {
    #expect(Invite.invitationId(from: "inv_abc") == "inv_abc")
    #expect(Invite.invitationId(from: "groxbot-ios://onboarding?invite=inv_abc") == "inv_abc")
  }
}

@Suite("User facing errors")
struct ErrorTests {
  @Test func rewritesCloudflareErrorCode() {
    #expect(UserFacingError.humanize("error code: 1031") == "Could not reach this teammate. Try sending again.")
  }

  @Test func rewritesDeadFetch() {
    #expect(UserFacingError.humanize("Failed to fetch") == "Could not reach the office API.")
  }

  @Test func rewritesMessageTooLong() {
    #expect(
      UserFacingError.humanize(
        "The operation couldn’t be completed. Message too long",
        fallback: "Could not reach this teammate. Try sending again."
      ) == "Could not reach this teammate. Try sending again."
    )
  }

  @Test func swapsGenericHTTP() {
    #expect(UserFacingError.message(OrpcError(status: 401, message: "Unauthorized"), fallback: "Sign in") == "Sign in")
    #expect(UserFacingError.message(OrpcError(status: 400, message: "Paste a key"), fallback: "Sign in") == "Paste a key")
  }
}

@Suite("Hire")
struct HireTests {
  @Test func startsAtNewBot() {
    #expect(Hire.nextName([]) == Hire.newBotName)
    #expect(Hire.nextName([Bot(id: "1", workspaceId: "ws", name: "Piper")]) == Hire.newBotName)
  }

  @Test func incrementsWhenTaken() {
    #expect(
      Hire.nextName([Bot(id: "1", workspaceId: "ws", name: Hire.newBotName)]) == "New Bot 2"
    )
  }

  @Test func firstUnusedSwatch() {
    #expect(Hire.nextAvatarColor([]) == Hire.avatarColors[0])
    #expect(
      Hire.nextAvatarColor([Bot(id: "1", workspaceId: "ws", name: "A", avatarColor: Hire.avatarColors[0])])
        == Hire.avatarColors[1]
    )
  }

  @Test func draftCreatedBot() {
    let bot = Hire.draftCreatedBot(id: "bot-1", workspaceId: "ws-1", name: "New Bot", avatarColor: "#e45c9a")
    #expect(bot.threadId == "bot-1")
    #expect(bot.homeRoomId == "bot-1")
    #expect(bot.guestKind == "off")
    #expect(bot.visibility == "shared")
    #expect(bot.effort == "")
  }
}

@Suite("Cookie jar")
struct CookieJarTests {
  @Test func mergesSetCookie() {
    var jar = CookieJar()
    jar.merge(setCookieHeaders: ["better-auth.session_token=abc; Path=/; HttpOnly"])
    #expect(jar.cookie.contains("better-auth.session_token=abc"))
    jar.merge(setCookieHeaders: ["better-auth.session_token=deleted; Max-Age=0"])
    #expect(!jar.cookie.contains("better-auth.session_token=abc"))
  }
}

@Suite("Auth")
struct AuthClientTests {
  @Test func magicLinkPostsEmail() async throws {
    let transport = ScriptedTransport { request in
      #expect(request.url.path == "/api/auth/sign-in/magic-link")
      let body = try JSONValue.parse(request.body ?? Data())
      #expect(body["email"]?.string == "ada@example.com")
      #expect(body["callbackURL"]?.string == "groxbot-ios://")
      #expect(request.headers["Origin"] == GroxbotOrigins.cloudWeb)
      #expect(request.headers["expo-origin"] == GroxbotOrigins.cloudWeb)
      return HTTPResult(
        status: 200,
        data: Data("{}".utf8),
        headers: ["Set-Cookie": "better-auth.session_token=tok; Path=/"]
      )
    }
    let auth = AuthClient(
      apiOrigin: "http://127.0.0.1:3100",
      requestOrigin: GroxbotOrigins.cloudWeb,
      transport: transport
    )
    let jar = try await auth.sendMagicLink(email: "ada@example.com", callbackURL: GroxbotOrigins.callbackURL())
    #expect(jar.cookie.contains("better-auth.session_token=tok"))
  }
}
