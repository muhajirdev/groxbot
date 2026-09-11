import Foundation
import GroxbotKit
import Testing

@Suite("Sidebar")
struct SidebarTests {
  @Test func pinnedAboveRest() {
    let pinned = Bot(
      id: "p", workspaceId: "ws", name: "P",
      lastAt: "2026-08-01T00:00:00.000Z", pinnedAt: "2026-09-01T10:00:00.000Z"
    )
    let recent = Bot(
      id: "r", workspaceId: "ws", name: "R",
      lastAt: "2026-09-01T12:00:00.000Z"
    )
    #expect(Sidebar.compare(pinned, recent))
  }

  @Test func firstLiveSkipsArchived() {
    let archived = Bot(id: "a", workspaceId: "ws", name: "A", archivedAt: "2026-08-01T00:00:00.000Z")
    let live = Bot(id: "b", workspaceId: "ws", name: "B")
    #expect(Sidebar.firstLive([archived, live])?.id == "b")
  }

  @Test func sortRosterHidesArchivedAndPinsFirst() {
    let ranked = Sidebar.sortRoster([
      Bot(id: "1", workspaceId: "ws", name: "Old", lastAt: "2026-07-01T00:00:00.000Z"),
      Bot(
        id: "2", workspaceId: "ws", name: "Pin",
        lastAt: "2026-08-01T00:00:00.000Z", pinnedAt: "2026-09-01T08:00:00.000Z"
      ),
      Bot(
        id: "3", workspaceId: "ws", name: "Gone",
        lastAt: "2026-09-01T00:00:00.000Z", archivedAt: "2026-09-01T00:00:00.000Z"
      ),
    ])
    #expect(ranked.count == 2)
    #expect(ranked.first?.isPinned == true)
    #expect(ranked.allSatisfy { !$0.isArchived })
  }

  @Test func filterRoomsAndRoster() {
    let rooms = [
      Room.from(name: "Standup", lastPreview: "done", description: "daily"),
      Room.from(name: "Launch", lastPreview: "blocked", description: ""),
    ]
    #expect(Sidebar.filterRooms(rooms, query: "stand").map(\.name) == ["Standup"])
    #expect(Sidebar.filterRooms(rooms, query: "BLOCKED").map(\.name) == ["Launch"])
    let bots = [
      Bot(id: "1", workspaceId: "ws", name: "Reja", title: "Chief of Staff", lastPreview: "done"),
      Bot(id: "2", workspaceId: "ws", name: "Piper", title: "Talent Scout", lastPreview: "shortlist"),
    ]
    #expect(Sidebar.filterRoster(bots, query: "reja").map(\.name) == ["Reja"])
    #expect(Sidebar.filterRoster(bots, query: "scout").map(\.name) == ["Piper"])
  }
}

extension Room {
  fileprivate static func from(name: String, lastPreview: String, description: String) -> Room {
    Room(
      JSONValue.object([
        "id": .string(name.lowercased()),
        "workspaceId": .string("ws"),
        "name": .string(name),
        "description": .string(description),
        "status": .string("todo"),
        "members": .array([]),
        "lastPreview": .string(lastPreview),
        "lastAt": .string("2026-09-01T00:00:00.000Z"),
      ])
    )!
  }
}

@Suite("Computer tree")
struct ComputerTreeTests {
  @Test func nestsFilesUnderFolders() {
    let tree = ComputerTree.nest([
      ComputerEntry(path: "memory.md", kind: "file"),
      ComputerEntry(path: "skills", kind: "dir"),
      ComputerEntry(path: "skills/digest", kind: "dir"),
      ComputerEntry(path: "skills/digest/SKILL.md", kind: "file"),
    ])
    #expect(tree[0].name == "skills")
    #expect(tree[1].name == "memory.md")
    #expect(tree[0].children[0].name == "digest")
    #expect(tree[0].children[0].children[0].name == "SKILL.md")
  }

  @Test func filterKeepsFoldersWithMatch() {
    let tree = ComputerTree.nest([
      ComputerEntry(path: "skills", kind: "dir"),
      ComputerEntry(path: "skills/SKILL.md", kind: "file"),
      ComputerEntry(path: "notes.txt", kind: "file"),
    ])
    #expect(ComputerTree.filter(tree, query: "skill").map(\.name) == ["skills"])
  }
}

@Suite("Computer preview")
struct ComputerPreviewTests {
  @Test func classifies() {
    #expect(ComputerPreview.kind("inbox/shot.png") == .image)
    #expect(ComputerPreview.kind("notes.md") == .text)
    #expect(ComputerPreview.kind("page.html") == .html)
    #expect(ComputerPreview.kind("invoice.pdf") == .pdf)
    #expect(ComputerPreview.kind("archive.zip") == .none)
  }

  @Test func mediaTypeWins() {
    #expect(ComputerPreview.kind("mystery", mediaType: "image/png") == .image)
    #expect(ComputerPreview.kind("mystery", mediaType: "application/pdf") == .pdf)
  }

  @Test func source() {
    #expect(ComputerPreview.source(.text) == .read)
    #expect(ComputerPreview.source(.pdf) == .download)
    #expect(ComputerPreview.source(.image) == .download)
  }
}

@Suite("Knowledge")
struct KnowledgeTests {
  @Test func officeSkills() {
    let skills = KnowledgeTree.officeSkills([
      KnowledgeEntry(
        path: "digest/SKILL.md",
        name: "SKILL.md",
        title: "Weekly digest",
        description: "Summarize the week."
      )
    ])
    #expect(skills.map(\.name) == ["digest"])
    #expect(skills.first?.description == "Summarize the week.")
  }

  @Test func matchSlashSkills() {
    let skills = [("digest", "Summarize the week.")]
    #expect(KnowledgeTree.matchSkills("/di", skills: skills).map(\.name) == ["digest"])
    #expect(KnowledgeTree.matchSkills("digest", skills: skills).isEmpty)
    #expect(KnowledgeTree.matchSkills("/nope", skills: skills).isEmpty)
  }

  @Test func searchStatus() {
    let searching = KnowledgeTree.searchStatus(
      query: "standup", fetching: true, hitCount: 0, fallbackCount: 2
    )
    #expect(searching?.label == "Searching notes…")
    #expect(searching?.busy == true)
    let hits = KnowledgeTree.searchStatus(
      query: "standup", fetching: false, hitCount: 3, fallbackCount: 0
    )
    #expect(hits?.label == "3 notes")
    let names = KnowledgeTree.searchStatus(
      query: "standup", fetching: false, hitCount: 0, fallbackCount: 2
    )
    #expect(names?.label == "Matching names")
  }

  @Test func matchLearn() {
    #expect(KnowledgeTree.matchLearn("/"))
    #expect(KnowledgeTree.matchLearn("/learn"))
    #expect(!KnowledgeTree.matchLearn("/learn the docs"))
  }

  @Test func importSummary() {
    #expect(KnowledgeImport.summary(imported: ["digest"], skipped: []) == "Imported /digest into skills/.")
  }

  @Test func nestsLibrary() {
    let tree = KnowledgeTree.nest([
      KnowledgeEntry(path: "digest/SKILL.md", name: "SKILL.md", title: "Weekly digest", description: "")
    ])
    #expect(tree.first?.name == "digest")
    #expect(tree.first?.children.first?.name == "SKILL.md")
  }
}
