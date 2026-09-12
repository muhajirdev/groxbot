import SwiftUI
import GroxbotKit

struct ThreadView: View {
  @EnvironmentObject private var model: AppModel
  var bot: Bot
  @ObservedObject var office: OfficeController
  @State private var draft = ""
  @FocusState private var composerFocused: Bool
  @State private var sentTick = 0
  @State private var peek: OfficeFilePeek?

  var body: some View {
    VStack(spacing: 0) {
      transcript
      composer
    }
    .background(Theme.bg)
    .navigationBarTitleDisplayMode(.inline)
    .toolbar {
      ToolbarItem(placement: .principal) {
        HStack(spacing: 8) {
          AvatarView(name: bot.name, color: bot.avatarColor, shape: bot.avatarShape, size: 22)
          Text(bot.name)
            .font(.headline.weight(.semibold))
            .foregroundStyle(Theme.text)
            .lineLimit(1)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(bot.name)
        .accessibilityValue(statusLine)
      }
      ToolbarItem(placement: .topBarTrailing) {
        NavigationLink {
          ComputerView(bot: bot)
        } label: {
          Image(systemName: "desktopcomputer")
            .font(.body.weight(.medium))
            .foregroundStyle(Theme.text)
            .frame(width: 36, height: 36)
            .background(Theme.surface, in: Circle())
        }
        .accessibilityLabel("\(bot.name)’s computer")
      }
      ToolbarItem(placement: .topBarTrailing) {
        Menu {
          NavigationLink("Knowledge") { KnowledgeView() }
          NavigationLink("Settings") { BotSettingsView(bot: bot) }
          if let url = URL(string: GroxbotOrigins.officeThreadURL(botId: bot.id, webOrigin: model.webOrigin).absoluteString) {
            Link("Open in web office", destination: url)
          }
        } label: {
          Image(systemName: "ellipsis")
            .font(.body.weight(.medium))
            .foregroundStyle(Theme.text)
            .frame(width: 36, height: 36)
            .background(Theme.surface, in: Circle())
        }
        .accessibilityLabel("More")
      }
    }
    .task {
      await office.ensureConnected(
        url: model.officeURL(for: bot),
        origin: model.webOrigin,
        cookie: model.cookie,
        workspaceId: model.workspaceId
      )
    }
    .navigationDestination(item: $peek) { file in
      if file.place == "knowledge" {
        KnowledgeView(initialPath: file.path)
      } else {
        ComputerView(bot: bot, initialPath: file.path)
      }
    }
    .onAppear { Haptics.soft() }
  }

  private var statusLine: String {
    if office.session.isWorking { return "Working…" }
    if let error = office.error, !error.isEmpty { return "Couldn’t connect" }
    if !office.connected { return "Opening desk…" }
    return bot.title.isEmpty ? "At their desk" : bot.title
  }

  private var transcript: some View {
    ScrollViewReader { proxy in
      ScrollView {
        LazyVStack(alignment: .leading, spacing: Theme.space12) {
          if let error = office.error, !error.isEmpty {
            Text(error)
              .font(.subheadline.weight(.medium))
              .foregroundStyle(Theme.danger)
              .padding(.horizontal, Theme.space16)
          }
          if office.session.viewMessages.isEmpty {
            ThreadEmpty(
              bot: bot,
              connecting: !office.connected && office.error == nil,
              failed: office.error != nil,
              onRetry: { Task { await office.retry() } },
              onPrompt: { send($0) }
            )
              .padding(.top, 56)
          }
          ForEach(office.session.viewMessages) { message in
            MessageBubble(
              message: message,
              toolResults: office.session.toolResults,
              onAnswerAsk: { toolCallId, answers in
                Task { await office.answerAsk(toolCallId: toolCallId, answers: answers) }
              },
              onSkipAsk: { toolCallId in
                Task { await office.skipAsk(toolCallId: toolCallId) }
              },
              onOpenFile: { path, place in
                peek = OfficeFilePeek(path: path, place: OfficePath.place(path: path, explicit: place))
              }
            )
              .id(message.id)
          }
          if office.session.isWorking, waitingForAssistant {
            TypingDots()
              .id("typing")
              .padding(.horizontal, 16)
          }
        }
        .padding(.vertical, Theme.space16)
        .animation(Motion.pop, value: office.session.viewMessages.count)
      }
      .scrollDismissesKeyboard(.interactively)
      .onChange(of: office.session.viewMessages.count) { _, _ in
        scroll(proxy)
      }
      .onChange(of: office.session.status) { _, _ in
        scroll(proxy)
      }
      .onChange(of: office.session.viewMessages.last?.text ?? "") { _, _ in
        scroll(proxy)
      }
    }
  }

  private var composer: some View {
    HStack(alignment: .center, spacing: 8) {
      Button {
        Haptics.soft()
        composerFocused = true
      } label: {
        Image(systemName: "plus")
          .font(.title3.weight(.medium))
          .foregroundStyle(Theme.text)
          .frame(width: 36, height: 36)
      }
      .buttonStyle(QuietRowButtonStyle())
      .accessibilityLabel("Attach")

      HStack(alignment: .bottom, spacing: 6) {
        TextField("Ask \(bot.name)", text: $draft, axis: .vertical)
          .lineLimit(1...6)
          .focused($composerFocused)
          .padding(.leading, 16)
          .padding(.vertical, 10)
          .foregroundStyle(Theme.text)
        composerTrailing
      }
      .background(Theme.surface, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
    }
    .padding(.horizontal, 12)
    .padding(.top, 8)
    .padding(.bottom, 10)
    .background(Theme.bg)
  }

  @ViewBuilder
  private var composerTrailing: some View {
    if office.session.isWorking {
      Button {
        Haptics.medium()
        Task { await office.stop() }
      } label: {
        Image(systemName: "stop.fill")
          .font(.footnote.weight(.bold))
          .foregroundStyle(Theme.text)
          .frame(width: 32, height: 32)
      }
      .buttonStyle(QuietRowButtonStyle())
      .accessibilityLabel("Stop")
      .padding(.trailing, 6)
    } else if canSend {
      Button {
        sendDraft()
      } label: {
        Image(systemName: "arrow.up")
          .font(.footnote.weight(.bold))
          .foregroundStyle(.white)
          .frame(width: 32, height: 32)
          .background(Theme.accent, in: Circle())
      }
      .buttonStyle(QuietRowButtonStyle())
      .accessibilityLabel("Send")
      .padding(.trailing, 6)
    } else {
      Button {
        Haptics.soft()
        composerFocused = true
      } label: {
        Image(systemName: "mic")
          .font(.body)
          .foregroundStyle(Theme.muted)
          .frame(width: 32, height: 32)
      }
      .buttonStyle(QuietRowButtonStyle())
      .accessibilityLabel("Dictate")
      .padding(.trailing, 6)
    }
  }

  private var canSend: Bool {
    !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
  }

  private var waitingForAssistant: Bool {
    guard let last = office.session.viewMessages.last else { return true }
    return last.role == "user" || !last.hasDisplayContent
  }

  private func sendDraft() {
    send(draft)
    draft = ""
  }

  private func send(_ text: String) {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return }
    sentTick += 1
    Haptics.success()
    Task { await office.send(trimmed) }
  }

  private func scroll(_ proxy: ScrollViewProxy) {
    let target = office.session.viewMessages.last?.id ?? "typing"
    withAnimation(Motion.snappy) { proxy.scrollTo(target, anchor: .bottom) }
  }
}

private struct ThreadEmpty: View {
  var bot: Bot
  var connecting: Bool
  var failed = false
  var onRetry: (() -> Void)?
  var onPrompt: ((String) -> Void)?

