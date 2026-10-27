import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { resetDb } from "@/test/factories";
import { createTeacherLead, listTeacherLeads, teacherLeadSchema } from "../teacher-leads";

beforeEach(() => resetDb(db));

describe("teacher leads", () => {
  it("reads Persian digits and lists requests newest first", async () => {
    const input = teacherLeadSchema.parse({
      name: "Ali Karimi",
      phone: "۰۹۳۵ ۰۰۰ ۰۰۰۹",
      learners: "۱۲",
      locale: "fa",
    });
    expect(input).toMatchObject({ phone: "+989350000009", learners: 12 });
    await createTeacherLead(input);
    await createTeacherLead({ ...input, name: "Sara Nouri" });
    expect((await listTeacherLeads()).map((l) => l.name)).toEqual(["Sara Nouri", "Ali Karimi"]);
  });

  it("reports each bad field with its key", () => {
    const r = teacherLeadSchema.safeParse({ name: "A", phone: "12", learners: "-1", locale: "fa" });
    expect(r.error!.issues.map((i) => i.message).sort()).toEqual(["learners", "name", "phone"]);
  });
});
