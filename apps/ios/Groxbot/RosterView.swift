import SwiftUI
import GroxbotKit

enum OfficePlace: Hashable {
  case home
  case bot(Bot)
  case room(Room)
  case settings
  case hire
  case createRoom
  case knowledge
  case plugins
  case billing
}

struct OfficeShellView: View {
  @EnvironmentObject private var model: AppModel
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @State private var sidebarOpen = false
  @State private var drag: CGFloat = 0
  @State private var current: OfficePlace = .home
  @State private var path: [OfficePlace] = []

  var body: some View {
    GeometryReader { geo in
      let width = min(geo.size.width * 0.82, 320)
      let revealed = min(width, max(0, (sidebarOpen ? width : 0) + drag))
      ZStack(alignment: .leading) {
        NavigationStack(path: $path) {
          place(current)
            .id(placeID(current))
            .toolbar {
              ToolbarItem(placement: .topBarLeading) {
                Button {
                  setSidebar(true)
                } label: {
                  WorkspaceMark(name: model.me?.workspaceName ?? "Office", size: 28)
                }
                .accessibilityLabel("Open sidebar")
              }
            }
            .navigationDestination(for: OfficePlace.self) { destination($0) }
        }

        Color.black.opacity(0.28 * Double(revealed / max(width, 1)))
          .ignoresSafeArea()
          .allowsHitTesting(revealed > 8)
          .onTapGesture { setSidebar(false) }

        if !sidebarOpen {
          Color.clear
            .frame(width: 18)
            .frame(maxHeight: .infinity)
            .contentShape(Rectangle())
            .gesture(edgeOpen(width: width))
        }

        OfficeSidebar(
          current: path.last ?? .home,
          onClose: { setSidebar(false) },
          onOpen: open(_:)
        )
        .frame(width: width)
        .offset(x: revealed - width)
        .gesture(drawerDrag(width: width))
        .accessibilityAddTraits(.isModal)
      }
      .animation(reduceMotion ? .easeOut(duration: 0.18) : Motion.snappy, value: sidebarOpen)
      .sensoryFeedback(.impact(flexibility: .soft), trigger: sidebarOpen)
    }
    .background(Theme.bg.ignoresSafeArea())
    .task { await model.refreshRoster() }
  }

  private func setSidebar(_ open: Bool) {
    drag = 0
    sidebarOpen = open
  }

  private func edgeOpen(width: CGFloat) -> some Gesture {
    DragGesture(minimumDistance: 8)
      .onChanged { value in
        drag = min(width, max(0, value.translation.width))
      }
      .onEnded { value in
        let shouldOpen = value.translation.width > 56 || value.predictedEndTranslation.width > 140
        setSidebar(shouldOpen)
      }
  }

  private func drawerDrag(width _: CGFloat) -> some Gesture {
    DragGesture(minimumDistance: 8)
      .onChanged { value in
        guard sidebarOpen else { return }
        drag = min(0, value.translation.width)
      }
      .onEnded { value in
        guard sidebarOpen else { return }
        let shouldClose = value.translation.width < -64 || value.predictedEndTranslation.width < -160
        setSidebar(!shouldClose)
      }
  }

  private func open(_ place: OfficePlace) {
    setSidebar(false)
    if case .home = place {
      path = []
      current = .home
      return
    }
    if case .bot(let bot) = place {
      model.prefetchOffice(for: bot)
    }
    path.append(place)
  }

  @ViewBuilder
  private func place(_ place: OfficePlace) -> some View {
    switch place {
    case .home:
      ChatListView(onOpen: open(_:))
    default:
      destination(place)
    }
  }

  @ViewBuilder
  private func destination(_ place: OfficePlace) -> some View {
    switch place {
    case .home:
      ChatListView(onOpen: open(_:))
    case .bot(let bot):
      ThreadView(bot: bot, office: model.office(for: bot))
    case .room(let room):
      RoomDetailView(room: room)
    case .settings:
      YouView()
    case .hire:
      HireView()
    case .createRoom:
      CreateRoomView()
    case .knowledge:
      KnowledgeView()
    case .plugins:
      PluginsView()
    case .billing:
      BillingView()
    }
  }