  private let prompts = [
    "Hi — what’s on your desk?",
    "Write yourself a short job description.",
    "What’s the first thing I should hand you?",
  ]

  var body: some View {
    VStack(spacing: Theme.space12) {
      AvatarView(name: bot.name, color: bot.avatarColor, shape: bot.avatarShape, size: 72)
        .shadow(color: Theme.shadow.opacity(0.14), radius: 16, y: 8)
      Text(connecting ? "Opening \(bot.name)’s desk…" : "Say hi to \(bot.name)")
        .font(.title3.weight(.semibold))
        .foregroundStyle(Theme.text)
        .multilineTextAlignment(.center)
      Text(connecting
        ? "One moment."
        : "They have a computer and they’re ready. First task, a job description, or just hello.")
        .font(.subheadline)
        .foregroundStyle(Theme.muted)
        .multilineTextAlignment(.center)
        .padding(.horizontal, 28)
      if connecting {
        ProgressView().tint(Theme.accent).padding(.top, 4)
      }
      if failed, let onRetry {
        Button("Try again", action: onRetry)
          .font(.subheadline.weight(.semibold))
          .foregroundStyle(Theme.accent)
          .padding(.top, 4)
      }
      if !connecting, !failed, let onPrompt {
        VStack(spacing: 8) {
          ForEach(prompts, id: \.self) { prompt in
            Button {
              Haptics.soft()
              onPrompt(prompt)
            } label: {
              Text(prompt)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(Theme.text)
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
            .buttonStyle(QuietRowButtonStyle())
          }
        }
        .padding(.top, 8)
        .padding(.horizontal, 8)
      }
    }
    .frame(maxWidth: .infinity)
    .padding(.horizontal, Theme.space16)
  }
}

struct MessageBubble: View {
  var message: OfficeMessage
  var toolResults: [String: JSONValue] = [:]
  var onAnswerAsk: ((String, JSONValue) -> Void)?
  var onSkipAsk: ((String) -> Void)?
  var onOpenFile: ((String, String) -> Void)?
  private var isUser: Bool { message.role == "user" }

