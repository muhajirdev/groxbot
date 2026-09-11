import SwiftUI

enum Theme {
  static let bg = Color.black
  static let surface = Color(red: 22 / 255, green: 22 / 255, blue: 22 / 255)
  static let surface2 = Color(red: 42 / 255, green: 42 / 255, blue: 42 / 255)
  static let card = Color(red: 28 / 255, green: 28 / 255, blue: 28 / 255)
  static let line = Color(red: 51 / 255, green: 51 / 255, blue: 51 / 255)
  static let text = Color(red: 244 / 255, green: 244 / 255, blue: 244 / 255)
  static let muted = Color(red: 138 / 255, green: 138 / 255, blue: 138 / 255)
  static let accent = Color(red: 228 / 255, green: 92 / 255, blue: 154 / 255)
  static let ok = Color(red: 62 / 255, green: 207 / 255, blue: 142 / 255)
  static let danger = Color(red: 226 / 255, green: 93 / 255, blue: 74 / 255)
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
  }

  private var initials: String {
    let parts = name.split(separator: " ")
    let letters = parts.prefix(2).compactMap { $0.first }
    return letters.isEmpty ? "?" : String(letters).uppercased()
  }

  @ViewBuilder private var avatarShape: some Shape {
    switch shape {
    case "squircle": RoundedRectangle(cornerRadius: size * 0.28, style: .continuous)
    case "diamond": DiamondShape()
    case "hex": RoundedRectangle(cornerRadius: size * 0.18, style: .continuous)
    default: Circle()
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
