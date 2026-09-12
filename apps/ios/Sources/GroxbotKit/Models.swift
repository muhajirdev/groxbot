import Foundation

public struct Bot: Sendable, Equatable, Hashable, Identifiable {
  public var id: String
  public var workspaceId: String
  public var userId: String
  public var visibility: String
  public var name: String
  public var title: String
  public var description: String
  public var instructions: String
  public var avatarColor: String
  public var avatarShape: String
  public var parentBotId: String?
  public var threadId: String
  public var homeRoomId: String
  public var guestKind: String
  public var guestOnline: Bool
  public var model: String
  public var effort: String
  public var lastPreview: String
  public var lastAt: String
  public var archivedAt: String?
  public var pinnedAt: String?
  public var sectionId: String?
  public var createdAt: String
  public var updatedAt: String

  public init(
    id: String,
    workspaceId: String,
    userId: String = "",
    visibility: String = "shared",
    name: String,
    title: String = "",
    description: String = "",
    instructions: String = "",
    avatarColor: String = "#e45c9a",
    avatarShape: String = "circle",
    parentBotId: String? = nil,
    threadId: String? = nil,
    homeRoomId: String? = nil,
    guestKind: String = "off",
    guestOnline: Bool = false,
    model: String = "",
    effort: String = "",
    lastPreview: String = "",
    lastAt: String = "",
    archivedAt: String? = nil,
    pinnedAt: String? = nil,
    sectionId: String? = nil,
    createdAt: String = "",
    updatedAt: String = ""
  ) {
    self.id = id
    self.workspaceId = workspaceId
    self.userId = userId
    self.visibility = visibility
    self.name = name
    self.title = title
    self.description = description
    self.instructions = instructions
    self.avatarColor = avatarColor
    self.avatarShape = avatarShape
    self.parentBotId = parentBotId
    self.threadId = threadId ?? id
    self.homeRoomId = homeRoomId ?? id
    self.guestKind = guestKind
    self.guestOnline = guestOnline
    self.model = model
    self.effort = effort
    self.lastPreview = lastPreview
    self.lastAt = lastAt
    self.archivedAt = archivedAt
    self.pinnedAt = pinnedAt
    self.sectionId = sectionId
    self.createdAt = createdAt
    self.updatedAt = updatedAt
  }

  public init?(_ json: JSONValue) {
    guard let id = json["id"]?.string, let name = json["name"]?.string else { return nil }
    self.init(
      id: id,
      workspaceId: json["workspaceId"]?.string ?? "",
      userId: json["userId"]?.string ?? "",
      visibility: json["visibility"]?.string ?? "shared",
      name: name,
      title: json["title"]?.string ?? "",
      description: json["description"]?.string ?? "",
      instructions: json["instructions"]?.string ?? "",
      avatarColor: json["avatarColor"]?.string ?? "#e45c9a",
      avatarShape: json["avatarShape"]?.string ?? "circle",
      parentBotId: json["parentBotId"]?.string,
      threadId: json["threadId"]?.string,
      homeRoomId: json["homeRoomId"]?.string,
      guestKind: json["guestKind"]?.string ?? "off",
      guestOnline: json["guestOnline"]?.bool ?? false,
      model: json["model"]?.string ?? "",
      effort: json["effort"]?.string ?? "",
      lastPreview: json["lastPreview"]?.string ?? "",
      lastAt: json["lastAt"]?.string ?? "",
      archivedAt: json["archivedAt"]?.string,
      pinnedAt: json["pinnedAt"]?.string,
      sectionId: json["sectionId"]?.string,
      createdAt: json["createdAt"]?.string ?? "",
      updatedAt: json["updatedAt"]?.string ?? ""
    )
  }

  public var isPinned: Bool { !(pinnedAt ?? "").isEmpty }
  public var isArchived: Bool { !(archivedAt ?? "").isEmpty }
}

public struct RoomMember: Sendable, Equatable, Hashable, Identifiable {
  public var botId: String
  public var homeRoomId: String
  public var name: String
  public var title: String
  public var avatarColor: String
  public var avatarShape: String
  public var archivedAt: String?
  public var id: String { botId }

  public init?(_ json: JSONValue) {
    guard let botId = json["botId"]?.string, let name = json["name"]?.string else { return nil }
    self.botId = botId
    self.homeRoomId = json["homeRoomId"]?.string ?? ""
    self.name = name
    self.title = json["title"]?.string ?? ""
    self.avatarColor = json["avatarColor"]?.string ?? "#e45c9a"
    self.avatarShape = json["avatarShape"]?.string ?? "circle"
    self.archivedAt = json["archivedAt"]?.string
  }
}

public struct Room: Sendable, Equatable, Hashable, Identifiable {
  public var id: String
  public var workspaceId: String
  public var name: String
  public var description: String
  public var status: String
  public var members: [RoomMember]
  public var lastPreview: String
  public var lastAt: String