  private func placeID(_ place: OfficePlace) -> String {
    switch place {
    case .home: "home"
    case .bot(let bot): "bot-\(bot.id)"
    case .room(let room): "room-\(room.id)"
    case .settings: "settings"
    case .hire: "hire"
    case .createRoom: "create-room"
    case .knowledge: "knowledge"
    case .plugins: "plugins"
    case .billing: "billing"
    }
  }
}

private struct OfficeSidebar: View {
  @EnvironmentObject private var model: AppModel
  var current: OfficePlace
  var onClose: () -> Void
  var onOpen: (OfficePlace) -> Void

  @State private var workspacesOpen = false
  @State private var newWorkspace = ""
  @State private var busy = false

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      workspaceHeader
      ScrollView {
        VStack(alignment: .leading, spacing: 2) {
          if workspacesOpen { workspaceSwitcher }
          if !model.error.isEmpty {
            Text(model.error)
              .font(.footnote)
              .foregroundStyle(Theme.danger)
              .padding(.horizontal, 10)
              .padding(.bottom, 6)
          }
          SidebarHeading("Workspace")
          SidebarRow(
            icon: "book",
            label: "Knowledge",
            selected: isCurrent(.knowledge),
            action: { onOpen(.knowledge) }
          )
          SidebarRow(
            icon: "puzzlepiece",
            label: "Plugins",
            selected: isCurrent(.plugins),
            action: { onOpen(.plugins) }
          )
          SidebarRow(
            icon: "creditcard",
            label: "Billing",
            selected: isCurrent(.billing),
            action: { onOpen(.billing) }
          )
        }
        .padding(.bottom, 16)
      }

