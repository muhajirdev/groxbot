import Foundation

public enum Invite {
  public static func fromHref(_ href: String) -> String? {
    let trimmed = href.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.isEmpty { return nil }
    if let url = URL(string: trimmed), let invite = queryInvite(url) {
      return invite
    }
    if let url = URL(string: "https://groxbot.local" + (trimmed.hasPrefix("/") ? trimmed : "/\(trimmed)")),
      let invite = queryInvite(url)
    {
      return invite
    }
    if let match = trimmed.range(of: #"[?&]invite=([^&]+)"#, options: .regularExpression) {
      let raw = String(trimmed[match])
      let value = raw.split(separator: "=").last.map(String.init) ?? ""
      return value.removingPercentEncoding ?? value
    }
    return nil
  }

  public static func invitationId(from raw: String) -> String {
    let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.isEmpty { return "" }
    return fromHref(trimmed) ?? trimmed
  }

  private static func queryInvite(_ url: URL) -> String? {
    URLComponents(url: url, resolvingAgainstBaseURL: false)?
      .queryItems?
      .first(where: { $0.name == "invite" })?
      .value?
      .trimmingCharacters(in: .whitespacesAndNewlines)
      .nilIfEmpty
  }
}

extension String {
  fileprivate var nilIfEmpty: String? { isEmpty ? nil : self }
}
