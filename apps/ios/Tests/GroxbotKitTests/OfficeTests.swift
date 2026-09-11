import Foundation
import GroxbotKit
import Testing

@Suite("Cap'n Web office")
struct OfficeTests {
  @Test func subscribePushExportsSubscriber() throws {
    let frames = CapnWeb.subscribeMessages()
    #expect(frames.count == 2)
    #expect(frames[0].array?.first?.string == "push")
    let pipeline = frames[0].array?[1]
    #expect(pipeline?.array?[0].string == "pipeline")
    #expect(pipeline?.array?[1].int == 0)
    #expect(pipeline?.array?[2].array?.compactMap(\.string) == ["subscribe"])
    #expect(pipeline?.array?[3].array?.first?.array?[0].string == "export")
    #expect(frames[1].array?.first?.string == "pull")
  }

  @Test func sendEncodesContent() {
    let frames = CapnWeb.sendMessages(content: "hello", id: "m1")
    let args = frames[0].array?[1].array?[3].array?.first
    #expect(args?["content"]?.string == "hello")
    #expect(args?["id"]?.string == "m1")
  }

  @Test func applySubscribeResolveMarksConnected() {
    let session = OfficeSession()
    _ = session.connect()
    session.apply(raw: .array([.string("resolve"), .int(1), .string("ok")]))
    #expect(session.connected)
  }

  @Test func applySnapshotReplacesMessages() {
    let session = OfficeSession()
    let snapshot = JSONValue.object([
      "metadata": .object(["id": .string("bot_1"), "status": .string("idle")]),
      "messages": .array([
        .object([
          "id": .string("m1"),
          "message": .object([
            "role": .string("user"),
            "content": .string("Hi"),
          ]),
        ]),
        .object([
          "id": .string("m2"),
          "message": .object([
            "role": .string("assistant"),
            "content": .array([.object(["type": .string("text"), "text": .string("Hello")])]),
          ]),
        ]),
      ]),
    ])
    session.apply(
      raw: .array([
        .string("push"),
        CapnWeb.pipeline(importId: -1, path: ["event"], arguments: [CapnWeb.encodeValue(snapshot)]),
      ])
    )
    #expect(session.messages.map(\.role) == ["user", "assistant"])
    #expect(session.messages.map(\.text) == ["Hi", "Hello"])
    #expect(session.status == "idle")
  }

  @Test func optimisticSendThenStatus() {
    let session = OfficeSession()
    _ = session.send(content: "Hi", id: "local-1")
    #expect(session.messages.last?.text == "Hi")
    #expect(session.status == "submitted")
    session.apply(
      raw: .array([
        .string("push"),
        CapnWeb.pipeline(importId: -1, path: ["status"], arguments: [.string("streaming")]),
      ])
    )
    #expect(session.status == "streaming")
  }

  @Test func parseIncomingReject() {
    let incoming = CapnWeb.parseIncoming(
      .array([
        .string("reject"),
        .int(1),
        .array([.string("error"), .string("Error"), .string("nope")]),
      ])
    )
    guard case .reject(_, let error) = incoming else {
      Issue.record("expected reject")
      return
    }
    #expect(error["message"]?.string == "nope")
  }
}

@Suite("Office message text")
struct OfficeMessageTests {
  @Test func extractsArrayContent() {
    let message = OfficeMessage.parse(
      .object([
        "id": .string("a"),
        "message": .object([
          "role": .string("assistant"),
          "content": .array([
            .object(["type": .string("text"), "text": .string("A")]),
            .object(["type": .string("text"), "text": .string("B")]),
          ]),
        ]),
      ])
    )
    #expect(message?.text == "AB")
  }
}
