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
  @Published var workspaces: [Workspace] = []
  @Published var sessionReady = false
  @Published var signedIn = false
  @Published var error = ""
  @Published var invite = ""
  @Published var production: Bool
  /// Cap’n Web sessions live outside the thread view — same idea as `ensurePiThread`.
  private var offices: [String: OfficeController] = [:]

  init(
    apiOrigin: String? = nil,
    webOrigin: String? = nil,
    production: Bool = true
  ) {
    let storedApi = UserDefaults.standard.string(forKey: "groxbot.api")
    let storedWeb = UserDefaults.standard.string(forKey: "groxbot.web")
    let storedRemote =
      storedApi?.contains("whip.computer") == true
      || storedApi?.contains("groxbot.com") == true
    self.production = production
    self.apiOrigin = GroxbotOrigins.apiOrigin(
      explicit: apiOrigin
        ?? ProcessInfo.processInfo.environment["GROXBOT_API_URL"]
        ?? (storedRemote ? storedApi : nil),
      production: production
    )
    self.webOrigin = GroxbotOrigins.webOrigin(
      explicit: webOrigin
        ?? ProcessInfo.processInfo.environment["GROXBOT_WEB_URL"]
        ?? (storedRemote ? storedWeb : nil),
      production: production
    )
    self.cookie = UserDefaults.standard.string(forKey: "groxbot.cookie") ?? ""
    self.workspaceId = UserDefaults.standard.string(forKey: "groxbot.workspace")
  }

  var client: OrpcClient {
    OrpcClient(apiOrigin: apiOrigin, cookie: cookie, workspaceId: workspaceId)
  }

  var auth: AuthClient {
    AuthClient(apiOrigin: apiOrigin, requestOrigin: webOrigin)
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

  func createSection(name: String) async {
    let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return }
    do {
      _ = try await client.sectionsCreate(name: trimmed)
      await refreshRoster()
    } catch {
      self.error = UserFacingError.message(error, fallback: "Could not create that section")
    }
  }

  func refreshRoster() async {
    do {
      async let botsJson = client.botsList()
      async let roomsJson = client.roomsList()
      async let sectionsJson = client.sectionsList()
      async let workspacesJson = client.workspacesList()
      bots = JSONList.bots(try await botsJson)
      rooms = JSONList.rooms(try await roomsJson)
      sections = JSONList.sections(try await sectionsJson)
      workspaces = JSONList.workspaces(try await workspacesJson)
    } catch {
      self.error = UserFacingError.message(error, fallback: "Could not load the office")
    }
  }

  func sendMagicLink(email: String) async -> Bool {
    error = ""
    do {
      let jar = try await auth.sendMagicLink(
        email: email,
        callbackURL: URL(string: webOrigin) ?? GroxbotOrigins.callbackURL()
      )
      if !jar.cookie.isEmpty { cookie = jar.cookie }
      return true
    } catch {
      self.error = UserFacingError.message(error, fallback: "Could not send a sign-in link")
      return false
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

  func activateWorkspace(id: String) async -> Bool {
    error = ""
    do {
      let activated = try await client.workspacesActivate(id: id)
      workspaceId = activated["id"]?.string ?? id
      await refreshSession()
      await refreshRoster()
      return true
    } catch {
      self.error = UserFacingError.message(error, fallback: "Could not switch workspace")
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

  func togglePin(_ bot: Bot) async {
    do {
      if bot.isPinned {
        _ = try await client.botsUnpin(id: bot.id)
      } else {
        _ = try await client.botsPin(id: bot.id)
      }
      await refreshRoster()
    } catch {
      self.error = UserFacingError.message(error, fallback: "Could not update that pin")
    }
  }

  func signOut() async {
    try? await auth.signOut(cookie: cookie)
    dropOffices()
    cookie = ""
    me = nil
    bots = []
    rooms = []
    signedIn = false
  }

  func officeKey(for bot: Bot) -> String {
    bot.homeRoomId.isEmpty ? bot.id : bot.homeRoomId
  }

  func office(for bot: Bot) -> OfficeController {
    let key = officeKey(for: bot)
    if let existing = offices[key] { return existing }
    let next = OfficeController()
    offices[key] = next
    return next
  }

  func prefetchOffice(for bot: Bot) {
    let controller = office(for: bot)
    Task {
      await controller.ensureConnected(
        url: officeURL(for: bot),
        origin: webOrigin,
        cookie: cookie,
        workspaceId: workspaceId
      )
    }
  }

  func dropOffices() {
    offices.values.forEach { $0.disconnect() }
    offices.removeAll()
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
      workspaceId: workspaceId
    )
  }
}
