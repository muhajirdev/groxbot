import SwiftUI
import GroxbotKit

struct RootView: View {
  @EnvironmentObject private var model: AppModel

  var body: some View {
    Group {
      if !model.sessionReady {
        BootView()
          .task { await model.bootstrap() }
      } else if !model.signedIn {
        NavigationStack {
          WelcomeView()
        }
      } else if model.me?.needsWorkspace == true {
        NavigationStack {
          OnboardingView()
        }
      } else {
        OfficeShellView()
      }
    }
    .background(Theme.bg.ignoresSafeArea())
    .animation(Motion.settle, value: model.sessionReady)
    .animation(Motion.settle, value: model.signedIn)
    .animation(Motion.settle, value: model.me?.needsWorkspace)
  }
}

struct BootView: View {
  @State private var glow = false
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  var body: some View {
    ZStack {
      Theme.bg.ignoresSafeArea()
      PlayfulBackdrop(active: glow)
      VStack(spacing: 18) {
        CheerfulCluster(size: 56)
        ProgressView()
          .tint(Theme.accent)
      }
    }
    .onAppear {
      guard !reduceMotion else { return }
      withAnimation(Motion.breathe) { glow = true }
    }
  }
}

struct WelcomeView: View {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @State private var glow = false

  var body: some View {
    ZStack {
      Theme.bg.ignoresSafeArea()
      PlayfulBackdrop(active: glow)
      VStack(spacing: 0) {
        Spacer(minLength: 28)
        CheerfulCluster(size: 72)
          .padding(.bottom, 28)
          .appear(delay: 0.02)
        Text("They're already at the desk")
          .font(.subheadline.weight(.semibold))
          .foregroundStyle(Theme.accent)
          .padding(.horizontal, 14)
          .padding(.vertical, 7)
          .background(Theme.accent.opacity(0.14))
          .clipShape(Capsule())
          .appear(delay: 0.1)
        (Text("Meet ") + Text("Groxbot").foregroundStyle(Theme.accent))
          .font(.system(size: 40, weight: .bold, design: .rounded))
          .foregroundStyle(Theme.text)
          .multilineTextAlignment(.center)
          .padding(.top, 18)
          .appear(delay: 0.16)
        Text("Like Grok Bot — for the whole team.")
          .font(.title3.weight(.medium))
          .foregroundStyle(Theme.text.opacity(0.92))
          .multilineTextAlignment(.center)
          .padding(.top, 10)
          .appear(delay: 0.22)
        Text("Hand work to a teammate. They pick it up, do it, and comment when it’s done.")
          .font(.body)
          .foregroundStyle(Theme.muted)
          .multilineTextAlignment(.center)
          .padding(.horizontal, 12)
          .padding(.top, 14)
          .appear(delay: 0.28)
        HStack(spacing: 8) {
          JobChip(label: "Chief of Staff", color: Theme.accent)
          JobChip(label: "Sales", color: Theme.ok)
          JobChip(label: "Scout", color: Theme.sky)
        }
        .padding(.top, 22)
        .appear(delay: 0.34)
        Spacer()
        NavigationLink {
          LoginView()
        } label: {
          HStack(spacing: 8) {
            Text("Come on in")
            Image(systemName: "arrow.right")
              .font(.headline.weight(.bold))
          }
        }
        .buttonStyle(AccentButtonStyle())
        .appear(delay: 0.4)
        Text("Each teammate already has a computer.")
          .font(.footnote)
          .foregroundStyle(Theme.muted.opacity(0.9))
          .padding(.top, 14)
          .appear(delay: 0.46)
      }
      .padding(.horizontal, 28)
      .padding(.bottom, 28)
    }
    .toolbar(.hidden, for: .navigationBar)
    .onAppear {
      guard !reduceMotion else { return }
      withAnimation(Motion.breathe) { glow = true }
    }
  }
}

private struct JobChip: View {
  var label: String
  var color: Color

  var body: some View {
    Text(label)
      .font(.caption.weight(.semibold))
      .foregroundStyle(color)
      .padding(.horizontal, 12)
      .padding(.vertical, 7)
      .background(color.opacity(0.14))
      .clipShape(Capsule())
  }
}

private struct PlayfulBackdrop: View {
  var active: Bool

  var body: some View {
    ZStack {
      blob(Theme.accent, size: 320, x: -90, y: -180, scale: active ? 1.08 : 0.92)
      blob(Theme.sky, size: 260, x: 140, y: -40, scale: active ? 0.94 : 1.06)
      blob(Theme.ok, size: 220, x: -40, y: 220, scale: active ? 1.05 : 0.9)
    }
    .allowsHitTesting(false)
  }

  private func blob(_ color: Color, size: CGFloat, x: CGFloat, y: CGFloat, scale: CGFloat) -> some View {
    Circle()
      .fill(color.opacity(0.16))
      .frame(width: size, height: size)
      .blur(radius: 54)
      .scaleEffect(scale)
      .offset(x: x, y: y)
  }
}

