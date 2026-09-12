import Foundation

public enum Sidebar {
  public static func isPinned(_ bot: Bot) -> Bool { bot.isPinned }
  public static func isArchived(_ bot: Bot) -> Bool { bot.isArchived }

  public static func firstLive(_ bots: [Bot]) -> Bot? {
    bots.first(where: { !$0.isArchived }) ?? bots.first
  }

  public static func compare(_ a: Bot, _ b: Bot) -> Bool {
    if a.isPinned != b.isPinned { return a.isPinned && !b.isPinned }
    return (GroxbotDates.parse(a.lastAt)?.timeIntervalSince1970 ?? 0)
      > (GroxbotDates.parse(b.lastAt)?.timeIntervalSince1970 ?? 0)
  }

  public static func sortRoster(_ bots: [Bot]) -> [Bot] {
    bots.filter { !$0.isArchived }.sorted(by: compare)
  }

  public static func sortArchived(_ bots: [Bot]) -> [Bot] {
    bots.filter(\.isArchived).sorted(by: compare)
  }

  public static func filterRoster(_ bots: [Bot], query: String) -> [Bot] {
    let needle = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    if needle.isEmpty { return bots }
    return bots.filter {
      "\($0.name) \($0.title) \($0.lastPreview)".lowercased().contains(needle)
    }
  }

  public static func filterRooms(_ rooms: [Room], query: String) -> [Room] {
    let needle = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    if needle.isEmpty { return rooms }
    return rooms.filter {
      "\($0.name) \($0.lastPreview) \($0.description)".lowercased().contains(needle)
    }
  }

  public static func mixLive(bots: [Bot], rooms: [Room]) -> [SidebarItem] {
    var items: [SidebarItem] =
      bots.map { .bot($0) } + rooms.map { .room($0) }
    items.sort { left, right in
      compare(left.asBotKey, right.asBotKey)
    }
    return items
  }

  public static func group(
    liveBots: [Bot],
    sections: [SidebarSection]
  ) -> (ungrouped: [Bot], sections: [(section: SidebarSection, bots: [Bot])]) {
    let ordered = sections.sorted {
      if $0.position != $1.position { return $0.position < $1.position }
      return $0.id < $1.id
    }
    var bySection: [String: [Bot]] = [:]
    for section in ordered { bySection[section.id] = [] }
    var ungrouped: [Bot] = []
    for bot in liveBots {
      let sectionId = bot.sectionId?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
      if !sectionId.isEmpty, var bucket = bySection[sectionId] {
        bucket.append(bot)
        bySection[sectionId] = bucket
      } else {
        ungrouped.append(bot)
      }
    }
    return (
      ungrouped.sorted(by: compare),
      ordered.map { section in
        (section, (bySection[section.id] ?? []).sorted(by: compare))
      }
    )
  }

  public static func roomFaces(_ members: [RoomMember], limit: Int = 3) -> [RoomMember] {
    let live = members.filter { ($0.archivedAt ?? "").isEmpty }
    return Array((live.isEmpty ? members : live).prefix(limit))
  }

}

public enum SidebarItem: Sendable, Equatable, Identifiable {
  case bot(Bot)
  case room(Room)

  public var id: String {
    switch self {
    case .bot(let bot): "bot-\(bot.id)"
    case .room(let room): "room-\(room.id)"
    }
  }

  var asBotKey: Bot {
    switch self {
    case .bot(let bot): return bot
    case .room(let room):
      return Bot(id: room.id, workspaceId: room.workspaceId, name: room.name, lastAt: room.lastAt)
    }
  }
}