  var body: some View {
    HStack(alignment: .bottom, spacing: 0) {
      if isUser { Spacer(minLength: 72) }
      VStack(alignment: .leading, spacing: Theme.space8) {
        ForEach(displayParts) { part in
          partView(part)
        }
      }
      .frame(maxWidth: isUser ? 300 : .infinity, alignment: .leading)
      if !isUser { Spacer(minLength: 0) }
    }
    .padding(.horizontal, 16)
    .transition(
      .opacity.combined(
        with: .scale(scale: 0.92, anchor: isUser ? .bottomTrailing : .bottomLeading)
      ).combined(with: .offset(y: 8))
    )
  }

  private var displayParts: [OfficePart] {
    if !message.parts.isEmpty { return message.parts }
    if message.text.isEmpty { return [] }
    return [OfficePart(id: "\(message.id)-text", kind: .text, text: message.text)]
  }

  @ViewBuilder
  private func partView(_ part: OfficePart) -> some View {
    switch part.kind {
    case .text:
      if !part.text.isEmpty {
        bubble(part.text)
          .environment(\.openURL, OpenURLAction { url in
            if let file = OfficePath.parseFileURL(url) {
              onOpenFile?(file.path, file.place)
              return .handled
            }
            return .systemAction
          })
      }
    case .thinking:
      if !part.text.isEmpty {
        ThinkingChip(text: part.text)
      }
    case .toolCall:
      if part.toolName == Present.toolName, let tree = part.arguments {
        PresentCardView(tree: tree, onOpenFile: onOpenFile)
      } else if part.toolName == Present.askToolName {
        AskCardView(
          toolCallId: part.toolCallId,
          args: part.arguments ?? .null,
          result: part.result ?? part.toolCallId.flatMap { toolResults[$0] },
          onAnswer: onAnswerAsk,
          onSkip: onSkipAsk
        )
      } else if part.toolName == Present.stampAppToolName {
        ToolChip(name: "Live app", detail: Present.preview(part.arguments ?? .null))
      } else {
        ToolChip(name: part.toolName ?? "tool", detail: part.text)
      }
    }
  }

