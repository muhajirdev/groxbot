import Combine
import Foundation
import GroxbotKit

@MainActor
final class AppModel: ObservableObject {
  @Published var apiOrigin: String
  @Published var webOrigin: String
  @Published var cookie: String {
    didSet { UserDefaults.standard.set(cookie, forKey: "groxbot.cookie") }
  }
  @Published var workspaceId: String? {
    didSet { UserDefaults.standard.set(workspaceId, forKey: "groxbot.workspace") }
  }
  @Published var health: Health?
  @Published var me: Me?
  @Published var bots: [Bot] = []
  @Published var rooms: [Room] = []
  @Published var sections: [SidebarSection] = []
  @Published var sessionReady = false
  @Published var signedIn = false
  @Published var error = ""
  @Published var invite = ""
  @Published var production: Bool

  init(
    apiOrigin: String? = nil,
    webOrigin: String? = nil,
    production: Bool = false
  ) {
    let storedApi = UserDefaults.standard.string(forKey: "groxbot.api")
    let storedWeb = UserDefaults.standard.string(forKey: "groxbot.web")
    self.production = production || storedApi?.contains("groxbot.com") == true
    self.apiOrigin = GroxbotOrigins.apiOrigin(
      explicit: apiOrigin ?? storedApi ?? ProcessInfo.processInfo.environment["GROXBOT_API_URL"],
      production: self.production
    )
    self.webOrigin = GroxbotOrigins.webOrigin(
      explicit: webOrigin ?? storedWeb ?? ProcessInfo.processInfo.environment["GROXBOT_WEB_URL"],
      production: self.production
    )
    self.cookie = UserDefaults.standard.string(forKey: "groxbot.cookie") ?? ""
    self.workspaceId = UserDefaults.standard.string(forKey: "groxbot.workspace")
  }

  var client: OrpcClient {
    OrpcClient(apiOrigin: apiOrigin, cookie: cookie, workspaceId: workspaceId)
  }

  var auth: AuthClient {
    AuthClient(apiOrigin: apiOrigin)
  }

  func bootstrap() async {
    error = ""
    do {
      health = Health(try await client.health())
    } catch {
      health = nil
    }
    await refreshSession()
  }

  func refreshSession() async {
    if cookie.isEmpty {
      signedIn = false
      me = nil
      sessionReady = true
      return
    }
    do {
      me = Me(try await client.me())
      signedIn = me != nil
      workspaceId = me?.workspaceId
      if signedIn, me?.needsWorkspace == false {
        await refreshRoster()
      }
    } catch {
      signedIn = false
      me = nil
    }
    sessionReady = true
  }

  func refreshRoster() async {
    do {
      async let botsJson = client.botsList()
      async let roomsJson = client.roomsList()
      async let sectionsJson = client.sectionsList()
      bots = JSONList.bots(try await botsJson)
      rooms = JSONList.rooms(try await roomsJson)
      sections = JSONList.sections(try await sectionsJson)
    } catch {
      self.error = UserFacingError.message(error, fallback: "Could not load the office")
    }
  }

  func sendMagicLink(email: String) async {
    error = ""
    do {
      let jar = try await auth.sendMagicLink(email: email, callbackURL: GroxbotOrigins.callbackURL())
      if !jar.cookie.isEmpty { cookie = jar.cookie }
    } catch {
      self.error = UserFacingError.message(error, fallback: "Could not send a sign-in link")
    }
  }

  func verifyOTP(email: String, otp: String) async {
    error = ""
    do {
      let jar = try await auth.signInEmailOTP(email: email, otp: otp)
      if !jar.cookie.isEmpty { cookie = jar.cookie }
      await refreshSession()
    } catch {
      self.error = UserFacingError.message(error, fallback: "Could not verify that code")
    }
  }

  func createWorkspace(name: String) async -> Bool {
    error = ""
    do {
      let created = try await client.workspacesCreate(name: name)
      workspaceId = created["id"]?.string
      await refreshSession()
      return true
    } catch {
      self.error = UserFacingError.message(error, fallback: "Could not create workspace")
      return false
    }
  }

  func joinWorkspace(_ invitationId: String) async -> Bool {
    error = ""
    do {
      let joined = try await client.workspacesJoin(invitationId: invitationId)
      workspaceId = joined["id"]?.string
      await refreshSession()
      return true
    } catch {
      self.error = UserFacingError.message(error, fallback: "Could not join")
      return false
    }
  }

  func hire(name: String, visibility: String = "shared") async -> Bot? {
    error = ""
    do {
      let json = try await client.botsCreate(
        .object([
          "name": .string(name),
          "avatarColor": .string(Hire.nextAvatarColor(bots)),
          "visibility": .string(visibility),
        ])
      )
      guard let bot = Bot(json) else { return nil }
      bots.insert(bot, at: 0)
      return bot
    } catch {
      self.error = UserFacingError.message(error, fallback: "Could not hire")
      return nil
    }
  }

  func signOut() async {
    try? await auth.signOut(cookie: cookie)
    cookie = ""
    me = nil
    bots = []
    rooms = []
    signedIn = false
  }

  func handle(url: URL) {
    if let invite = Invite.fromHref(url.absoluteString) {
      self.invite = invite
    }
    Task { await refreshSession() }
  }

  func officeURL(for bot: Bot) -> URL {
    GroxbotOrigins.officeRpcURL(
      roomId: bot.homeRoomId,
      apiOrigin: apiOrigin,
      cookie: cookie,
      workspaceId: workspaceId
    )
  }
}
