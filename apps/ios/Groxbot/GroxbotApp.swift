import SwiftUI

@main
struct GroxbotApp: App {
  @StateObject private var model = AppModel()

  var body: some Scene {
    WindowGroup {
      RootView()
        .environmentObject(model)
        .preferredColorScheme(.dark)
        .onOpenURL { model.handle(url: $0) }
    }
  }
}
