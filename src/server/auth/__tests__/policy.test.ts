import { describe, expect, it } from "vitest";
import { homePathFor, safeNextPath } from "../policy";

describe("homePathFor", () => {
  it("sends students to /app and staff to /admin", () => {
    expect(homePathFor("student")).toBe("/app");
    expect(homePathFor("teacher")).toBe("/admin");
    expect(homePathFor("owner")).toBe("/owner");
  });
});

describe("safeNextPath", () => {
  it("allows paths inside the role's own area", () => {
    expect(safeNextPath("/app/homework", "student")).toBe("/app/homework");
    expect(safeNextPath("/admin/students", "teacher")).toBe("/admin/students");
  });
  it.each(["//evil.com", "https://evil.com", "/\\evil.com", "evil", "", null, "/application"])(
    "rejects %s",
    (next) => {
      expect(safeNextPath(next, "student")).toBe("/app");
    },
  );
  it("keeps students out of /admin", () => {
    expect(safeNextPath("/admin", "student")).toBe("/app");
  });
});
