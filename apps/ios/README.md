# Native iOS (Swift)

Companion client for comparing native iOS feel with the Expo app in `apps/mobile`. **Expo remains the product v1 mobile surface.** This app talks to the same Worker: oRPC at `/rpc` and office Cap’n Web at `/rooms/:roomId/rpc`.

Scheme is `groxbot-ios://` so it can sit next to Expo’s `groxbot://`.

## Layout

```
apps/ios/
  Package.swift          GroxbotKit (Linux/macOS testable)
  Sources/GroxbotKit/    oRPC, auth, roster/computer/knowledge, Cap'n Web office
  Tests/GroxbotKitTests/
  Groxbot/               SwiftUI app (open in Xcode)
  Groxbot.xcodeproj
```

## Kit tests (Linux or macOS)

```bash
swift test --package-path apps/ios
```

## Run the app

The companion talks to the hosted Worker (`https://api.whip.computer`) and office (`https://app.whip.computer`). No local wrangler.

1. Open `apps/ios/Groxbot.xcodeproj` in Xcode 16+.
2. Sign with your team if you want a device build.
3. Sign in with email OTP. Magic-link callbacks use `groxbot-ios://`.
4. **You → API origin** can point at a self-host or `http://127.0.0.1:3100` if you need a local Worker.

Live docs / slides / sheets still open in the web office, same as Expo.

## What is native

- Welcome, login, onboarding, roster, thread, computer, knowledge, hire, rooms, you, billing, plugins
- Office thread is SwiftUI bubbles + a Cap’n Web WebSocket client (`subscribe` / `send` / `stop` + snapshot/event callbacks)
