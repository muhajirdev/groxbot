import SwiftUI
import UIKit
import GroxbotKit

struct ComputerView: View {
  @EnvironmentObject private var model: AppModel
  var bot: Bot
  var initialPath: String? = nil
  @State private var entries: [ComputerEntry] = []
  @State private var query = ""
  @State private var previewPath: String?
  @State private var preview = ""
  @State private var error = ""
  @State private var collapsed: Set<String> = []

  var body: some View {
    let tree = ComputerTree.filter(ComputerTree.nest(entries), query: query)
    List {
      if !error.isEmpty { Text(error).foregroundStyle(Theme.danger) }
      ComputerOutline(
        nodes: tree,
        collapsed: $collapsed,
        onOpen: { path in Task { await open(path) } }
      )
      if let previewPath {
        Section(previewPath) {
          Text(preview.isEmpty ? "…" : preview)
            .font(.system(.footnote, design: .monospaced))
            .foregroundStyle(Theme.text)
            .textSelection(.enabled)
        }
      }
    }
    .scrollContentBackground(.hidden)
    .background(Theme.bg)
    .searchable(text: $query, prompt: "Files")
    .navigationTitle("Computer")
    .task {
      await load()
      if let initialPath { await open(initialPath) }
    }
    .refreshable { await load() }
  }

  private func load() async {
    do {
      let json = try await model.client.computerList(botId: bot.id)
      entries = JSONList.computerEntries(json)
    } catch {
      self.error = UserFacingError.message(error, fallback: "Could not list this computer")
    }
  }

  private func open(_ path: String) async {
    previewPath = path
    error = ""
    let kind = ComputerPreview.kind(path)
    do {
      if ComputerPreview.source(kind) == .download {
        let file = try await model.client.computerDownload(botId: bot.id, path: path)
        preview = kind == .image ? "(image \(file["filename"]?.string ?? path))" : (file["filename"]?.string ?? path)
      } else if ComputerPreview.source(kind) == .read {
        let file = try await model.client.computerRead(botId: bot.id, path: path)
        preview = file["content"]?.string ?? ""
      } else {
        preview = "No preview"
      }
    } catch {
      self.error = UserFacingError.message(error, fallback: "Could not open that file")
    }
  }
}

private struct ComputerOutline: View {
  var nodes: [ComputerTreeNode]
  @Binding var collapsed: Set<String>
  var onOpen: (String) -> Void

  var body: some View {
    ForEach(nodes) { node in
      if node.kind == "dir" {
        DisclosureGroup(isExpanded: expansion(node.path)) {
          ComputerOutline(nodes: node.children, collapsed: $collapsed, onOpen: onOpen)
        } label: {
          Label(node.name, systemImage: "folder")
            .foregroundStyle(Theme.text)
        }
        .listRowBackground(Theme.bg)
      } else {
        Button {
          Haptics.soft()
          onOpen(node.path)
        } label: {
          HStack {
            Label(node.name, systemImage: "doc")
              .foregroundStyle(Theme.text)
            Spacer()
            Image(systemName: "chevron.right")
              .font(.caption.weight(.semibold))
              .foregroundStyle(Theme.faint)
          }
          .contentShape(Rectangle())
        }
        .buttonStyle(QuietRowButtonStyle())
        .listRowBackground(Theme.bg)
      }
    }
  }

  private func expansion(_ path: String) -> Binding<Bool> {
    Binding(
      get: { !collapsed.contains(path) },
      set: { open in
        if open { collapsed.remove(path) } else { collapsed.insert(path) }
      }
    )
  }
}

struct KnowledgeView: View {
  @EnvironmentObject private var model: AppModel
  var initialPath: String? = nil
  @State private var entries: [KnowledgeEntry] = []
  @State private var query = ""
  @State private var selected: String?
  @State private var draft = ""
  @State private var error = ""