  private func bubble(_ text: String) -> some View {
    ChatMarkdownView(text: text)
      .padding(.horizontal, 16)
      .padding(.vertical, 14)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(Theme.surface, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
  }
}

private struct ChatMarkdownView: View {
  var text: String

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      ForEach(ChatMarkdown.blocks(text)) { block in
        switch block {
        case .heading(let heading):
          Text(ChatMarkdown.inline(heading))
            .font(.headline.weight(.semibold))
            .foregroundStyle(Theme.text)
            .fixedSize(horizontal: false, vertical: true)
        case .paragraph(let paragraph):
          Text(ChatMarkdown.inline(paragraph))
            .font(.body)
            .foregroundStyle(Theme.text)
            .fixedSize(horizontal: false, vertical: true)
        case .bullets(let items):
          VStack(alignment: .leading, spacing: 10) {
            ForEach(Array(items.enumerated()), id: \.offset) { _, item in
              HStack(alignment: .top, spacing: 8) {
                Text("•")
                  .foregroundStyle(Theme.text)
                Text(ChatMarkdown.inline(item))
                  .foregroundStyle(Theme.text)
                  .fixedSize(horizontal: false, vertical: true)
              }
            }
          }
        }
      }
    }
  }
}

private struct ThinkingChip: View {
  var text: String
  @State private var open = false

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Button {
        open.toggle()
      } label: {
        Text(open ? "Hide thinking" : "Thinking")
          .font(.caption.weight(.semibold))
          .foregroundStyle(Theme.muted)
      }
      .buttonStyle(.plain)
      if open {
        Text(text)
          .font(.footnote)
          .foregroundStyle(Theme.muted)
      }
    }
    .padding(.horizontal, 12)
    .padding(.vertical, 10)
    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
  }
}

private struct ToolChip: View {
  var name: String
  var detail: String

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(name)
        .font(.caption.weight(.semibold))
        .foregroundStyle(Theme.muted)
      if !detail.isEmpty {
        Text(detail)
          .font(.footnote)
          .foregroundStyle(Theme.text)
      }
    }
    .padding(.horizontal, 12)
    .padding(.vertical, 10)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
  }
}

private struct OfficeFilePeek: Identifiable, Hashable {
  var path: String
  var place: String
  var id: String { "\(place):\(path)" }
}

private struct PresentCardView: View {
  var tree: JSONValue
  var onOpenFile: ((String, String) -> Void)?
  private var node: JSONValue { Present.coerce(tree) }

  var body: some View {
    PresentNodeView(node: node, onOpenFile: onOpenFile)
      .padding(14)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(Theme.card, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
      .overlay(
        RoundedRectangle(cornerRadius: 18, style: .continuous)
          .stroke(Theme.line.opacity(0.55), lineWidth: 1)
      )
      .accessibilityLabel(Present.preview(node))
  }
}

private struct PresentNodeView: View {
  var node: JSONValue
  var onOpenFile: ((String, String) -> Void)?

