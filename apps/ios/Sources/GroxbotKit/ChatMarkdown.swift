import Foundation

public enum ChatMarkdown {
  public enum Block: Sendable, Equatable, Identifiable {
    case heading(String)
    case paragraph(String)
    case bullets([String])

    public var id: String {
      switch self {
      case .heading(let text): return "h:\(text)"
      case .paragraph(let text): return "p:\(text)"
      case .bullets(let items): return "b:\(items.joined(separator: "|"))"
      }
    }
  }

  public static func blocks(_ text: String) -> [Block] {
    let lines = text.replacingOccurrences(of: "\r\n", with: "\n").split(
      separator: "\n",
      omittingEmptySubsequences: false
    ).map(String.init)
    var out: [Block] = []
    var paragraph: [String] = []
    var bullets: [String] = []

    func flushParagraph() {
      let next = paragraph.joined(separator: " ").trimmingCharacters(in: .whitespacesAndNewlines)
      if !next.isEmpty { out.append(.paragraph(next)) }
      paragraph = []
    }

    func flushBullets() {
      if !bullets.isEmpty { out.append(.bullets(bullets)) }
      bullets = []
    }

    for line in lines {
      let trimmed = line.trimmingCharacters(in: .whitespaces)
      if trimmed.isEmpty {
        flushParagraph()
        flushBullets()
        continue
      }
      if trimmed.hasPrefix("#") {
        flushParagraph()
        flushBullets()
        let heading = trimmed.drop(while: { $0 == "#" }).trimmingCharacters(in: .whitespaces)
        if !heading.isEmpty { out.append(.heading(heading)) }
        continue
      }
      if let item = bulletItem(trimmed) {
        flushParagraph()
        bullets.append(item)
        continue
      }
      flushBullets()
      paragraph.append(trimmed)
    }
    flushParagraph()
    flushBullets()
    return out
  }

  public static func inline(_ text: String) -> AttributedString {
    let linked = linkifyFiles(text)
    let options = AttributedString.MarkdownParsingOptions(
      interpretedSyntax: .inlineOnlyPreservingWhitespace
    )
    return (try? AttributedString(markdown: linked, options: options)) ?? AttributedString(text)
  }

  private static func bulletItem(_ line: String) -> String? {
    for prefix in ["- ", "* ", "• "] {
      if line.hasPrefix(prefix) {
        return String(line.dropFirst(prefix.count))
      }
    }
    if let match = try? NSRegularExpression(pattern: #"^\d+[.)]\s+"#),
      let found = match.firstMatch(in: line, range: NSRange(location: 0, length: (line as NSString).length)),
      found.range.length > 0
    {
      return (line as NSString).substring(from: found.range.length)
    }
    return nil
  }

  private static func linkifyFiles(_ text: String) -> String {
    guard let regex = try? NSRegularExpression(pattern: "`([^`]+)`") else { return text }
    let ns = text as NSString
    var next = text
    for match in regex.matches(in: text, range: NSRange(location: 0, length: ns.length)).reversed() {
      let inner = ns.substring(with: match.range(at: 1))
      guard let path = OfficePath.fileHint(inner),
        let url = OfficePath.fileURL(path: path)
      else { continue }
      next = (next as NSString).replacingCharacters(
        in: match.range,
        with: "[\(inner)](\(url.absoluteString))"
      )
    }
    return next
  }
}