  var body: some View {
    let tree = KnowledgeTree.filter(KnowledgeTree.nest(entries), query: query)
    List {
      if !error.isEmpty { Text(error).foregroundStyle(Theme.danger) }
      Text("Chat is organized here automatically.")
        .foregroundStyle(Theme.muted)
        .listRowBackground(Theme.bg)
      KnowledgeOutline(nodes: tree, onOpen: { path in Task { await open(path) } })
      if selected != nil {
        Section("Preview") {
          TextEditor(text: $draft)
            .frame(minHeight: 180)
            .foregroundStyle(Theme.text)
          Button("Save") {
            Task { await save() }
          }
        }
      }
    }
    .scrollContentBackground(.hidden)
    .background(Theme.bg)
    .searchable(text: $query, prompt: "Notes")
    .navigationTitle("Knowledge")
    .task {
      await load()
      if let initialPath { await open(initialPath) }
    }
  }

  private func load() async {
    do {
      let json = try await model.client.knowledgeList()
      entries = JSONList.knowledgeEntries(json)
    } catch {
      self.error = UserFacingError.message(error, fallback: "Could not load knowledge")
    }
  }

  private func open(_ path: String) async {
    selected = path
    do {
      let file = try await model.client.knowledgeRead(path: path)
      draft = file["content"]?.string ?? ""
    } catch {
      self.error = UserFacingError.message(error, fallback: "Could not read that note")
    }
  }

  private func save() async {
    guard let selected else { return }
    do {
      _ = try await model.client.knowledgeWrite(path: selected, content: draft)
    } catch {
      self.error = UserFacingError.message(error, fallback: "Could not save")
    }
  }
}

private struct KnowledgeOutline: View {
  var nodes: [KnowledgeTreeNode]
  var onOpen: (String) -> Void

  var body: some View {
    ForEach(nodes) { node in
      if node.kind == "dir" {
        DisclosureGroup(node.name) {
          KnowledgeOutline(nodes: node.children, onOpen: onOpen)
        }
        .listRowBackground(Theme.bg)
      } else {
        Button {
          Haptics.soft()
          onOpen(node.path)
        } label: {
          HStack(spacing: 10) {
            Image(systemName: "doc")
              .foregroundStyle(Theme.accent)
            VStack(alignment: .leading, spacing: 2) {
              Text(node.title.isEmpty ? node.name : node.title)
                .foregroundStyle(Theme.text)
              if !node.title.isEmpty, node.title != node.name {
                Text(node.name)
                  .font(.caption)
                  .foregroundStyle(Theme.muted)
              }
            }
            Spacer()
            Image(systemName: "chevron.right")
              .font(.caption.weight(.semibold))
              .foregroundStyle(Theme.faint)
          }
          .contentShape(Rectangle())
        }
        .buttonStyle(QuietRowButtonStyle())
        .listRowBackground(Theme.bg)
      }
    }
  }
}

struct BotSettingsView: View {
  @EnvironmentObject private var model: AppModel
  var bot: Bot
  @State private var name: String
  @State private var title: String
  @State private var error = ""

  init(bot: Bot) {
    self.bot = bot
    _name = State(initialValue: bot.name)
    _title = State(initialValue: bot.title)
  }

  var body: some View {
    Form {
      TextField("Name", text: $name)
      TextField("Job", text: $title)
      if !error.isEmpty { Text(error).foregroundStyle(Theme.danger) }
      Button("Save") {
        Task {
          do {
            _ = try await model.client.botsUpdate(
              .object([
                "botId": .string(bot.id),
                "name": .string(name),
                "title": .string(title),
              ])
            )
            await model.refreshRoster()
          } catch {
            self.error = UserFacingError.message(error, fallback: "Could not save")
          }
        }
      }
      Button("Archive", role: .destructive) {
        Task {
          _ = try? await model.client.botsArchive(id: bot.id)
          await model.refreshRoster()
        }
      }
    }
    .scrollContentBackground(.hidden)
    .background(Theme.bg)
    .navigationTitle("Settings")
  }
}

struct YouView: View {
  @EnvironmentObject private var model: AppModel
  @Environment(\.dismiss) private var dismiss
  @State private var name = ""
  @State private var api = ""
  @State private var error = ""

