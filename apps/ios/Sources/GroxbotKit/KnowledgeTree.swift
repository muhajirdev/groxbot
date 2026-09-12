import Foundation

public struct KnowledgeTreeNode: Sendable, Equatable, Identifiable {
  public var path: String
  public var name: String
  public var kind: String
  public var title: String
  public var description: String
  public var encoding: String?
  public var children: [KnowledgeTreeNode]
  public var id: String { path }

  public init(
    path: String,
    name: String,
    kind: String,
    title: String,
    description: String,
    encoding: String? = nil,
    children: [KnowledgeTreeNode] = []
  ) {
    self.path = path
    self.name = name
    self.kind = kind
    self.title = title
    self.description = description
    self.encoding = encoding
    self.children = children
  }
}

public enum KnowledgeTree {
  public static func nest(_ entries: [KnowledgeEntry]) -> [KnowledgeTreeNode] {
    final class Box {
      var node: KnowledgeTreeNode
      var children: [Box] = []
      init(_ node: KnowledgeTreeNode) { self.node = node }
      func freeze() -> KnowledgeTreeNode {
        var next = node
        next.children = children.map { $0.freeze() }
        return next
      }
    }
    var dirs: [String: Box] = [:]
    var roots: [Box] = []

    func dirBox(path: String, name: String) -> Box {
      if let existing = dirs[path] { return existing }
      let box = Box(
        KnowledgeTreeNode(path: path, name: name, kind: "dir", title: name, description: "")
      )
      dirs[path] = box
      return box
    }

    for entry in entries.sorted(by: { $0.path < $1.path }) {
      let parts = entry.path.split(separator: "/").map(String.init).filter { !$0.isEmpty }
      if parts.isEmpty { continue }
      for index in 0..<(parts.count - 1) {
        let dirPath = parts[0...index].joined(separator: "/")
        if dirs[dirPath] != nil { continue }
        let box = dirBox(path: dirPath, name: parts[index])
        if index == 0 {
          roots.append(box)
        } else {
          let parentPath = parts[0..<index].joined(separator: "/")
          dirs[parentPath]?.children.append(box)
        }
      }
      let leaf = Box(
        KnowledgeTreeNode(
          path: entry.path,
          name: entry.name,
          kind: "file",
          title: entry.title,
          description: entry.description,
          encoding: entry.encoding
        )
      )
      if parts.count == 1 {
        roots.append(leaf)
      } else {
        let parentPath = parts.dropLast().joined(separator: "/")
        dirs[parentPath]?.children.append(leaf)
      }
    }
    var frozen = roots.map { $0.freeze() }
    sort(&frozen)
    return frozen
  }

  public static func filter(_ nodes: [KnowledgeTreeNode], query: String) -> [KnowledgeTreeNode] {
    let needle = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    if needle.isEmpty { return nodes }
    var next: [KnowledgeTreeNode] = []
    for node in nodes {
      let selfMatch =
        node.name.lowercased().contains(needle)
        || node.title.lowercased().contains(needle)
        || node.description.lowercased().contains(needle)
      if selfMatch && node.kind != "dir" {
        next.append(node)
        continue
      }
      let children = filter(node.children, query: query)
      if !children.isEmpty || (selfMatch && node.kind == "dir") {
        var copy = node
        if !(selfMatch && node.kind == "dir") { copy.children = children }
        next.append(copy)
      }
    }
    return next
  }

  public static func officeSkills(_ entries: [KnowledgeEntry]) -> [(name: String, description: String)] {
    var seen = Set<String>()
    var skills: [(name: String, description: String)] = []
    for row in entries where isOfficeSkillPath(row.path) {
      let folder = row.path == "SKILL.md" ? "" : String(row.path.dropLast("/SKILL.md".count))
      let name = folder.split(separator: "/").filter { !$0.isEmpty }.last.map(String.init) ?? row.title
      if name.isEmpty || seen.contains(name) { continue }
      seen.insert(name)
      skills.append((name, row.description))
    }
    return skills
  }

  public static func isOfficeSkillPath(_ path: String) -> Bool {
    path == "SKILL.md" || path.hasSuffix("/SKILL.md")
  }

  public static func matchLearn(_ query: String) -> Bool {
    let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
    guard trimmed.hasPrefix("/") else { return false }
    let rest = String(trimmed.dropFirst())
    if rest.contains(where: { $0.isWhitespace }) { return false }
    let needle = rest.lowercased()
    if needle.isEmpty || needle == "skill" || needle == "skill:" { return true }
    if needle.hasPrefix("skill:") { return false }
    return "learn".hasPrefix(needle)
  }

  public static func matchSkills(
    _ query: String,
    skills: [(name: String, description: String)]
  ) -> [(name: String, description: String)] {
    let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
    guard trimmed.hasPrefix("/") else { return [] }
    let rest = String(trimmed.dropFirst())
    if rest.contains(where: { $0.isWhitespace }) { return [] }
    let needle = rest.lowercased()
    if needle.isEmpty || needle == "skill" || needle == "skill:" { return skills }
    let search = needle.hasPrefix("skill:") ? String(needle.dropFirst("skill:".count)) : needle
    if search.isEmpty { return skills }
    return skills.filter {
      $0.name.lowercased().contains(search) || $0.description.lowercased().contains(search)
    }
  }

  public static func searchStatus(
    query: String,
    fetching: Bool,
    hitCount: Int,
    fallbackCount: Int,
    kind: String = "library"
  ) -> (label: String, busy: Bool)? {
    if query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return nil }
    let playbooks = kind == "skills"
    if fetching && hitCount == 0 {
      return (playbooks ? "Searching playbooks…" : "Searching notes…", true)
    }
    if hitCount > 0 {
      let noun =
        playbooks
        ? (hitCount == 1 ? "playbook" : "playbooks")
        : (hitCount == 1 ? "note" : "notes")
      return (fetching ? "Searching… \(hitCount) \(noun)" : "\(hitCount) \(noun)", fetching)
    }
    if fallbackCount > 0 { return ("Matching names", fetching) }
    return fetching
      ? (playbooks ? "Searching playbooks…" : "Searching notes…", true)
      : nil
  }

  private static func sort(_ nodes: inout [KnowledgeTreeNode]) {
    nodes.sort {
      if $0.kind != $1.kind { return $0.kind == "dir" }
      return $0.name.localizedStandardCompare($1.name) == .orderedAscending
    }
    for index in nodes.indices { sort(&nodes[index].children) }
  }
}

public enum KnowledgeImport {
  public static let placeholder = "owner/repo or a GitHub URL"

  public static func summary(imported: [String], skipped: [String]) -> String {
    if imported.count == 1 && skipped.isEmpty {
      return "Imported /\(imported[0]) into skills/."
    }
    if !imported.isEmpty && skipped.isEmpty {
      return "Imported \(imported.count) playbooks into skills/."
    }
    if imported.isEmpty && !skipped.isEmpty {
      return "Nothing new to import."
    }
    return "Imported \(imported.count). Skipped \(skipped.count)."
  }
}
