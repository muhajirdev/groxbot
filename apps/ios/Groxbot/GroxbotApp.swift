import SwiftUI

@main
struct GroxbotApp: App {
  @StateObject private var model = AppModel()

  init() {
    Theme.applyChrome()
  }

  var body: some Scene {
    WindowGroup {
      RootView()
        .environmentObject(model)
        .preferredColorScheme(.light)
        .tint(Theme.accent)
        .onOpenURL { model.handle(url: $0) }
    }
  }
}
