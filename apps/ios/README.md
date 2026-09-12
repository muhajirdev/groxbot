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

1. `pnpm dev` so wrangler is on `:3100`.
2. Open `apps/ios/Groxbot.xcodeproj` in Xcode 16+.
3. Sign with your team if you want a device build.
4. On a device, set **You → API origin** to this machine’s LAN URL (`http://192.168.x.x:3100`). Simulator can use `http://127.0.0.1:3100`.
5. Sign in with email OTP (local API logs mail). Magic-link callbacks use `groxbot-ios://`.

Live docs / slides / sheets still open in the web office, same as Expo.

## What is native

- Welcome, login, onboarding, roster, thread, computer, knowledge, hire, rooms, you, billing, plugins
- Office thread is SwiftUI bubbles + a Cap’n Web WebSocket client (`subscribe` / `send` / `stop` + snapshot/event callbacks)