  public init?(_ json: JSONValue) {
    guard let id = json["id"]?.string, let name = json["name"]?.string else { return nil }
    self.id = id
    self.workspaceId = json["workspaceId"]?.string ?? ""
    self.name = name
    self.description = json["description"]?.string ?? ""
    self.status = json["status"]?.string ?? "todo"
    self.members = json["members"]?.array?.compactMap(RoomMember.init) ?? []
    self.lastPreview = json["lastPreview"]?.string ?? ""
    self.lastAt = json["lastAt"]?.string ?? ""
  }
}

public struct SidebarSection: Sendable, Equatable, Identifiable {
  public var id: String
  public var name: String
  public var position: Int

  public init?(_ json: JSONValue) {
    guard let id = json["id"]?.string, let name = json["name"]?.string else { return nil }
    self.id = id
    self.name = name
    self.position = json["position"]?.int ?? 0
  }
}

public struct Me: Sendable, Equatable {
  public var userId: String
  public var email: String
  public var name: String
  public var workspaceId: String?
  public var workspaceName: String?
  public var needsWorkspace: Bool
  public var needsModel: Bool
  public var needsHostedPlan: Bool
  public var isDeploymentOwner: Bool

  public init?(_ json: JSONValue) {
    guard let userId = json["userId"]?.string else { return nil }
    self.userId = userId
    self.email = json["email"]?.string ?? ""
    self.name = json["name"]?.string ?? ""
    self.workspaceId = json["workspaceId"]?.string
    self.workspaceName = json["workspaceName"]?.string
    self.needsWorkspace = json["needsWorkspace"]?.bool ?? false
    self.needsModel = json["needsModel"]?.bool ?? false
    self.needsHostedPlan = json["needsHostedPlan"]?.bool ?? false
    self.isDeploymentOwner = json["isDeploymentOwner"]?.bool ?? false
  }
}

public struct Health: Sendable, Equatable {
  public var ok: Bool
  public var oauth: [String]
  public var mail: String

  public init?(_ json: JSONValue) {
    self.ok = json["ok"]?.bool ?? false
    self.oauth = json["oauth"]?.array?.compactMap(\.string) ?? []
    self.mail = json["mail"]?.string ?? ""
  }

  public var googleReady: Bool { oauth.contains("google") }
  public var githubReady: Bool { oauth.contains("github") }
  public var mailLogged: Bool { mail == "log" }
}

public struct ComputerEntry: Sendable, Equatable {
  public var path: String
  public var kind: String
  public var size: Int?

  public init(path: String, kind: String, size: Int? = nil) {
    self.path = path
    self.kind = kind
    self.size = size
  }

  public init?(_ json: JSONValue) {
    guard let path = json["path"]?.string, let kind = json["kind"]?.string else { return nil }
    self.path = path
    self.kind = kind
    self.size = json["size"]?.int
  }
}

public struct KnowledgeEntry: Sendable, Equatable {
  public var path: String
  public var name: String
  public var title: String
  public var description: String
  public var encoding: String
  public var mediaType: String

  public init(
    path: String,
    name: String,
    title: String,
    description: String,
    encoding: String = "text",
    mediaType: String = "text/markdown"
  ) {
    self.path = path
    self.name = name
    self.title = title
    self.description = description
    self.encoding = encoding
    self.mediaType = mediaType
  }

  public init?(_ json: JSONValue) {
    guard let path = json["path"]?.string else { return nil }
    self.path = path
    self.name = json["name"]?.string ?? path
    self.title = json["title"]?.string ?? ""
    self.description = json["description"]?.string ?? ""
    self.encoding = json["encoding"]?.string ?? "text"
    self.mediaType = json["mediaType"]?.string ?? ""
  }
}

public struct WorkspaceApp: Sendable, Equatable, Identifiable {
  public var id: String
  public var title: String
  public var template: String

  public init?(_ json: JSONValue) {
    guard let id = json["id"]?.string else { return nil }
    self.id = id
    self.title = json["title"]?.string ?? json["name"]?.string ?? "App"
    self.template = json["template"]?.string ?? json["kind"]?.string ?? ""
  }
}

public enum JSONList {
  public static func array(_ json: JSONValue) -> [JSONValue] {
    json.array ?? []
  }

  public static func bots(_ json: JSONValue) -> [Bot] {
    array(json).compactMap(Bot.init)
  }

  public static func rooms(_ json: JSONValue) -> [Room] {
    array(json).compactMap(Room.init)
  }

  public static func sections(_ json: JSONValue) -> [SidebarSection] {
    array(json).compactMap(SidebarSection.init)
  }

  public static func computerEntries(_ json: JSONValue) -> [ComputerEntry] {
    (json["entries"]?.array ?? array(json)).compactMap(ComputerEntry.init)
  }

  public static func knowledgeEntries(_ json: JSONValue) -> [KnowledgeEntry] {
    (json["entries"]?.array ?? array(json)).compactMap(KnowledgeEntry.init)
  }

  public static func apps(_ json: JSONValue) -> [WorkspaceApp] {
    array(json).compactMap(WorkspaceApp.init)
  }
}
