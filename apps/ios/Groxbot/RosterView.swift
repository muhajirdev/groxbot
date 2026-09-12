import SwiftUI
import GroxbotKit

struct RosterView: View {
  @EnvironmentObject private var model: AppModel
  @State private var query = ""
  @State private var showArchived = false

  var body: some View {
    let live = Sidebar.filterRoster(Sidebar.sortRoster(model.bots), query: query)
    let grouped = Sidebar.group(liveBots: live, sections: model.sections)
    let mixed = Sidebar.mixLive(
      bots: grouped.ungrouped,
      rooms: Sidebar.filterRooms(model.rooms, query: query)
    )
    let archived = showArchived ? Sidebar.filterRoster(Sidebar.sortArchived(model.bots), query: query) : []

    List {
      if !model.error.isEmpty {
        Text(model.error).foregroundStyle(Theme.danger).listRowBackground(Theme.bg)
      }
      ForEach(grouped.sections, id: \.section.id) { bucket in
        if !bucket.bots.isEmpty {
          Section(bucket.section.name) {
            ForEach(bucket.bots) { bot in
              NavigationLink(value: bot) { BotRow(bot: bot) }
            }
          }
        }
      }
      Section {
        ForEach(Array(mixed.enumerated()), id: \.offset) { _, item in
          switch item {
          case .bot(let bot):
            NavigationLink(value: bot) { BotRow(bot: bot) }
          case .room(let room):
            NavigationLink(value: room) { RoomRow(room: room) }
          }
        }
      }
      if !archived.isEmpty {
        Section("Archived") {
          ForEach(archived) { bot in
            NavigationLink(value: bot) { BotRow(bot: bot) }
          }
        }
      }
    }
    .listStyle(.plain)
    .scrollContentBackground(.hidden)
    .background(Theme.bg)
    .searchable(text: $query, prompt: "Search teammates")
    .navigationTitle("Office")
    .toolbar {
      ToolbarItem(placement: .topBarLeading) {
        NavigationLink("You") { YouView() }
      }
      ToolbarItem(placement: .topBarTrailing) {
        Menu {
          NavigationLink("Hire") { HireView() }
          NavigationLink("Room") { CreateRoomView() }
          NavigationLink("Knowledge") { KnowledgeView() }
          Button(showArchived ? "Hide archived" : "Show archived") {
            showArchived.toggle()
          }
        } label: {
          Image(systemName: "plus")
        }
      }
    }
    .navigationDestination(for: Bot.self) { bot in
      ThreadView(bot: bot)
    }
    .navigationDestination(for: Room.self) { room in
      RoomDetailView(room: room)
    }
    .refreshable { await model.refreshRoster() }
    .task { await model.refreshRoster() }
  }
}

struct BotRow: View {
  var bot: Bot
  var body: some View {
    HStack(spacing: 12) {
      AvatarView(name: bot.name, color: bot.avatarColor, shape: bot.avatarShape)
      VStack(alignment: .leading, spacing: 2) {
        HStack {
          Text(bot.name).foregroundStyle(Theme.text).font(.headline)
          if bot.isPinned { Image(systemName: "pin.fill").font(.caption2).foregroundStyle(Theme.muted) }
        }
        Text(bot.title.isEmpty ? "Teammate" : bot.title)
          .font(.subheadline)
          .foregroundStyle(Theme.muted)
        if !bot.lastPreview.isEmpty {
          Text(bot.lastPreview).font(.footnote).foregroundStyle(Theme.muted).lineLimit(1)
        }
      }
      Spacer()
      Text(ListTime.format(bot.lastAt)).font(.caption).foregroundStyle(Theme.muted)
    }
    .listRowBackground(Theme.bg)
  }
}

struct RoomRow: View {
  var room: Room
  var body: some View {
    HStack(spacing: 12) {
      ZStack {
        ForEach(Array(Sidebar.roomFaces(room.members).enumerated()), id: \.offset) { index, member in
          AvatarView(name: member.name, color: member.avatarColor, shape: member.avatarShape, size: 28)
            .offset(x: CGFloat(index) * 10)
        }
      }
      .frame(width: 56, alignment: .leading)
      VStack(alignment: .leading, spacing: 2) {
        Text(room.name).foregroundStyle(Theme.text).font(.headline)
        Text(room.status.replacingOccurrences(of: "_", with: " "))
          .font(.subheadline)
          .foregroundStyle(Theme.muted)
      }
      Spacer()
    }
    .listRowBackground(Theme.bg)
  }
}

struct HireView: View {
  @EnvironmentObject private var model: AppModel
  @Environment(\.dismiss) private var dismiss
  @State private var name = Hire.nextName([])
  @State private var asPrivate = false

  var body: some View {
    Form {
      TextField("Name", text: $name)
      Toggle("Private", isOn: $asPrivate)
      if !model.error.isEmpty { Text(model.error).foregroundStyle(Theme.danger) }
      Button("Hire") {
        Task {
          if let bot = await model.hire(
            name: name,
            visibility: asPrivate ? "private" : "shared"
          ) {
            dismiss()
            _ = bot
          }
        }
      }
      Section("Suggested") {
        ForEach(Hire.suggestedJobs, id: \.self) { job in
          Button(job) { name = job }
        }
      }
    }
    .scrollContentBackground(.hidden)
    .background(Theme.bg)
    .navigationTitle("New Bot")
    .onAppear { name = Hire.nextName(model.bots) }
  }
}

struct CreateRoomView: View {
  @EnvironmentObject private var model: AppModel
  @Environment(\.dismiss) private var dismiss
  @State private var name = ""
  @State private var picked: Set<String> = []

  var body: some View {
    Form {
      TextField("Room name", text: $name)
      Section("Teammates") {
        ForEach(Sidebar.sortRoster(model.bots)) { bot in
          Button {
            if picked.contains(bot.id) { picked.remove(bot.id) } else { picked.insert(bot.id) }
          } label: {
            HStack {
              Text(bot.name).foregroundStyle(Theme.text)
              Spacer()
              if picked.contains(bot.id) { Image(systemName: "checkmark").foregroundStyle(Theme.accent) }
            }
          }
        }
      }
      Button("Create") {
        Task {
          let input = JSONValue.object([
            "name": .string(name),
            "memberBotIds": .array(picked.map { .string($0) }),
          ])
          do {
            _ = try await model.client.roomsCreate(input)
            await model.refreshRoster()
            dismiss()
          } catch {
            model.error = UserFacingError.message(error, fallback: "Could not create room")
          }
        }
      }
      .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
    }
    .scrollContentBackground(.hidden)
    .background(Theme.bg)
    .navigationTitle("New room")
  }
}

struct RoomDetailView: View {
  @EnvironmentObject private var model: AppModel
  var room: Room

  var body: some View {
    List {
      Section(room.description.isEmpty ? "Teammates" : room.description) {
        ForEach(room.members) { member in
          if let bot = model.bots.first(where: { $0.id == member.botId }) {
            NavigationLink(value: bot) { BotRow(bot: bot) }
          } else {
            Text(member.name).foregroundStyle(Theme.text)
          }
        }
      }
    }
    .scrollContentBackground(.hidden)
    .background(Theme.bg)
    .navigationTitle(room.name)
    .navigationDestination(for: Bot.self) { ThreadView(bot: $0) }
  }
}