  var body: some View {
    let type = node["$type"]?.string ?? node["type"]?.string ?? ""
    let kids = node["children"]?.array ?? []
    VStack(alignment: .leading, spacing: 8) {
      if type == "Card", let title = node["title"]?.string, !title.isEmpty {
        Text(title)
          .font(.caption.weight(.semibold))
          .foregroundStyle(Theme.muted)
      }
      if type == "Fact" {
        Text(node["label"]?.string ?? "")
          .font(.caption)
          .foregroundStyle(Theme.muted)
        Text(node["value"]?.string ?? node["text"]?.string ?? "")
          .font(.title3.weight(.semibold))
          .foregroundStyle(Theme.text)
      } else if type == "File" {
        let path = node["path"]?.string ?? ""
        let name = path.split(separator: "/").last.map(String.init) ?? path
        let place = OfficePath.place(path: path, explicit: node["place"]?.string)
        Button {
          Haptics.soft()
          onOpenFile?(path, place)
        } label: {
          HStack(alignment: .center, spacing: 10) {
            Image(systemName: "doc")
              .foregroundStyle(Theme.accent)
            VStack(alignment: .leading, spacing: 2) {
              Text(name.isEmpty ? "File" : name)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(Theme.text)
              Text(place == "knowledge" ? "Office library" : "On their computer")
                .font(.caption)
                .foregroundStyle(Theme.muted)
            }
            Spacer(minLength: 8)
            Image(systemName: "chevron.right")
              .font(.caption.weight(.semibold))
              .foregroundStyle(Theme.faint)
          }
          .contentShape(Rectangle())
        }
        .buttonStyle(QuietRowButtonStyle())
        .disabled(path.isEmpty)
      } else if type == "Alert" {
        Text(node["title"]?.string ?? node["text"]?.string ?? "Notice")
          .font(.subheadline.weight(.semibold))
          .foregroundStyle(node["tone"]?.string == "danger" || node["tone"]?.string == "error" ? Theme.danger : Theme.text)
        if let description = node["description"]?.string, !description.isEmpty {
          Text(description)
            .font(.footnote)
            .foregroundStyle(Theme.muted)
        }
      } else if type == "Badge" {
        Text(node["text"]?.string ?? node["label"]?.string ?? "")
          .font(.caption.weight(.semibold))
          .padding(.horizontal, 8)
          .padding(.vertical, 4)
          .background(Theme.surface2, in: Capsule())
      } else if type == "Table" {
        PresentTableView(node: node)
      } else if type == "Image", let src = node["src"]?.string, let url = URL(string: src), src.hasPrefix("http") {
        AsyncImage(url: url) { image in
          image.resizable().scaledToFit()
        } placeholder: {
          Theme.surface2.frame(height: 120)
        }
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
      } else if ["Header", "Text", "Caption", "Markdown"].contains(type) {
        let text = node["text"]?.string ?? node["value"]?.string ?? ""
        if !text.isEmpty {
          Text(text)
            .font(type == "Header" ? .headline : .subheadline)
            .foregroundStyle(type == "Caption" ? Theme.muted : Theme.text)
        }
      } else if let text = node["text"]?.string ?? node["value"]?.string, !text.isEmpty, kids.isEmpty {
        Text(text)
          .font(.subheadline)
          .foregroundStyle(Theme.text)
      }
      ForEach(Array(kids.enumerated()), id: \.offset) { _, child in
        PresentNodeView(node: child, onOpenFile: onOpenFile)
      }
    }
  }
}

private struct PresentTableView: View {
  var node: JSONValue

  var body: some View {
    let headers = (node["headers"]?.array ?? []).compactMap(\.string)
    let cells = node["cells"]?.array ?? node["rows"]?.array ?? []
    VStack(alignment: .leading, spacing: 6) {
      if !headers.isEmpty {
        HStack {
          ForEach(headers, id: \.self) { header in
            Text(header)
              .font(.caption.weight(.semibold))
              .foregroundStyle(Theme.muted)
              .frame(maxWidth: .infinity, alignment: .leading)
          }
        }
      }
      ForEach(Array(cells.enumerated()), id: \.offset) { _, row in
        let cols = row.array ?? [row]
        HStack {
          ForEach(Array(cols.enumerated()), id: \.offset) { _, cell in
            Text(cell.string ?? cell["text"]?.string ?? cell.description)
              .font(.footnote)
              .foregroundStyle(Theme.text)
              .frame(maxWidth: .infinity, alignment: .leading)
          }
        }
      }
    }
  }
}

private struct AskCardView: View {
  var toolCallId: String?
  var args: JSONValue
  var result: JSONValue?
  var onAnswer: ((String, JSONValue) -> Void)?
  var onSkip: ((String) -> Void)?

  @State private var picked: [String: String] = [:]
  @State private var drafts: [String: String] = [:]
  @State private var busy = false

