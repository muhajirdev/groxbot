import SwiftUI
import GroxbotKit

struct ThreadView: View {
  @EnvironmentObject private var model: AppModel
  var bot: Bot
  @StateObject private var office = OfficeController()
  @State private var draft = ""

  var body: some View {
    VStack(spacing: 0) {
      HStack(spacing: 10) {
        AvatarView(name: bot.name, color: bot.avatarColor, shape: bot.avatarShape, size: 28)
        Text(bot.title.isEmpty ? "Teammate" : bot.title)
          .foregroundStyle(Theme.muted)
          .lineLimit(1)
        Spacer()
        if office.session.status == "streaming" {
          ProgressView().tint(Theme.accent).scaleEffect(0.8)
        }
      }
      .padding(.horizontal, 16)
      .padding(.vertical, 8)
      .background(Theme.surface)

      ScrollViewReader { proxy in
        ScrollView {
          LazyVStack(alignment: .leading, spacing: 12) {
            if let error = office.error, !error.isEmpty {
              Text(error).foregroundStyle(Theme.danger).padding(.horizontal, 16)
            }
            ForEach(office.session.messages) { message in
              MessageBubble(message: message)
                .id(message.id)
            }
          }
          .padding(.vertical, 12)
        }
        .onChange(of: office.session.messages.count) { _, _ in
          if let last = office.session.messages.last {
            proxy.scrollTo(last.id, anchor: .bottom)
          }
        }
      }

      HStack(alignment: .bottom, spacing: 8) {
        TextField("Message \(bot.name)", text: $draft, axis: .vertical)
          .lineLimit(1...6)
          .padding(12)
          .background(Theme.surface)
          .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
          .foregroundStyle(Theme.text)
        if office.session.status == "streaming" {
          Button {
            Task { await office.stop() }
          } label: {
            Image(systemName: "stop.fill")
              .foregroundStyle(Theme.danger)
              .padding(12)
          }
        } else {
          Button {
            let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !text.isEmpty else { return }
            draft = ""
            Task { await office.send(text) }
          } label: {
            Image(systemName: "arrow.up.circle.fill")
              .font(.title)
              .foregroundStyle(Theme.accent)
          }
          .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
      }
      .padding(12)
      .background(Theme.bg)
    }
    .background(Theme.bg)
    .navigationTitle(bot.name)
    .navigationBarTitleDisplayMode(.inline)
    .toolbar {
      ToolbarItem(placement: .topBarTrailing) {
        Menu {
          NavigationLink("Computer") { ComputerView(bot: bot) }
          NavigationLink("Knowledge") { KnowledgeView() }
          NavigationLink("Settings") { BotSettingsView(bot: bot) }
          if let url = URL(string: GroxbotOrigins.officeThreadURL(botId: bot.id, webOrigin: model.webOrigin).absoluteString) {
            Link("Open in web office", destination: url)
          }
        } label: {
          Image(systemName: "ellipsis.circle")
        }
      }
    }
    .task {
      await office.connect(url: model.officeURL(for: bot))
    }
    .onDisappear { office.disconnect() }
  }
}

struct MessageBubble: View {
  var message: OfficeMessage
  var body: some View {
    HStack {
      if message.role == "user" { Spacer(minLength: 48) }
      Text(message.text.isEmpty ? "…" : message.text)
        .foregroundStyle(Theme.text)
        .padding(12)
        .background(message.role == "user" ? Theme.accent.opacity(0.28) : Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
      if message.role != "user" { Spacer(minLength: 48) }
    }
    .padding(.horizontal, 16)
  }
}

@MainActor
final class OfficeController: ObservableObject {
  @Published var session = OfficeSession()
  @Published var error: String?
  private var socket: OfficeSocket?

  var connected: Bool { session.connected }

  func connect(url: URL) async {
    disconnect()
    let socket = OfficeSocket(url: url)
    self.socket = socket
    socket.onMessage = { [weak self] text in
      self?.session.apply(text: text)
      self?.objectWillChange.send()
    }
    socket.onError = { [weak self] message in
      self?.error = UserFacingError.humanize(message, fallback: "Could not reach this teammate. Try sending again.")
    }
    do {
      try await socket.connect()
      try await sendFrames(session.connect())
    } catch {
      self.error = UserFacingError.message(error, fallback: "Could not reach this teammate. Try sending again.")
    }
  }

  func send(_ text: String) async {
    let id = UUID().uuidString
    do {
      try await sendFrames(session.send(content: text, id: id))
      objectWillChange.send()
    } catch {
      self.error = UserFacingError.message(error, fallback: "Could not reach this teammate. Try sending again.")
    }
  }

  func stop() async {
    do { try await sendFrames(session.stop()) } catch {}
  }

  func disconnect() {
    socket?.close()
    socket = nil
  }

  private func sendFrames(_ frames: [JSONValue]) async throws {
    guard let socket else { return }
    for frame in frames {
      try await socket.send(String(data: try frame.encode(), encoding: .utf8) ?? "[]")
    }
  }
}

final class OfficeSocket: @unchecked Sendable {
  var onMessage: ((String) -> Void)?
  var onError: ((String) -> Void)?
  private let url: URL
  private var task: URLSessionWebSocketTask?
  private var session: URLSession?

  init(url: URL) {
    self.url = url
  }

  func connect() async throws {
    let session = URLSession(configuration: .default)
    self.session = session
    let task = session.webSocketTask(with: url)
    self.task = task
    task.resume()
    listen()
  }

  func send(_ text: String) async throws {
    try await task?.send(.string(text))
  }

  func close() {
    task?.cancel(with: .goingAway, reason: nil)
    task = nil
  }

  private func listen() {
    task?.receive { [weak self] result in
      switch result {
      case .success(.string(let text)):
        DispatchQueue.main.async { self?.onMessage?(text) }
        self?.listen()
      case .success(.data(let data)):
        DispatchQueue.main.async { self?.onMessage?(String(data: data, encoding: .utf8) ?? "") }
        self?.listen()
      case .failure(let error):
        DispatchQueue.main.async { self?.onError?(error.localizedDescription) }
      @unknown default:
        self?.listen()
      }
    }
  }
}