struct CheerfulCluster: View {
  var size: CGFloat = 72

  private var people: [(name: String, color: String, shape: String, x: CGFloat, y: CGFloat, rot: Double)] {
    let step = size * 0.58
    return [
      ("Ada", "E45C9A", "circle", -step, 8, -8),
      ("Sam", "5B7CFF", "squircle", 0, -10, 4),
      ("Kai", "3ECF8E", "hex", step, 10, 10),
    ]
  }

  var body: some View {
    ZStack {
      ForEach(Array(people.enumerated()), id: \.offset) { index, person in
        AvatarView(name: person.name, color: person.color, shape: person.shape, size: size)
          .rotationEffect(.degrees(person.rot))
          .offset(x: person.x, y: person.y)
          .shadow(color: Theme.shadow.opacity(0.14), radius: 10, y: 6)
          .zIndex(Double(index))
          .appear(delay: 0.04 + Double(index) * 0.07)
      }
    }
    .frame(width: size * 2.3, height: size * 1.35)
  }
}

struct AccentButtonStyle: ButtonStyle {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .font(.headline.weight(.semibold))
      .foregroundStyle(.white)
      .frame(maxWidth: .infinity)
      .padding(.vertical, 16)
      .background(
        LinearGradient(
          colors: [Theme.accent, Theme.accent.opacity(0.82)],
          startPoint: .topLeading,
          endPoint: .bottomTrailing
        )
        .opacity(configuration.isPressed ? 0.9 : 1)
      )
      .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
      .shadow(
        color: Theme.accent.opacity(configuration.isPressed ? 0.12 : 0.38),
        radius: configuration.isPressed ? 8 : 16,
        y: configuration.isPressed ? 3 : 8
      )
      .scaleEffect(
        x: configuration.isPressed && !reduceMotion ? 1.04 : 1,
        y: configuration.isPressed && !reduceMotion ? 0.93 : 1
      )
      .animation(Motion.squash, value: configuration.isPressed)
      .sensoryFeedback(.impact(weight: .medium, intensity: 0.85), trigger: configuration.isPressed)
  }
}

struct LoginView: View {
  @EnvironmentObject private var model: AppModel
  @State private var email = ""
  @State private var otp = ""
  @State private var sentTo = ""
  @State private var busy = false
  @State private var shakeError = 0
  @State private var glow = false
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  var body: some View {
    ZStack {
      Theme.bg.ignoresSafeArea()
      PlayfulBackdrop(active: glow)
      VStack(spacing: 18) {
        CheerfulCluster(size: 52)
          .padding(.top, 12)
          .appear(delay: 0.02)
        Text("Come on in")
          .font(.system(size: 34, weight: .bold, design: .rounded))
          .foregroundStyle(Theme.text)
          .appear(delay: 0.08)
        Text("We’ll email a code. That’s the key to the office.")
          .font(.body)
          .foregroundStyle(Theme.muted)
          .multilineTextAlignment(.center)
          .appear(delay: 0.12)
        if !model.error.isEmpty {
          Text(model.error)
            .font(.subheadline.weight(.medium))
            .foregroundStyle(Theme.danger)
            .offset(x: CGFloat(shakeError) * 8)
        }
        VStack(spacing: 14) {
            OfficeField(
              placeholder: "you@team.com",
              text: $email,
              keyboard: .emailAddress,
              contentType: .emailAddress,
              autocapitalization: .never,
              submitLabel: .go,
              onSubmit: { Task { await sendCode() } }
            )
            if sentTo.isEmpty {
              Button {
                Task { await sendCode() }
              } label: {
                buttonLabel(busy ? "Sending…" : "Email me a code", busy: busy)
              }
              .buttonStyle(AccentButtonStyle())
              .disabled(busy || !email.contains("@"))
              .opacity(email.contains("@") ? 1 : 0.55)
            } else {
              Text("Code is on the way to \(sentTo).")
                .font(.subheadline.weight(.medium))
                .foregroundStyle(Theme.ok)
              OfficeField(
                placeholder: "6-digit code",
                text: $otp,
                keyboard: .numberPad,
                contentType: .oneTimeCode,
                autocapitalization: .never,
                submitLabel: .go,
                onSubmit: { Task { await signIn() } }
              )
            Button {
              Task { await signIn() }
            } label: {
              buttonLabel(busy ? "Opening the office…" : "Let’s go", busy: busy)
            }
            .buttonStyle(AccentButtonStyle())
            .disabled(busy || otp.count < 6)
            .opacity(otp.count < 6 ? 0.55 : 1)
          }
        }
        .padding(18)
        .background(Theme.card.opacity(0.86))
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay {
          RoundedRectangle(cornerRadius: 24, style: .continuous)
            .stroke(Theme.line.opacity(0.5), lineWidth: 1)
        }
        Spacer(minLength: 0)
      }
      .padding(24)
    }
    .navigationBarTitleDisplayMode(.inline)
    .toolbarBackground(.hidden, for: .navigationBar)
    .onChange(of: otp) { _, next in
      if next.count >= 6, !busy { Task { await signIn() } }
    }
    .onAppear {
      guard !reduceMotion else { return }
      withAnimation(Motion.breathe) { glow = true }
    }
    .onChange(of: model.error) { _, next in
      guard !next.isEmpty else { return }
      Haptics.warn()
      withAnimation(Motion.squash) { shakeError = 1 }
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.08) {
        withAnimation(Motion.squash) { shakeError = -1 }
      }
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.16) {
        withAnimation(Motion.squash) { shakeError = 1 }
      }
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.24) {
        withAnimation(Motion.pop) { shakeError = 0 }
      }
    }
  }

  @ViewBuilder
  private func buttonLabel(_ title: String, busy: Bool) -> some View {
    HStack(spacing: 8) {
      if busy {
        ProgressView()
          .tint(.white)
          .controlSize(.small)
      }
      Text(title)
    }
  }

  private func sendCode() async {
    guard email.contains("@"), !busy else { return }
    busy = true
    let next = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    if await model.sendMagicLink(email: next) {
      sentTo = next
      Haptics.success()
    }
    busy = false
  }

  private func signIn() async {
    guard otp.count >= 6, !busy else { return }
    busy = true
    await model.verifyOTP(email: sentTo, otp: otp)
    busy = false
  }
}