  private var questions: [OfficeAskQuestion] { OfficeAsk.parseQuestions(args) }
  private var settled: OfficeAskSettled? { OfficeAsk.parseSettled(result) }

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      if let settled {
        if settled.skipped {
          Text("You skipped — they’ll decide.")
            .font(.subheadline)
            .foregroundStyle(Theme.muted)
        } else if settled.answers.isEmpty {
          Text(settled.message)
            .font(.subheadline)
            .foregroundStyle(Theme.text)
        } else {
          ForEach(settled.answers, id: \.id) { answer in
            VStack(alignment: .leading, spacing: 2) {
              if !answer.prompt.isEmpty {
                Text(answer.prompt)
                  .font(.caption)
                  .foregroundStyle(Theme.muted)
              }
              Text(answer.value)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(Theme.text)
            }
          }
        }
      } else {
        ForEach(questions) { question in
          Text(question.prompt)
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(Theme.text)
          if question.options.isEmpty {
            TextField("Your answer", text: draftBinding(question.id))
              .textFieldStyle(.plain)
              .padding(.horizontal, 12)
              .padding(.vertical, 10)
              .background(Theme.surface2, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
          } else {
            FlexibleAskOptions(
              options: question.options,
              selected: picked[question.id],
              disabled: busy
            ) { option in
              picked[question.id] = option.id
            }
          }
        }
        HStack(spacing: 8) {
          Button("Skip") { skip() }
            .foregroundStyle(Theme.muted)
            .disabled(busy || toolCallId == nil)
          Spacer()
          Button("Answer") { answer() }
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(.white)
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(canAnswer ? Theme.accent : Theme.surface2, in: Capsule())
            .disabled(!canAnswer)
        }
      }
    }
    .padding(14)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(Theme.card, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    .overlay(
      RoundedRectangle(cornerRadius: 18, style: .continuous)
        .stroke(Theme.line.opacity(0.55), lineWidth: 1)
    )
  }

  private var canAnswer: Bool {
    guard !busy, toolCallId != nil, !questions.isEmpty else { return false }
    return questions.allSatisfy { question in
      if question.options.isEmpty {
        return !(drafts[question.id] ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
      }
      return picked[question.id] != nil
    }
  }

  private func draftBinding(_ id: String) -> Binding<String> {
    Binding(
      get: { drafts[id] ?? "" },
      set: { drafts[id] = $0 }
    )
  }

  private func skip() {
    guard let toolCallId, !busy else { return }
    busy = true
    Haptics.soft()
    onSkip?(toolCallId)
  }

  private func answer() {
    guard let toolCallId, canAnswer else { return }
    busy = true
    Haptics.soft()
    let answers: [JSONValue] = questions.map { question in
      var row: [String: JSONValue] = [
        "id": .string(question.id),
        "prompt": .string(question.prompt),
      ]
      if let selected = picked[question.id] {
        row["value"] = .string(
          question.options.first(where: { $0.id == selected })?.label ?? selected
        )
        row["selected"] = .string(selected)
      } else {
        row["value"] = .string((drafts[question.id] ?? "").trimmingCharacters(in: .whitespacesAndNewlines))
      }
      return .object(row)
    }
    onAnswer?(toolCallId, .object(["answers": .array(answers)]))
  }
}

private struct FlexibleAskOptions: View {
  var options: [OfficeAskOption]
  var selected: String?
  var disabled: Bool
  var onPick: (OfficeAskOption) -> Void

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      ForEach(options) { option in
        Button {
          onPick(option)
        } label: {
          Text(option.label)
            .font(.subheadline)
            .foregroundStyle(Theme.text)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(
              selected == option.id ? Theme.accent.opacity(0.28) : Theme.surface2,
              in: RoundedRectangle(cornerRadius: 12, style: .continuous)
            )
        }
        .buttonStyle(.plain)
        .disabled(disabled)
      }
    }
  }
}

