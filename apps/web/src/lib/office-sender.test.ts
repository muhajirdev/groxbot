import { describe, expect, it } from "vitest";
import { officeUserMessageSender } from "./office-sender";

const alex = { userId: "usr_1", name: "Alex" };
const sam = { userId: "usr_2", name: "Sam" };

describe("officeUserMessageSender", () => {
  it("labels the viewer's turn as You", () => {
    expect(officeUserMessageSender({ user: alex }, alex.userId)).toEqual({
      label: "You",
      name: "Alex",
      mine: true,
    });
  });

  it("labels another human by name", () => {
    expect(officeUserMessageSender({ custom: { user: sam } }, alex.userId)).toEqual({
      label: "Sam",
      name: "Sam",
      mine: false,
    });
  });

  it("keeps the name when the viewer is unknown", () => {
    expect(officeUserMessageSender({ user: alex })).toEqual({
      label: "Alex",
      name: "Alex",
      mine: true,
    });
  });

  it("passes through a profile photo", () => {
    const photo = "https://avatars.githubusercontent.com/u/1";
    expect(
      officeUserMessageSender({ user: { ...sam, image: photo } }, alex.userId),
    ).toEqual({
      label: "Sam",
      name: "Sam",
      mine: false,
      image: photo,
    });
  });

  it("returns null when the turn has no sender", () => {
    expect(officeUserMessageSender({})).toBeNull();
  });
});
