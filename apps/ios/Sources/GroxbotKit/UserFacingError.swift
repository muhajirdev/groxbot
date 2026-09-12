import Foundation

public enum UserFacingError {
  public static let genericHTTP: Set<String> = [
    "Bad Request",
    "Precondition Failed",
    "Unauthorized",
    "Internal Server Error",
  ]

  public static func message(_ error: Error, fallback: String) -> String {
    if let orpc = error as? OrpcError {
      return humanize(orpc.message, fallback: fallback)
    }
    let text = error.localizedDescription.trimmingCharacters(in: .whitespacesAndNewlines)
    if text.isEmpty { return fallback }
    return humanize(text, fallback: fallback)
  }

  public static func humanize(_ raw: String, fallback: String = "") -> String {
    let text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    if genericHTTP.contains(text) { return fallback.isEmpty ? text : fallback }
    if text.range(of: #"^Agent run was aborted \(submission [^)]+\)\.?$"#, options: .regularExpression) != nil {
      return "Stopped."
    }
    if text.range(of: #"^Agent run failed \(submission [^)]+\)\.?$"#, options: .regularExpression) != nil {
      return "The model run failed. Pick another model in Settings."
    }
    if let match = firstMatch(text, #"^Unknown model ID "([^"]+)" for provider "([^"]+)""#) {
      return "Model “\(match[0])” isn’t available for \(match[1]). Pick another model in Settings."
    }
    if let match = firstMatch(text, #"Provider is not configured:\s*(\S+)"#) {
      return "\(match[0]) isn’t configured. Add a key in Settings."
    }
    if text.range(of: #"^error code:\s*\d+"#, options: [.regularExpression, .caseInsensitive]) != nil {
      return "Could not reach this teammate. Try sending again."
    }
    if text.range(
      of: "failed to fetch|network request failed",
      options: [.regularExpression, .caseInsensitive]
    ) != nil {
      return "Could not reach the office API."
    }
    if text.range(
      of: "message too long|couldn.?t be completed|timed? ?out|The operation could",
      options: [.regularExpression, .caseInsensitive]
    ) != nil {
      return fallback.isEmpty ? "Could not reach this teammate. Try sending again." : fallback
    }
    return text
  }

  private static func firstMatch(_ text: String, _ pattern: String) -> [String]? {
    guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else {
      return nil
    }
    let range = NSRange(text.startIndex..., in: text)
    guard let match = regex.firstMatch(in: text, range: range) else { return nil }
    var parts: [String] = []
    for index in 1..<match.numberOfRanges {
      guard let range = Range(match.range(at: index), in: text) else { continue }
      parts.append(String(text[range]))
    }
    return parts.isEmpty ? nil : parts
  }
}