private struct TypingDots: View {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  var body: some View {
    TimelineView(.periodic(from: .now, by: 0.32)) { context in
      let phase = Int(context.date.timeIntervalSinceReferenceDate / 0.32) % 3
      HStack(spacing: 5) {
        ForEach(0..<3, id: \.self) { index in
          Circle()
            .fill(Theme.muted)
            .frame(width: 6, height: 6)
            .opacity(reduceMotion || phase == index ? 1 : 0.28)
            .offset(y: reduceMotion || phase != index ? 0 : -3)
            .scaleEffect(reduceMotion || phase == index ? 1.15 : 0.9)
        }
      }
      .padding(.horizontal, 14)
      .padding(.vertical, 12)
      .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
  }
}

@MainActor
final class OfficeController: ObservableObject {
  @Published var session = OfficeSession()
  @Published var error: String?
  private var socket: OfficeSocket?
  private var lastURL: URL?
  private var lastOrigin: String?
  private var lastCookie: String?
  private var lastWorkspaceId: String?
  private var handshake: Task<Void, Never>?

  var connected: Bool { session.connected }

  func ensureConnected(
    url: URL,
    origin: String? = nil,
    cookie: String? = nil,
    workspaceId: String? = nil
  ) async {
    if socket != nil,
      lastURL == url,
      lastCookie == cookie,
      lastWorkspaceId == workspaceId
    {
      if !session.connected, error != nil {
        await retry()
      }
      return
    }
    await connect(url: url, origin: origin, cookie: cookie, workspaceId: workspaceId)
  }

  func connect(
    url: URL,
    origin: String? = nil,
    cookie: String? = nil,
    workspaceId: String? = nil
  ) async {
    disconnect()
    session = OfficeSession()
    error = nil
    lastURL = url
    lastOrigin = origin
    lastCookie = cookie
    lastWorkspaceId = workspaceId
    let socket = OfficeSocket(url: url, origin: origin, cookie: cookie, workspaceId: workspaceId)
    self.socket = socket
    socket.onMessage = { [weak self] text in
      guard let self else { return }
      let replies = self.session.apply(text: text)
      self.objectWillChange.send()
      if !replies.isEmpty {
        Task { try? await self.sendFrames(replies) }
      }
    }
    socket.onError = { [weak self] message in
      self?.error = UserFacingError.humanize(message, fallback: "Could not reach this teammate. Try sending again.")
    }
    do {
      try await socket.connect()
      try await sendFrames(session.connect())
      objectWillChange.send()
      watchHandshake()
    } catch {
      self.error = UserFacingError.message(error, fallback: "Could not reach this teammate. Try sending again.")
    }
  }

  func retry() async {
    guard let lastURL else { return }
    await connect(
      url: lastURL,
      origin: lastOrigin,
      cookie: lastCookie,
      workspaceId: lastWorkspaceId
    )
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

  func answerAsk(toolCallId: String, answers: JSONValue) async {
    do {
      try await sendFrames(session.answerAsk(toolCallId: toolCallId, answers: answers))
      objectWillChange.send()
    } catch {
      self.error = UserFacingError.message(error, fallback: "Could not send that answer.")
    }
  }

  func skipAsk(toolCallId: String) async {
    do {
      try await sendFrames(session.skipAsk(toolCallId: toolCallId))
      objectWillChange.send()
    } catch {
      self.error = UserFacingError.message(error, fallback: "Could not skip that question.")
    }
  }

  func disconnect() {
    handshake?.cancel()
    handshake = nil
    socket?.close()
    socket = nil
  }

  private func watchHandshake() {
    handshake?.cancel()
    handshake = Task { [weak self] in
      try? await Task.sleep(nanoseconds: 12_000_000_000)
      guard let self, !Task.isCancelled else { return }
      if !self.session.connected, self.error == nil {
        self.error = "Could not reach this teammate. Try sending again."
      }
    }
  }

  private func sendFrames(_ frames: [JSONValue]) async throws {
    guard let socket else { return }
    for frame in frames {
      try await socket.send(String(data: try frame.encode(), encoding: .utf8) ?? "[]")
    }
  }
}

private enum OfficeSocketError: LocalizedError {
  case timeout

