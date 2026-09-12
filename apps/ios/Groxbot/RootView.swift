import SwiftUI
import GroxbotKit

struct RootView: View {
  @EnvironmentObject private var model: AppModel

  var body: some View {
    Group {
      if !model.sessionReady {
        ProgressView()
          .tint(Theme.accent)
          .frame(maxWidth: .infinity, maxHeight: .infinity)
          .background(Theme.bg)
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
        NavigationStack {
          RosterView()
        }
      }
    }
    .background(Theme.bg.ignoresSafeArea())
  }
}

struct WelcomeView: View {
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      Text("Welcome to Groxbot")
        .font(.subheadline)
        .foregroundStyle(Theme.muted)
        .tracking(0.4)
      Text("Meet Groxbot")
        .font(.largeTitle.weight(.semibold))
        .foregroundStyle(Theme.text)
      Text("Like Grok Bot, for the whole team.")
        .font(.title3)
        .foregroundStyle(Theme.text)
      Text("Give work the way you would a coworker. They pick it up and comment when done.")
        .foregroundStyle(Theme.text.opacity(0.82))
      Text("Each Bot already has a computer. You can ignore it until you need the screen.")
        .foregroundStyle(Theme.muted)
      NavigationLink("Get started") {
        LoginView()
      }
      .buttonStyle(AccentButtonStyle())
      Spacer()
    }
    .padding(24)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .background(Theme.bg)
  }
}

struct AccentButtonStyle: ButtonStyle {
  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .font(.headline)
      .foregroundStyle(.white)
      .frame(maxWidth: .infinity)
      .padding(.vertical, 14)
      .background(Theme.accent.opacity(configuration.isPressed ? 0.8 : 1))
      .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
  }
}

struct LoginView: View {
  @EnvironmentObject private var model: AppModel
  @State private var email = ""
  @State private var otp = ""
  @State private var sentTo = ""
  @State private var busy = false

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 16) {
        Text("Sign in")
          .font(.largeTitle.weight(.semibold))
          .foregroundStyle(Theme.text)
        Text("Same office as web. Native SwiftUI for comparison with Expo.")
          .foregroundStyle(Theme.muted)
        if !model.error.isEmpty {
          Text(model.error).foregroundStyle(Theme.danger)
        }
        TextField("Email", text: $email)
          .textContentType(.emailAddress)
          .keyboardType(.emailAddress)
          .textInputAutocapitalization(.never)
          .padding(12)
          .background(Theme.surface)
          .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
          .foregroundStyle(Theme.text)
        if sentTo.isEmpty {
          Button("Email me a code") {
            Task {
              busy = true
              await model.sendMagicLink(email: email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased())
              sentTo = email
              busy = false
            }
          }
          .buttonStyle(AccentButtonStyle())
          .disabled(busy || !email.contains("@"))
        } else {
          Text("Code sent to \(sentTo). Local mail is logged on the API.")
            .foregroundStyle(Theme.muted)
          TextField("6-digit code", text: $otp)
            .keyboardType(.numberPad)
            .padding(12)
            .background(Theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .foregroundStyle(Theme.text)
          Button(busy ? "Signing in…" : "Continue") {
            Task {
              busy = true
              await model.verifyOTP(email: sentTo, otp: otp)
              busy = false
            }
          }
          .buttonStyle(AccentButtonStyle())
          .disabled(busy || otp.count < 6)
        }
        if model.health?.googleReady == true || model.health?.githubReady == true {
          Text("OAuth is configured on this API. Open the social URL from You after sign-in, or use email on this native client.")
            .font(.footnote)
            .foregroundStyle(Theme.muted)
        }
      }
      .padding(24)
    }
    .background(Theme.bg)
    .navigationBarTitleDisplayMode(.inline)
  }
}

struct OnboardingView: View {
  @EnvironmentObject private var model: AppModel
  @State private var workspaceName = ""
  @State private var invite = ""
  @State private var hireName = Hire.firstHire
  @State private var busy = false

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 16) {
        Text("Your office")
          .font(.largeTitle.weight(.semibold))
          .foregroundStyle(Theme.text)
        if !model.error.isEmpty { Text(model.error).foregroundStyle(Theme.danger) }
        TextField("Workspace name", text: $workspaceName)
          .padding(12)
          .background(Theme.surface)
          .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
          .foregroundStyle(Theme.text)
        Button("Create workspace") {
          Task {
            busy = true
            _ = await model.createWorkspace(name: workspaceName)
            busy = false
          }
        }
        .buttonStyle(AccentButtonStyle())
        .disabled(workspaceName.trimmingCharacters(in: .whitespaces).isEmpty || busy)

        Text("Or join with an invite")
          .foregroundStyle(Theme.muted)
        TextField("Invite id or link", text: $invite)
          .padding(12)
          .background(Theme.surface)
          .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
          .foregroundStyle(Theme.text)
        Button("Join") {
          Task {
            busy = true
            _ = await model.joinWorkspace(Invite.invitationId(from: invite))
            busy = false
          }
        }
        .buttonStyle(AccentButtonStyle())
        .disabled(invite.trimmingCharacters(in: .whitespaces).isEmpty || busy)

        if model.me?.needsWorkspace == false {
          Text("First hire")
            .font(.title2.weight(.semibold))
            .foregroundStyle(Theme.text)
          TextField("Name", text: $hireName)
            .padding(12)
            .background(Theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .foregroundStyle(Theme.text)
          Button("Hire") {
            Task { _ = await model.hire(name: hireName) }
          }
          .buttonStyle(AccentButtonStyle())
        }
      }
      .padding(24)
    }
    .background(Theme.bg)
    .onAppear { if !model.invite.isEmpty { invite = model.invite } }
  }
}
