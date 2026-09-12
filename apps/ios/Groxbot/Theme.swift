import SwiftUI
import UIKit

enum Theme {
  static let bg = Color(red: 242 / 255, green: 241 / 255, blue: 237 / 255)
  static let surface = Color(red: 255 / 255, green: 254 / 255, blue: 250 / 255)
  static let surface2 = Color(red: 238 / 255, green: 236 / 255, blue: 229 / 255)
  static let card = Color(red: 247 / 255, green: 245 / 255, blue: 239 / 255)
  static let line = Color(red: 228 / 255, green: 225 / 255, blue: 217 / 255)
  static let text = Color(red: 34 / 255, green: 33 / 255, blue: 31 / 255)
  static let muted = Color(red: 104 / 255, green: 102 / 255, blue: 96 / 255)
  static let faint = Color(red: 154 / 255, green: 151 / 255, blue: 144 / 255)
  static let accent = Color(red: 228 / 255, green: 92 / 255, blue: 154 / 255)
  static let sky = Color(red: 91 / 255, green: 124 / 255, blue: 255 / 255)
  static let ok = Color(red: 23 / 255, green: 107 / 255, blue: 69 / 255)
  static let danger = Color(red: 185 / 255, green: 56 / 255, blue: 46 / 255)
  static let shadow = Color(red: 40 / 255, green: 36 / 255, blue: 28 / 255)

  static let space4: CGFloat = 4
  static let space8: CGFloat = 8
  static let space12: CGFloat = 12
  static let space16: CGFloat = 16
  static let space24: CGFloat = 24
  static let radiusSm: CGFloat = 10
  static let radiusMd: CGFloat = 16
  static let radiusLg: CGFloat = 24
  static let tap: CGFloat = 44

  static func applyChrome() {
    let paper = UIColor(red: 242 / 255, green: 241 / 255, blue: 237 / 255, alpha: 1)
    let ink = UIColor(red: 34 / 255, green: 33 / 255, blue: 31 / 255, alpha: 1)
    let nav = UINavigationBarAppearance()
    nav.configureWithOpaqueBackground()
    nav.backgroundColor = paper
    nav.shadowColor = .clear
    nav.titleTextAttributes = [.foregroundColor: ink]
    nav.largeTitleTextAttributes = [.foregroundColor: ink]
    UINavigationBar.appearance().standardAppearance = nav
    UINavigationBar.appearance().scrollEdgeAppearance = nav
    UINavigationBar.appearance().compactAppearance = nav
    UINavigationBar.appearance().tintColor = UIColor(
      red: 228 / 255, green: 92 / 255, blue: 154 / 255, alpha: 1
    )
    UITextField.appearance().tintColor = UIColor(
      red: 228 / 255, green: 92 / 255, blue: 154 / 255, alpha: 1
    )
    UITableView.appearance().backgroundColor = paper
    UISearchBar.appearance().tintColor = UIColor(
      red: 228 / 255, green: 92 / 255, blue: 154 / 255, alpha: 1
    )
  }
}

enum Motion {
  static let appear = Animation.spring(response: 0.5, dampingFraction: 0.72)
  static let snappy = Animation.spring(response: 0.3, dampingFraction: 0.7)
  static let settle = Animation.spring(response: 0.68, dampingFraction: 0.86)
  static let press = Animation.spring(response: 0.2, dampingFraction: 0.55)
  static let pop = Animation.spring(response: 0.26, dampingFraction: 0.52)
  static let squash = Animation.spring(response: 0.16, dampingFraction: 0.48)
  static let breathe = Animation.easeInOut(duration: 4.4).repeatForever(autoreverses: true)
}

struct Appear: ViewModifier {
  var delay: Double = 0
  @State private var shown = false
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  func body(content: Content) -> some View {
    content
      .opacity(shown ? 1 : 0)
      .offset(y: shown ? 0 : 18)
      .scaleEffect(shown ? 1 : 0.9)
      .blur(radius: shown ? 0 : 8)
      .onAppear {
        if reduceMotion {
          shown = true
          return
        }
        withAnimation(Motion.appear.delay(delay)) { shown = true }
      }
  }
}

extension View {
  func appear(delay: Double = 0) -> some View {
    modifier(Appear(delay: delay))
  }
}

enum Haptics {
  static func soft() {
    UIImpactFeedbackGenerator(style: .soft).impactOccurred()
  }

  static func light() {
    UIImpactFeedbackGenerator(style: .light).impactOccurred()
  }