  var errorDescription: String? {
    "Could not reach this teammate. Try sending again."
  }
}

final class OfficeSocket: NSObject, URLSessionWebSocketDelegate, @unchecked Sendable {
  var onMessage: ((String) -> Void)?
  var onError: ((String) -> Void)?
  private let url: URL
  private let origin: String?
  private let cookie: String?
  private let workspaceId: String?
  private var task: URLSessionWebSocketTask?
  private var session: URLSession?
  private var opened: CheckedContinuation<Void, Error>?

  init(
    url: URL,
    origin: String? = nil,
    cookie: String? = nil,
    workspaceId: String? = nil
  ) {
    self.url = url
    self.origin = origin
    self.cookie = cookie
    self.workspaceId = workspaceId
    super.init()
  }

  func connect() async throws {
    var request = URLRequest(url: url)
    request.timeoutInterval = 20
    if let cookie, !cookie.isEmpty {
      request.setValue(cookie, forHTTPHeaderField: "Cookie")
    }
    if let workspaceId, !workspaceId.isEmpty {
      request.setValue(workspaceId, forHTTPHeaderField: GroxbotOrigins.workspaceHeader)
    }
    if let origin, !origin.isEmpty {
      request.setValue(origin, forHTTPHeaderField: "Origin")
      request.setValue("\(origin)/", forHTTPHeaderField: "Referer")
      request.setValue(origin, forHTTPHeaderField: "expo-origin")
    }
    let configuration = URLSessionConfiguration.ephemeral
    configuration.httpShouldSetCookies = true
    configuration.httpCookieAcceptPolicy = .always
    configuration.timeoutIntervalForRequest = 20
    if let cookie, !cookie.isEmpty, let host = url.host {
      let store = HTTPCookieStorage()
      configuration.httpCookieStorage = store
      for (name, value) in CookieJar.parse(cookie) {
        guard let httpCookie = HTTPCookie(properties: [
          .domain: host,
          .path: "/",
          .name: name,
          .value: value,
          .secure: "TRUE",
        ]) else { continue }
        store.setCookie(httpCookie)
      }
    }
    let session = URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
    self.session = session
    let task = session.webSocketTask(with: request)
    self.task = task
    do {
      try await withThrowingTaskGroup(of: Void.self) { group in
        group.addTask {
          try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            self.opened = cont
            task.resume()
          }
        }
        group.addTask {
          try await Task.sleep(nanoseconds: 15_000_000_000)
          throw OfficeSocketError.timeout
        }
        try await group.next()
        group.cancelAll()
      }
    } catch {
      finishOpen(error)
      throw error
    }
    listen()
  }

  func send(_ text: String) async throws {
    try await task?.send(.string(text))
  }

  func close() {
    onMessage = nil
    onError = nil
    finishOpen(OfficeSocketError.timeout)
    task?.cancel(with: .goingAway, reason: nil)
    task = nil
    session?.invalidateAndCancel()
    session = nil
  }

  func urlSession(
    _ session: URLSession,
    webSocketTask: URLSessionWebSocketTask,
    didOpenWithProtocol protocolName: String?
  ) {
    finishOpen(nil)
  }

  func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    guard let error else { return }
    finishOpen(error)
    DispatchQueue.main.async { self.onError?(error.localizedDescription) }
  }

  private func finishOpen(_ error: Error?) {
    guard let opened else { return }
    self.opened = nil
    if let error {
      opened.resume(throwing: error)
    } else {
      opened.resume()
    }
  }

  private func listen() {
    task?.receive { [weak self] result in
      guard let self else { return }
      let onMessage = self.onMessage
      let onError = self.onError
      switch result {
      case .success(.string(let text)):
        DispatchQueue.main.async { onMessage?(text) }
        self.listen()
      case .success(.data(let data)):
        DispatchQueue.main.async { onMessage?(String(data: data, encoding: .utf8) ?? "") }
        self.listen()
      case .failure(let error):
        DispatchQueue.main.async { onError?(error.localizedDescription) }
      @unknown default:
        self.listen()
      }
    }
  }
}