      SidebarRow(icon: "gearshape", label: "Settings", selected: isCurrent(.settings), action: { onOpen(.settings) })
        .padding(.bottom, 8)
    }
    .padding(.top, 8)
    .padding(.horizontal, 10)
    .safeAreaPadding(.top)
    .safeAreaPadding(.bottom)
    .frame(maxHeight: .infinity, alignment: .top)
    .background(Theme.bg)
    .overlay(alignment: .trailing) {
      Rectangle()
        .fill(Theme.line)
        .frame(width: 1)
        .ignoresSafeArea()
    }
    .ignoresSafeArea(edges: .bottom)
  }

  private var workspaceName: String {
    model.me?.workspaceName ?? "Office"
  }

  private var workspaceHeader: some View {
    Button {
      workspacesOpen.toggle()
    } label: {
      HStack(spacing: 10) {
        WorkspaceMark(name: workspaceName, size: 32)
        VStack(alignment: .leading, spacing: 1) {
          Text(workspaceName)
            .font(.headline)
            .foregroundStyle(Theme.text)
            .lineLimit(1)
          if let email = model.me?.email, !email.isEmpty {
            Text(email)
              .font(.caption)
              .foregroundStyle(Theme.muted)
              .lineLimit(1)
          }
        }
        Spacer(minLength: 0)
        Image(systemName: workspacesOpen ? "chevron.up" : "chevron.down")
          .font(.caption.weight(.semibold))
          .foregroundStyle(Theme.muted)
      }
      .padding(.horizontal, 8)
      .padding(.vertical, 10)
      .contentShape(Rectangle())
    }
    .buttonStyle(QuietRowButtonStyle())
    .padding(.top, 4)
    .sensoryFeedback(.selection, trigger: workspacesOpen)
  }

  private var workspaceSwitcher: some View {
    VStack(alignment: .leading, spacing: 2) {
      ForEach(model.workspaces) { workspace in
        let selected = workspace.id == model.me?.workspaceId
        Button {
          Task {
            busy = true
            if await model.activateWorkspace(id: workspace.id) {
              workspacesOpen = false
              onClose()
            }
            busy = false
          }
        } label: {
          HStack {
            Text(workspace.name)
              .foregroundStyle(Theme.text)
              .lineLimit(1)
            Spacer()
            if selected {
              Image(systemName: "checkmark")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(Theme.text)
            }
          }
          .padding(.horizontal, 12)
          .frame(minHeight: 40)
          .background(selected ? Theme.surface : Color.clear, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(busy)
      }
      HStack(spacing: 8) {
        TextField("New workspace", text: $newWorkspace)
          .textInputAutocapitalization(.words)
          .padding(.horizontal, 12)
          .padding(.vertical, 10)
          .foregroundStyle(Theme.text)
          .background(Theme.surface2.opacity(0.55), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        Button("Create") {
          Task {
            busy = true
            if await model.createWorkspace(name: newWorkspace) {
              newWorkspace = ""
              workspacesOpen = false
              onClose()
            }
            busy = false
          }
        }
        .font(.subheadline.weight(.semibold))
        .foregroundStyle(Theme.accent)
        .disabled(newWorkspace.trimmingCharacters(in: .whitespaces).isEmpty || busy)
      }
      .padding(.horizontal, 4)
      .padding(.vertical, 8)
    }
    .padding(.bottom, 8)
  }

  private func isCurrent(_ place: OfficePlace) -> Bool {
    current == place
  }
}

private struct WorkspaceMark: View {
  var name: String
  var size: CGFloat = 32

  var body: some View {
    Text(initial)
      .font(.system(size: size * 0.42, weight: .bold, design: .rounded))
      .foregroundStyle(.white)
      .frame(width: size, height: size)
      .background(Theme.accent, in: RoundedRectangle(cornerRadius: size * 0.28, style: .continuous))
  }

  private var initial: String {
    let letter = name.trimmingCharacters(in: .whitespacesAndNewlines).first
    return letter.map { String($0).uppercased() } ?? "G"
  }
}

private struct SidebarHeading: View {
  var title: String
  init(_ title: String) { self.title = title }

  var body: some View {
    Text(title)
      .font(.caption.weight(.semibold))
      .foregroundStyle(Theme.faint)
      .textCase(.uppercase)
      .tracking(0.4)
      .padding(.horizontal, 10)
      .padding(.top, 16)
      .padding(.bottom, 6)
  }
}

private struct SidebarRow: View {
  var icon: String
  var label: String
  var selected = false
  var muted = false
  var action: () -> Void

  var body: some View {
    Button(action: action) {
      HStack(spacing: 12) {
        Image(systemName: icon)
          .font(.body)
          .foregroundStyle(selected ? Theme.text : Theme.muted)
          .frame(width: 22)
        Text(label)
          .font(.body.weight(selected ? .semibold : .regular))
          .foregroundStyle(muted && !selected ? Theme.muted : Theme.text)
          .lineLimit(1)
        Spacer(minLength: 0)
      }
      .padding(.horizontal, 10)
      .frame(minHeight: 44)
      .background(selected ? Theme.surface : Color.clear, in: RoundedRectangle(cornerRadius: Theme.radiusSm, style: .continuous))
      .contentShape(Rectangle())
    }
    .buttonStyle(QuietRowButtonStyle())
  }
}

private struct ChatListView: View {
  @EnvironmentObject private var model: AppModel
  var onOpen: (OfficePlace) -> Void
  @State private var query = ""
  @State private var showArchived = false
  @State private var collapsed: Set<String> = []
  @State private var askingSection = false
  @State private var sectionDraft = ""

  var body: some View {
    let live = Sidebar.filterRoster(Sidebar.sortRoster(model.bots), query: query)
    let grouped = Sidebar.group(liveBots: live, sections: model.sections)
    let mixed = Sidebar.mixLive(
      bots: grouped.ungrouped,
      rooms: Sidebar.filterRooms(model.rooms, query: query)
    )
    let archived = Sidebar.filterRoster(Sidebar.sortArchived(model.bots), query: query)
    let searching = !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    let visibleSections = grouped.sections.filter { !$0.bots.isEmpty || !searching }
    let empty = mixed.isEmpty && visibleSections.allSatisfy(\.bots.isEmpty) && archived.isEmpty

    List {
      if !model.error.isEmpty {
        Text(model.error)
          .foregroundStyle(Theme.danger)
          .chatListChrome(separator: false)
      }
      if empty {
        VStack(spacing: Theme.space16) {
          CheerfulCluster(size: 52)
          Text(searching ? "Nobody by that name" : "No chats yet")
            .font(.title3.weight(.semibold))
            .foregroundStyle(Theme.text)
          Text(searching
            ? "Try another search, or hire someone new."
            : "Hire a teammate. They’re a contact — tap, talk, they pick it up.")
            .font(.subheadline)
            .foregroundStyle(Theme.muted)
            .multilineTextAlignment(.center)
          if !searching {
            Button("Hire someone") { onOpen(.hire) }
              .buttonStyle(AccentButtonStyle())
          }
        }
        .padding(.vertical, 36)
        .chatListChrome(separator: false)
      }
      ForEach(mixed) { item in
        chatLink(item)
      }
      ForEach(visibleSections, id: \.section.id) { bucket in
        let folded = collapsed.contains(bucket.section.id)
        Button {
          Haptics.soft()
          withAnimation(Motion.snappy) { toggle(bucket.section.id) }
        } label: {
          ChatSectionHeader(
            name: bucket.section.name,
            count: bucket.bots.count,
            collapsed: folded
          )
        }
        .buttonStyle(.plain)
        .chatListChrome(separator: false, insets: EdgeInsets(top: 18, leading: 16, bottom: 4, trailing: 16))
        if !folded {
          ForEach(bucket.bots) { bot in
            botLink(bot)
          }
        }
      }
      if !archived.isEmpty {
        Button {
          Haptics.soft()
          withAnimation(Motion.snappy) { showArchived.toggle() }
        } label: {
          ChatSectionHeader(
            name: "Archived",
            count: archived.count,
            collapsed: !showArchived
          )
        }
        .buttonStyle(.plain)
        .chatListChrome(separator: false, insets: EdgeInsets(top: 18, leading: 16, bottom: 4, trailing: 16))
        if showArchived {
          ForEach(archived) { bot in
            botLink(bot, muted: true)
          }
        }
      }
    }
    .listStyle(.plain)
    .scrollContentBackground(.hidden)
    .background(Theme.bg)
    .searchable(text: $query, prompt: "Search the office")
    .navigationTitle(model.me?.workspaceName ?? "Office")
    .navigationBarTitleDisplayMode(.inline)
    .toolbar {
      ToolbarItem(placement: .topBarTrailing) {
        Menu {
          Button("Hire", systemImage: "plus") { onOpen(.hire) }
          Button("Room", systemImage: "bubble.left.and.bubble.right") { onOpen(.createRoom) }
          Button("Section", systemImage: "folder") {
            sectionDraft = ""
            askingSection = true
          }
        } label: {
          Image(systemName: "plus")
            .frame(minWidth: Theme.tap, minHeight: Theme.tap)
        }
        .accessibilityLabel("New")
      }
    }
    .refreshable { await model.refreshRoster() }
    .alert("New section", isPresented: $askingSection) {
      TextField("Sales", text: $sectionDraft)
      Button("Create") {
        Task { await model.createSection(name: sectionDraft) }
      }
      Button("Cancel", role: .cancel) { sectionDraft = "" }
    } message: {
      Text("A named group in the chat list.")
    }
  }

  @ViewBuilder
  private func chatLink(_ item: SidebarItem) -> some View {
    switch item {
    case .bot(let bot):
      botLink(bot)
    case .room(let room):
      Button {
        Haptics.soft()
        onOpen(.room(room))
      } label: {
        ConversationRow(room: room)
      }
      .buttonStyle(QuietRowButtonStyle())
      .chatListChrome(separator: false)
    }
  }

  private func botLink(_ bot: Bot, muted: Bool = false) -> some View {
    Button {
      Haptics.soft()
      onOpen(.bot(bot))
    } label: {
      ConversationRow(bot: bot, muted: muted)
    }
    .buttonStyle(QuietRowButtonStyle())
    .chatListChrome(separator: false)
    .swipeActions(edge: .leading, allowsFullSwipe: true) {
      Button {
        Haptics.success()
        Task { await model.togglePin(bot) }
      } label: {
        Label(bot.isPinned ? "Unpin" : "Pin", systemImage: bot.isPinned ? "pin.slash.fill" : "pin.fill")
      }
      .tint(Theme.accent)
    }
  }

  private func toggle(_ id: String) {
    if collapsed.contains(id) { collapsed.remove(id) } else { collapsed.insert(id) }
  }
}

private struct ChatSectionHeader: View {
  var name: String
  var count: Int
  var collapsed: Bool

  var body: some View {
    HStack(spacing: 8) {
      Text(name)
        .font(.system(size: 13, weight: .semibold))
        .foregroundStyle(Theme.muted)
        .textCase(.uppercase)
        .tracking(0.5)
        .lineLimit(1)
      Spacer(minLength: 8)
      Text("\(count)")
        .font(.caption2.monospacedDigit().weight(.medium))
        .foregroundStyle(Theme.faint)
      Image(systemName: "chevron.down")
        .font(.caption2.weight(.semibold))
        .foregroundStyle(Theme.faint)
        .frame(width: 10)
        .rotationEffect(.degrees(collapsed ? -90 : 0))
        .animation(Motion.snappy, value: collapsed)
    }
    .padding(.top, 4)
    .padding(.bottom, 2)
    .contentShape(Rectangle())
    .accessibilityElement(children: .combine)
    .accessibilityAddTraits(.isHeader)
    .accessibilityLabel("\(name), \(count)")
    .accessibilityHint(collapsed ? "Expand" : "Collapse")
  }
}

private extension View {
  func chatListChrome(
    separator: Bool = true,
    insets: EdgeInsets = EdgeInsets(top: 7, leading: 16, bottom: 7, trailing: 16)
  ) -> some View {
    self
      .listRowBackground(Theme.bg)
      .listRowInsets(insets)
      .listRowSeparator(.hidden)
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
    .officeFormChrome()
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
    .officeFormChrome()
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
            NavigationLink(value: OfficePlace.bot(bot)) { BotRow(bot: bot) }
          } else {
            Text(member.name).foregroundStyle(Theme.text)
          }
        }
      }
    }
    .officeFormChrome()
    .navigationTitle(room.name)
  }
}