  static func medium() {
    UIImpactFeedbackGenerator(style: .medium).impactOccurred()
  }

  static func selection() {
    UISelectionFeedbackGenerator().selectionChanged()
  }

  static func success() {
    UINotificationFeedbackGenerator().notificationOccurred(.success)
  }

  static func warn() {
    UINotificationFeedbackGenerator().notificationOccurred(.warning)
  }
}

struct QuietRowButtonStyle: ButtonStyle {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .opacity(configuration.isPressed ? 0.78 : 1)
      .scaleEffect(
        x: configuration.isPressed && !reduceMotion ? 1.018 : 1,
        y: configuration.isPressed && !reduceMotion ? 0.955 : 1
      )
      .animation(Motion.squash, value: configuration.isPressed)
  }
}

struct OfficeField: View {
  var placeholder: String
  @Binding var text: String
  var keyboard: UIKeyboardType = .default
  var contentType: UITextContentType?
  var autocapitalization: TextInputAutocapitalization = .sentences
  var submitLabel: SubmitLabel = .done
  var onSubmit: (() -> Void)?

  @FocusState private var focused: Bool

  var body: some View {
    TextField(placeholder, text: $text)
      .textContentType(contentType)
      .keyboardType(keyboard)
      .textInputAutocapitalization(autocapitalization)
      .autocorrectionDisabled(keyboard == .emailAddress || contentType == .oneTimeCode)
      .submitLabel(submitLabel)
      .onSubmit { onSubmit?() }
      .padding(.horizontal, Theme.space16)
      .padding(.vertical, 15)
      .foregroundStyle(Theme.text)
      .background(Theme.surface, in: RoundedRectangle(cornerRadius: Theme.radiusMd, style: .continuous))
      .overlay {
        RoundedRectangle(cornerRadius: Theme.radiusMd, style: .continuous)
          .stroke(focused ? Theme.accent.opacity(0.7) : Theme.line, lineWidth: focused ? 1.5 : 1)
      }
      .shadow(color: Theme.accent.opacity(focused ? 0.16 : 0), radius: focused ? 12 : 0, y: 4)
      .scaleEffect(focused ? 1.015 : 1)
      .animation(Motion.snappy, value: focused)
      .focused($focused)
  }
}

extension View {
  func officeFormChrome() -> some View {
    self
      .scrollContentBackground(.hidden)
      .background(Theme.bg)
      .tint(Theme.accent)
      .scrollDismissesKeyboard(.interactively)
  }
}

extension Color {
  init?(hex: String) {
    var raw = hex.trimmingCharacters(in: .whitespacesAndNewlines)
    if raw.hasPrefix("#") { raw.removeFirst() }
    guard raw.count == 6, let value = Int(raw, radix: 16) else { return nil }
    self.init(
      red: Double((value >> 16) & 0xFF) / 255,
      green: Double((value >> 8) & 0xFF) / 255,
      blue: Double(value & 0xFF) / 255
    )
  }
}

struct AvatarView: View {
  var name: String
  var color: String
  var shape: String
  var size: CGFloat = 36

  var body: some View {
    let fill = Color(hex: color) ?? Theme.accent
    Text(initials)
      .font(.system(size: size * 0.38, weight: .semibold))
      .foregroundStyle(.white)
      .frame(width: size, height: size)
      .background(fill)
      .clipShape(avatarShape)
      .overlay {
        avatarShape.stroke(Theme.bg, lineWidth: 3)
      }
  }

  private var initials: String {
    let parts = name.split(separator: " ")
    let letters = parts.prefix(2).compactMap { $0.first }
    return letters.isEmpty ? "?" : String(letters).uppercased()
  }

  private var avatarShape: AnyShape {
    switch shape {
    case "squircle":
      AnyShape(RoundedRectangle(cornerRadius: size * 0.28, style: .continuous))
    case "diamond":
      AnyShape(DiamondShape())
    case "hex":
      AnyShape(RoundedRectangle(cornerRadius: size * 0.18, style: .continuous))
    default:
      AnyShape(Circle())
    }
  }
}

private struct DiamondShape: Shape {
  func path(in rect: CGRect) -> Path {
    Path { path in
      path.move(to: CGPoint(x: rect.midX, y: rect.minY))
      path.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
      path.addLine(to: CGPoint(x: rect.midX, y: rect.maxY))
      path.addLine(to: CGPoint(x: rect.minX, y: rect.midY))
      path.closeSubpath()
    }
  }
}
