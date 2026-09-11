import Foundation

public struct ComputerTreeNode: Sendable, Equatable, Identifiable {
  public var path: String
  public var name: String
  public var kind: String
  public var size: Int?
  public var children: [ComputerTreeNode]
  public var id: String { path }

  public init(
    path: String,
    name: String,
    kind: String,
    size: Int? = nil,
    children: [ComputerTreeNode] = []
  ) {
    self.path = path
    self.name = name
    self.kind = kind
    self.size = size
    self.children = children
  }
}

public enum ComputerTree {
  public static func nest(_ entries: [ComputerEntry]) -> [ComputerTreeNode] {
    final class Box {
      var node: ComputerTreeNode
      var children: [Box] = []
      init(_ node: ComputerTreeNode) { self.node = node }
      func freeze() -> ComputerTreeNode {
        var next = node
        next.children = children.map { $0.freeze() }
        return next
      }
    }
    var dirs: [String: Box] = [:]
    var root: [Box] = []
    for entry in entries.sorted(by: { $0.path < $1.path }) {
      let parts = entry.path.split(separator: "/").map(String.init).filter { !$0.isEmpty }
      let box = Box(
        ComputerTreeNode(
          path: entry.path,
          name: parts.last ?? entry.path,
          kind: entry.kind,
          size: entry.size
        )
      )
      if entry.kind == "dir" { dirs[entry.path] = box }
      let parentPath = parts.dropLast().joined(separator: "/")
      if !parentPath.isEmpty, let parent = dirs[parentPath] {
        parent.children.append(box)
      } else {
        root.append(box)
      }
    }
    var frozen = root.map { $0.freeze() }
    sort(&frozen)
    return frozen
  }

  public static func filter(_ nodes: [ComputerTreeNode], query: String) -> [ComputerTreeNode] {
    let needle = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    if needle.isEmpty { return nodes }
    var next: [ComputerTreeNode] = []
    for node in nodes {
      if node.name.lowercased().contains(needle) {
        next.append(node)
        continue
      }
      let children = filter(node.children, query: query)
      if !children.isEmpty {
        var copy = node
        copy.children = children
        next.append(copy)
      }
    }
    return next
  }

  private static func sort(_ nodes: inout [ComputerTreeNode]) {
    nodes.sort {
      if $0.kind != $1.kind { return $0.kind == "dir" }
      return $0.name.localizedStandardCompare($1.name) == .orderedAscending
    }
    for index in nodes.indices {
      sort(&nodes[index].children)
    }
  }
}

public enum ComputerPreview {
  public enum Kind: String, Sendable {
    case html, pdf, image, text, none
  }

  public enum Source: String, Sendable {
    case read, download, none
  }

  public static func filename(_ path: String) -> String {
    path.replacingOccurrences(of: "\\", with: "/").split(separator: "/").last.map(String.init)?
      .trimmingCharacters(in: .whitespacesAndNewlines) ?? "file"
  }

  public static func `extension`(_ path: String) -> String {
    let name = filename(path)
    guard let index = name.lastIndex(of: ".") else { return "" }
    return String(name[index...]).lowercased()
  }

  public static func kind(_ path: String, mediaType: String = "") -> Kind {
    let trimmed = path.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.isEmpty { return .none }
    let media = mediaType.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    if media == "text/html" || media == "application/xhtml+xml" { return .html }
    if media == "application/pdf" { return .pdf }
    if media.hasPrefix("image/") { return .image }
    if media.hasPrefix("text/") || media == "application/json" || media == "application/xml"
      || media.hasSuffix("+json") || media.hasSuffix("+xml")
    {
      return .text
    }
    let ext = `extension`(path)
    if ext == ".html" || ext == ".htm" { return .html }
    if ext == ".pdf" { return .pdf }
    if [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"].contains(ext) { return .image }
    if ext == ".md" || ext == ".markdown" { return .text }
    let textExts: Set<String> = [
      ".bash", ".css", ".csv", ".env", ".js", ".json", ".jsx", ".log", ".markdown", ".md",
      ".mjs", ".py", ".sh", ".toml", ".ts", ".tsx", ".txt", ".xml", ".yaml", ".yml",
    ]
    if ext.isEmpty || textExts.contains(ext) { return .text }
    return .none
  }

  public static func source(_ kind: Kind) -> Source {
    switch kind {
    case .none: return .none
    case .pdf, .image: return .download
    case .html, .text: return .read
    }
  }
}