struct ConversationRow: View {
  var name: String
  var preview: String
  var time: String
  var pinned = false
  var muted = false
  var avatar: () -> AnyView

  init(bot: Bot, muted: Bool = false) {
    name = bot.name
    preview = ConversationRow.preview(for: bot)
    time = ListTime.format(bot.lastAt)
    pinned = bot.isPinned
    self.muted = muted
    avatar = {
      AnyView(AvatarView(name: bot.name, color: bot.avatarColor, shape: bot.avatarShape, size: 44))
    }
  }

  init(room: Room) {
    name = room.name
    preview = room.lastPreview.isEmpty
      ? roomPreview(room)
      : room.lastPreview
    time = ListTime.format(room.lastAt)
    pinned = false
    muted = false
    let faces = Sidebar.roomFaces(room.members)
    avatar = {
      AnyView(
        ZStack(alignment: .leading) {
          ForEach(Array(faces.enumerated()), id: \.offset) { index, member in
            AvatarView(name: member.name, color: member.avatarColor, shape: member.avatarShape, size: 28)
              .offset(x: CGFloat(index) * 10)
          }
        }
        .frame(width: 44, height: 44, alignment: .leading)
      )
    }
  }

  var body: some View {
    HStack(spacing: 12) {
      avatar()
        .opacity(muted ? 0.7 : 1)
      VStack(alignment: .leading, spacing: 3) {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
          Text(name)
            .font(.body.weight(.semibold))
            .foregroundStyle(Theme.text)
            .lineLimit(1)
          if pinned {
            Image(systemName: "pin.fill")
              .font(.caption2)
              .foregroundStyle(Theme.accent.opacity(0.85))
          }
          Spacer(minLength: 8)
          if !time.isEmpty {
            Text(time)
              .font(.caption)
              .foregroundStyle(Theme.faint)
          }
        }
        Text(preview)
          .font(.subheadline)
          .foregroundStyle(Theme.muted)
          .lineLimit(2)
      }
    }
    .padding(.vertical, 2)
    .opacity(muted ? 0.7 : 1)
  }

  static func preview(for bot: Bot) -> String {
    let line = bot.lastPreview.trimmingCharacters(in: .whitespacesAndNewlines)
    if !line.isEmpty { return line }
    if !bot.title.isEmpty { return bot.title }
    return "Desk is quiet"
  }
}

private func roomPreview(_ room: Room) -> String {
  if !room.description.isEmpty { return room.description }
  let names = room.members.map(\.name).filter { !$0.isEmpty }
  if names.isEmpty { return "Room" }
  if names.count == 1 { return names[0] }
  if names.count == 2 { return "\(names[0]) and \(names[1])" }
  return "\(names[0]) and \(names.count - 1) others"
}

struct BotRow: View {
  var bot: Bot
  var body: some View {
    ConversationRow(bot: bot)
      .listRowBackground(Theme.bg)
  }
}