struct OnboardingView: View {
  @EnvironmentObject private var model: AppModel
  @State private var workspaceName = ""
  @State private var invite = ""
  @State private var hireName = Hire.firstHire
  @State private var busy = false
  @State private var glow = false
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  var body: some View {
    ZStack {
      Theme.bg.ignoresSafeArea()
      PlayfulBackdrop(active: glow)
      ScrollView {
        VStack(alignment: .leading, spacing: 16) {
          Text("Name the office")
            .font(.system(size: 34, weight: .bold, design: .rounded))
            .foregroundStyle(Theme.text)
            .appear(delay: 0.04)
          Text("This is the team’s place. You can invite people after.")
            .foregroundStyle(Theme.muted)
            .appear(delay: 0.08)
          if !model.error.isEmpty {
            Text(model.error)
              .foregroundStyle(Theme.danger)
              .transition(.opacity.combined(with: .move(edge: .top)))
          }
          VStack(alignment: .leading, spacing: 12) {
            OfficeField(
              placeholder: "Acme, Studio, Home base…",
              text: $workspaceName,
              autocapitalization: .words
            )
            Button {
              Task {
                busy = true
                _ = await model.createWorkspace(name: workspaceName)
                busy = false
              }
            } label: {
              HStack(spacing: 8) {
                if busy { ProgressView().tint(.white).controlSize(.small) }
                Text("Open the office")
              }
            }
            .buttonStyle(AccentButtonStyle())
            .disabled(workspaceName.trimmingCharacters(in: .whitespaces).isEmpty || busy)
          }
          .padding(18)
          .background(Theme.card.opacity(0.86))
          .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
          .appear(delay: 0.14)

          Text("Already invited?")
            .font(.headline)
            .foregroundStyle(Theme.text)
            .padding(.top, 8)
            .appear(delay: 0.2)
          VStack(alignment: .leading, spacing: 12) {
            OfficeField(
              placeholder: "Invite link or id",
              text: $invite,
              autocapitalization: .never
            )
            Button {
              Task {
                busy = true
                _ = await model.joinWorkspace(Invite.invitationId(from: invite))
                busy = false
              }
            } label: {
              Text("Join the team")
            }
            .buttonStyle(AccentButtonStyle())
            .disabled(invite.trimmingCharacters(in: .whitespaces).isEmpty || busy)
          }
          .padding(18)
          .background(Theme.card.opacity(0.86))
          .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
          .appear(delay: 0.26)

          if model.me?.needsWorkspace == false {
            Text("First hire")
              .font(.title2.weight(.semibold))
              .foregroundStyle(Theme.text)
              .padding(.top, 8)
              .transition(.opacity.combined(with: .offset(y: 10)))
            VStack(alignment: .leading, spacing: 12) {
              OfficeField(placeholder: "Chief of Staff", text: $hireName, autocapitalization: .words)
              Button {
                Task { _ = await model.hire(name: hireName) }
              } label: {
                Text("Hire them")
              }
              .buttonStyle(AccentButtonStyle())
            }
            .padding(18)
            .background(Theme.card.opacity(0.86))
            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
          }
        }
        .padding(24)
        .animation(Motion.appear, value: model.me?.needsWorkspace)
        .animation(Motion.snappy, value: model.error)
      }
    }
    .onAppear {
      if !model.invite.isEmpty { invite = model.invite }
      guard !reduceMotion else { return }
      withAnimation(Motion.breathe) { glow = true }
    }
  }
}
