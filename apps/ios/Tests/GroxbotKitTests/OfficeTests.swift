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

  @Test func sessionIncrementsPullIds() {
    let session = OfficeSession()
    let subscribe = session.connect()
    #expect(subscribe.last?.array?[1].int == 1)
    let first = session.send(content: "one", id: "a")
    #expect(first.last?.array?[1].int == 2)
    let second = session.send(content: "two", id: "b")
    #expect(second.last?.array?[1].int == 3)
    let stop = session.stop()
    #expect(stop.last?.array?[1].int == 4)
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
    #expect(session.viewMessages.map(\.role) == ["user", "assistant"])
    #expect(session.viewMessages.map(\.text) == ["Hi", "Hello"])
    #expect(session.status == "ready")
  }

  @Test func applyMessageUpdateThenEnd() {
    let session = OfficeSession()
    session.applyClientEvent(
      OfficeEvent(
        threadId: "t1",
        seq: 1,
        type: "message_update",
        raw: .object([
          "threadId": .string("t1"),
          "seq": .int(1),
          "type": .string("message_update"),
          "id": .string("a1"),
          "message": .object([
            "role": .string("assistant"),
            "content": .array([.object(["type": .string("text"), "text": .string("Hel")])]),
          ]),
        ])
      )
    )
    #expect(session.viewMessages.last?.text == "Hel")
    #expect(session.status == "streaming")
    session.applyClientEvent(
      OfficeEvent(
        threadId: "t1",
        seq: 2,
        type: "message_end",
        raw: .object([
          "threadId": .string("t1"),
          "seq": .int(2),
          "type": .string("message_end"),
          "id": .string("a1"),
          "message": .object([
            "role": .string("assistant"),
            "content": .array([
              .object(["type": .string("text"), "text": .string("Hello")]),
              .object([
                "type": .string("toolCall"),
                "id": .string("call_1"),
                "name": .string("present"),
                "arguments": .object([
                  "$type": .string("Fact"),
                  "label": .string("Bookings"),
                  "value": .string("$1.2M"),
                ]),
              ]),
            ]),
          ]),
        ])
      )
    )
    #expect(session.streaming == nil)
    #expect(session.viewMessages.last?.text == "Hello")
    #expect(session.viewMessages.last?.parts.contains { $0.toolName == "present" } == true)
    #expect(Present.preview(session.viewMessages.last?.parts.last?.arguments ?? .null) == "Bookings $1.2M")
  }

  @Test func snapshotKeepsOptimisticUser() {
    let session = OfficeSession()
    _ = session.send(content: "Just now", id: "local-1")
    session.applyClientEvent(
      OfficeEvent(
        threadId: "t1",
        seq: 3,
        type: "snapshot",
        raw: .object([
          "threadId": .string("t1"),
          "seq": .int(3),
          "type": .string("snapshot"),
          "snapshot": .object([
            "metadata": .object(["id": .string("bot_1"), "status": .string("idle")]),
            "messages": .array([
              .object([
                "id": .string("m1"),
                "message": .object(["role": .string("user"), "content": .string("Older")]),
              ]),
            ]),
          ]),
        ])
      )
    )
    #expect(session.viewMessages.map(\.id) == ["m1", "local-1"])
  }

  @Test func hidesToolResultRows() {
    let rows = OfficeMessage.parseList(
      .array([
        .object([
          "id": .string("a"),
          "message": .object([
            "role": .string("assistant"),
            "content": .array([.object(["type": .string("text"), "text": .string("Done")])]),
          ]),
        ]),
        .object([
          "id": .string("tr"),
          "message": .object([
            "role": .string("toolResult"),
            "toolCallId": .string("call_1"),
            "content": .array([.object(["type": .string("text"), "text": .string("ok")])]),
          ]),
        ]),
      ])
    )
    let session = OfficeSession()
    session.messages = rows
    #expect(session.viewMessages.map(\.role) == ["assistant"])
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

  @Test func applyPullRepliesResolveUndefined() {
    let session = OfficeSession()
    let replies = session.apply(raw: .array([.string("pull"), .int(1)]))
    #expect(replies == [CapnWeb.resolveUndefined(1)])
    #expect(!session.connected)
  }

  @Test func applyWirePullKeepsNumericExportId() {
    let session = OfficeSession()
    let replies = session.apply(text: #"["pull",1]"#)
    #expect(replies == [CapnWeb.resolveUndefined(1)])
  }

  @Test func applyBatchAndEventMarksConnected() {
    let session = OfficeSession()
    let snapshot = JSONValue.object([
      "metadata": .object(["id": .string("bot_1"), "status": .string("idle")]),
      "messages": .array([]),
    ])
    let replies = session.apply(text: """
    ["push",\(pipelineJSON(path: "streamGeneration", arg: "0"))]
    ["pull",1]
    """)
    #expect(session.connected)
    #expect(replies == [CapnWeb.resolveUndefined(1)])
    session.apply(
      raw: .array([
        .array([
          .string("push"),
          CapnWeb.pipeline(importId: -1, path: ["event"], arguments: [CapnWeb.encodeValue(snapshot)]),
        ]),
        .array([.string("pull"), .int(2)]),
      ])
    )
    #expect(session.connected)
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

private func pipelineJSON(path: String, arg: String) -> String {
  "[\"pipeline\",-1,[\"\(path)\"],[\(arg)]]"
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

  @Test func parsesAskQuestions() {
    let questions = OfficeAsk.parseQuestions(
      .object([
        "question": .string("Ship today?"),
        "options": .array([.string("Yes"), .string("Wait")]),
      ])
    )
    #expect(questions.map(\.prompt) == ["Ship today?"])
    #expect(questions.first?.options.map(\.label) == ["Yes", "Wait"])
  }
}

@Suite("Office projection")
struct OfficeProjectionTests {
  @Test func foldsToolResultOntoPresent() {
    let user = OfficeMessage(id: "u1", role: "user", text: "list files")
    let assistant = OfficeMessage.parse(
      .object([
        "id": .string("a1"),
        "message": .object([
          "role": .string("assistant"),
          "content": .array([
            .object([
              "type": .string("toolCall"),
              "id": .string("c1"),
              "name": .string("present"),
              "arguments": .object(["$type": .string("Card"), "title": .string("Hiring shortlist")]),
            ]),
          ]),
        ]),
      ])
    )!
    let result = OfficeMessage.parse(
      .object([
        "id": .string("t1"),
        "message": .object([
          "role": .string("toolResult"),
          "toolCallId": .string("c1"),
          "content": .array([.object(["type": .string("text"), "text": .string("{\"ok\":true}")])]),
        ]),
      ])
    )!
    let done = OfficeMessage.parse(
      .object([
        "id": .string("a2"),
        "message": .object([
          "role": .string("assistant"),
          "content": .array([.object(["type": .string("text"), "text": .string("Done.")])]),
        ]),
      ])
    )!
    let projected = OfficeProjection.project(messages: [user, assistant, result, done])
    #expect(projected.map(\.role) == ["user", "assistant"])
    #expect(projected[1].id == "a1")
    #expect(projected[1].parts.contains { $0.toolCallId == "c1" && $0.result != nil })
    #expect(projected[1].text == "Done.")
  }

  @Test func hidesReviewKickAndSkip() {
    let hidden = OfficeMessage(
      id: "u",
      role: "user",
      text: "Office review.",
      metadata: .object(["source": .string("office-review")])
    )
    let skip = OfficeMessage(id: "a", role: "assistant", text: "Skip")
    let filed = OfficeMessage(
      id: "filed",
      role: "assistant",
      text: "Saved skills/weekly-update/SKILL.md",
      metadata: .object(["source": .string("office-review")])
    )
    #expect(!OfficeProjection.isVisible(hidden))
    #expect(!OfficeProjection.isVisible(skip))
    #expect(OfficeProjection.isVisible(filed))
  }

  @Test func keepsReasoningOnlyVisible() {
    let think = OfficeMessage(
      id: "think",
      role: "assistant",
      text: "",
      parts: [OfficePart(kind: .thinking, text: "checking the brief")]
    )
    #expect(OfficeProjection.isVisible(think))
  }

  @Test func splitsDifferentSpeakers() {
    let steve = OfficeMessage(
      id: "a1",
      role: "assistant",
      text: "Stay hungry.",
      metadata: .object([
        "custom": .object([
          "speaker": .object(["botId": .string("steve"), "name": .string("Steve Jobs")]),
        ])
      ])
    )
    let alexander = OfficeMessage(
      id: "a2",
      role: "assistant",
      text: "Take the city.",
      metadata: .object([
        "custom": .object([
          "speaker": .object(["botId": .string("alexander"), "name": .string("Alexander")]),
        ])
      ])
    )
    let projected = OfficeProjection.project(messages: [steve, alexander])
    #expect(projected.map(\.id) == ["a1", "a2"])
  }
}
