import Foundation

public enum Hire {
  public static let newBotName = "New Bot"
  public static let avatarColors = [
    "#e45c9a", "#5b7cff", "#e25d4a", "#2f9e6d", "#d9a441",
    "#8b6ccf", "#d46aa0", "#3aa0b8", "#4d5568",
  ]
  public static let suggestedJobs = [
    "Chief of Staff",
    "Talent Scout",
    "Expense Manager",
    "Bug Reproduction",
    "Product Performance",
    "Sales Outbound",
  ]
  public static let firstHire = "Chief of Staff"
  public static let firstTask =
    "Summarize this conversation starter in five bullets. List every date, decision, and open question. Do not invent sources."

  public static func nextName(_ bots: [Bot]) -> String {
    let taken = Set(bots.map(\.name))
    if !taken.contains(newBotName) { return newBotName }
    for n in 2..<1000 {
      let name = "\(newBotName) \(n)"
      if !taken.contains(name) { return name }
    }
    return newBotName
  }

  public static func nextAvatarColor(_ bots: [Bot]) -> String {
    let used = Set(bots.map(\.avatarColor))
    return avatarColors.first { !used.contains($0) }
      ?? avatarColors[bots.count % avatarColors.count]
  }

  public static func draftCreatedBot(
    id: String,
    workspaceId: String,
    name: String,
    avatarColor: String,
    homeRoomId: String? = nil,
    userId: String = "user",
    visibility: String = "shared"
  ) -> Bot {
    let now = GroxbotDates.nowString()
    return Bot(
      id: id,
      workspaceId: workspaceId,
      userId: userId,
      visibility: visibility,
      name: name,
      avatarColor: avatarColor,
      threadId: id,
      homeRoomId: homeRoomId ?? id,
      createdAt: now,
      updatedAt: now
    )
  }
}

public enum ListTime {
  private static func timeFormatter() -> DateFormatter {
    let formatter = DateFormatter()
    formatter.dateStyle = .none
    formatter.timeStyle = .short
    return formatter
  }

  private static func dayFormatter() -> DateFormatter {
    let formatter = DateFormatter()
    formatter.setLocalizedDateFormatFromTemplate("MMMd")
    return formatter
  }

  public static func format(_ iso: String, now: Date = Date()) -> String {
    guard let date = parse(iso) else { return "" }
    let seconds = now.timeIntervalSince(date)
    if seconds >= 0, seconds < 120 { return "Now" }
    if Calendar.current.isDate(date, inSameDayAs: now) {
      return timeFormatter().string(from: date)
    }
    if let yesterday = Calendar.current.date(byAdding: .day, value: -1, to: now),
      Calendar.current.isDate(date, inSameDayAs: yesterday)
    {
      return "Yesterday"
    }
    if let days = Calendar.current.dateComponents([.day], from: date, to: now).day, days > 1, days < 7 {
      let weekday = DateFormatter()
      weekday.setLocalizedDateFormatFromTemplate("EEE")
      return weekday.string(from: date)
    }
    return dayFormatter().string(from: date)
  }

  public static func parse(_ iso: String) -> Date? {
    GroxbotDates.parse(iso)
  }
}