  var body: some View {
    Form {
      Section {
        LabeledContent("Email") {
          Text(model.me?.email ?? "")
            .foregroundStyle(Theme.muted)
        }
        TextField("Name", text: $name)
        Button("Save name") {
          Task {
            do {
              _ = try await model.client.accountUpdate(name: name)
              await model.refreshSession()
            } catch {
              self.error = UserFacingError.message(error, fallback: "Could not save")
            }
          }
        }
      } header: {
        Text("You")
      }

      Section("Office") {
        NavigationLink("Knowledge") { KnowledgeView() }
        NavigationLink("Billing") { BillingView() }
        NavigationLink("Plugins") { PluginsView() }
        if let url = URL(string: model.webOrigin) {
          Link("Open web office", destination: url)
        }
      }

      Section {
        TextField("API origin", text: $api)
          .textInputAutocapitalization(.never)
          .autocorrectionDisabled()
        Button("Use this API") {
          model.apiOrigin = api.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
          UserDefaults.standard.set(model.apiOrigin, forKey: "groxbot.api")
          Task { await model.bootstrap() }
        }
      } header: {
        Text("API")
      } footer: {
        Text("Leave this on api.whip.computer unless you’re self-hosting.")
      }

      if !error.isEmpty {
        Section {
          Text(error).foregroundStyle(Theme.danger)
        }
      }

      Section {
        Button("Sign out", role: .destructive) {
          Task { await model.signOut() }
        }
      }
    }
    .officeFormChrome()
    .navigationTitle("Settings")
    .navigationBarTitleDisplayMode(.inline)
    .toolbar {
      ToolbarItem(placement: .confirmationAction) {
        Button("Done") { dismiss() }
          .fontWeight(.semibold)
          .foregroundStyle(Theme.accent)
      }
    }
    .onAppear {
      name = model.me?.name ?? ""
      api = model.apiOrigin
    }
  }
}

struct BillingView: View {
  @EnvironmentObject private var model: AppModel
  @State private var status: JSONValue = .null
  @State private var error = ""

  var body: some View {
    Form {
      if !error.isEmpty { Text(error).foregroundStyle(Theme.danger) }
      LabeledContent("Plan", value: status["plan"]?.string ?? "—")
      LabeledContent("Status", value: status["status"]?.string ?? "—")
      if let percent = status["includedUsagePercent"]?.int {
        ProgressView(value: Double(percent), total: 100) {
          Text("Included usage \(percent)%")
        }
        .tint(Theme.accent)
      }
      if status["checkoutAvailable"]?.bool == true {
        Button("Upgrade") {
          Task {
            do {
              let checkout = try await model.client.billingCheckout(plan: "pro")
              if let url = checkout["url"]?.string, let dest = URL(string: url) {
                await MainActor.run { UIApplication.shared.open(dest) }
              }
            } catch {
              self.error = UserFacingError.message(error, fallback: "Could not start checkout")
            }
          }
        }
      }
    }
    .officeFormChrome()
    .navigationTitle("Billing")
    .task {
      do { status = try await model.client.billingStatus() } catch {
        self.error = UserFacingError.message(error, fallback: "Could not load billing")
      }
    }
  }
}

struct PluginsView: View {
  @EnvironmentObject private var model: AppModel
  @State private var rows: JSONValue = .array([])
  @State private var error = ""

  var body: some View {
    List {
      if !error.isEmpty { Text(error).foregroundStyle(Theme.danger) }
      ForEach(JSONList.array(rows).indices, id: \.self) { index in
        let row = JSONList.array(rows)[index]
        VStack(alignment: .leading) {
          Text(row["toolkit"]?.string ?? row["name"]?.string ?? "Plugin")
            .foregroundStyle(Theme.text)
          Text(row["status"]?.string ?? "")
            .font(.footnote)
            .foregroundStyle(Theme.muted)
        }
        .listRowBackground(Theme.bg)
      }
    }
    .officeFormChrome()
    .navigationTitle("Plugins")
    .task {
      do { rows = try await model.client.pluginsList() } catch {
        self.error = UserFacingError.message(error, fallback: "Could not load plugins")
      }
    }
  }
}
