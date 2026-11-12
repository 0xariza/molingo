// spec: specs/classroom.plan.md
// seed: e2e/seed.spec.ts
// Needs the LiveKit dev server (see the "live-room" project in playwright.config.ts).
import type { Browser, Page } from "@playwright/test";
import { eq } from "drizzle-orm";
import { sessionParticipants, sessions } from "@/db/schema";
import { createLearner, createUser } from "@/test/factories";
import { ADMIN, expect, login, messages, PASSWORD, STUDENT, test } from "../fixtures";

const t = messages.en.Classroom;
const SHARE = { width: 1000, height: 800 }; // a window that is not 16:9

/** Stands in for the screen picker: a 1000 × 800 "window" with a red bar at its top and bottom. */
const fakeWindowShare = () => {
  const calls: unknown[] = [];
  Object.assign(window, { __shareCalls: calls });
  navigator.mediaDevices.getDisplayMedia = async (constraints) => {
    calls.push(constraints);
    const canvas = document.createElement("canvas");
    canvas.width = 1000;
    canvas.height = 800;
    const g = canvas.getContext("2d")!;
    const draw = () => {
      g.fillStyle = "#fff";
      g.fillRect(0, 0, 1000, 800);
      g.fillStyle = "#d00";
      g.fillRect(0, 0, 1000, 40);
      g.fillRect(0, 760, 1000, 40);
      g.fillStyle = "#000";
      g.font = "64px sans-serif";
      g.fillText(String(Date.now() % 100000), 200, 420);
    };
    draw();
    setInterval(draw, 100);
    const stream = canvas.captureStream(15);
    // As a real window share reports itself.
    const [track] = stream.getVideoTracks();
    const settings = track.getSettings.bind(track);
    track.getSettings = () => ({ ...settings(), displaySurface: "window" });
    return stream;
  };
};

async function enterRoom(page: Page, path: string) {
  await page.goto(path);
  await page.getByRole("button", { name: t.prejoin.join, exact: true }).click();
  await expect(page.getByRole("button", { name: t.controls.leave })).toBeVisible({
    timeout: 30_000,
  });
}

async function learnerAndTeacher(browser: Browser, baseURL: string | undefined) {
  const options = { baseURL, permissions: ["camera", "microphone"] as "camera"[] };
  const teacher = await (await browser.newContext(options)).newPage();
  const learner = await (await browser.newContext(options)).newPage();
  return { teacher, learner };
}

test.describe("The live room with a real LiveKit server", () => {
  test("a shared window arrives whole and the stage fits the screen", async ({
    browser,
    baseURL,
    seedClassroom,
  }) => {
    const { sessionId } = await seedClassroom(-5);
    const { teacher, learner } = await learnerAndTeacher(browser, baseURL);
    await teacher.addInitScript(fakeWindowShare);

    await login(teacher, ADMIN.local, PASSWORD);
    await login(learner, STUDENT.local, PASSWORD);
    await enterRoom(teacher, `/en/admin/classroom/${sessionId}`);
    await enterRoom(learner, `/en/app/classroom/${sessionId}`);

    // Grid: both see two people, every tile inside the window, and nothing scrolls sideways.
    for (const page of [teacher, learner]) {
      await expect(page.getByRole("figure")).not.toHaveCount(0);
      const { scroll, inside } = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth - innerWidth,
        inside: [...document.querySelectorAll("figure")].every((f) => {
          const r = f.getBoundingClientRect();
          return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
        }),
      }));
      expect(scroll).toBeLessThanOrEqual(0);
      expect(inside).toBe(true);
    }

    // Mona shares a window. She asked the browser for the window's own size (no 1080p crop).
    await teacher.getByRole("button", { name: t.controls.share, exact: true }).click();
    const asked = await teacher.evaluate(() =>
      JSON.stringify((window as unknown as { __shareCalls: unknown[] }).__shareCalls[0]),
    );
    expect(asked).not.toMatch(/width|height/);

    // Mona sees the same window in her own class, labelled, with no "presenting" card instead.
    const mine = teacher.getByRole("figure", { name: /'s screen$/ });
    await expect(mine).toBeVisible({ timeout: 20_000 });
    await expect(teacher.getByText(t.stage.sharedToAll)).toBeVisible();
    await expect(teacher.getByText(t.stage.presenting)).toBeHidden();

    // Sara sees it: same shape as the window, nothing cut off (red bars top and bottom).
    const screen = learner.getByRole("figure", { name: /'s screen$/ });
    await expect(screen).toBeVisible({ timeout: 20_000 });
    const video = screen.locator("video");
    await expect
      .poll(() => video.evaluate((v: HTMLVideoElement) => v.videoWidth))
      .toBeGreaterThan(0);
    const seen = await video.evaluate((v: HTMLVideoElement) => {
      const c = document.createElement("canvas");
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      const g = c.getContext("2d")!;
      g.drawImage(v, 0, 0);
      const px = (y: number) => [...g.getImageData(c.width / 2, y, 1, 1).data];
      return { ratio: v.videoWidth / v.videoHeight, top: px(5), bottom: px(c.height - 6) };
    });
    expect(seen.ratio).toBeCloseTo(SHARE.width / SHARE.height, 1);
    for (const edge of [seen.top, seen.bottom]) {
      expect(edge[0]).toBeGreaterThan(150); // red
      expect(edge[1]).toBeLessThan(80);
    }

    // The share is letterboxed inside its box, never cropped, and the whole box is on screen.
    const fit = await video.evaluate((v: HTMLVideoElement) => getComputedStyle(v).objectFit);
    expect(fit).toBe("contain");
    const box = (await screen.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(900);

    // Zoom: two steps make it 200 %, and it can't be dragged into empty space.
    const zoom = learner.getByRole("toolbar", { name: messages.en.Classroom.stage.zoom });
    await zoom.getByRole("button", { name: messages.en.Classroom.stage.zoomIn }).click();
    await zoom.getByRole("button", { name: messages.en.Classroom.stage.zoomIn }).click();
    await expect
      .poll(() => video.evaluate((v: HTMLVideoElement) => new DOMMatrix(v.style.transform).a))
      .toBe(2);
    await learner.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await learner.mouse.down();
    await learner.mouse.move(box.x + box.width / 2 + 2000, box.y + box.height / 2 + 2000, {
      steps: 5,
    });
    await learner.mouse.up();
    const pan = await video.evaluate((v: HTMLVideoElement) => {
      const m = new DOMMatrix(v.style.transform);
      return { x: m.e, y: m.f };
    });
    // 1000 × 800 fitted in the box, at 2×, can only overhang by half its size.
    expect(Math.abs(pan.x)).toBeLessThanOrEqual(box.width / 2 + 1);
    expect(Math.abs(pan.y)).toBeLessThanOrEqual(box.height / 2 + 1);

    // Mona stops; the stage returns to the people.
    await teacher.getByRole("button", { name: t.controls.stopShare }).first().click();
    await expect(screen).toBeHidden({ timeout: 20_000 });
  });
});

const SIZES = [
  { name: "laptop", width: 1440, height: 900 },
  { name: "small laptop", width: 1024, height: 640 },
  { name: "tablet", width: 800, height: 600 },
  { name: "phone", width: 390, height: 844 },
  { name: "phone sideways", width: 844, height: 390 },
];

test("five people fill the stage at every screen size", async ({
  browser,
  baseURL,
  db,
  seedClassroom,
}) => {
  test.setTimeout(150_000); // five logins and five room joins
  const { sessionId } = await seedClassroom(-5);
  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
  const people = [
    { phone: ADMIN.local, path: "admin" },
    { phone: STUDENT.local, path: "app" },
  ];
  for (const n of [1, 2, 3]) {
    const phone = `+98912000010${n}`;
    const user = await createUser(db, { phone, displayName: `Kid ${n}`, password: PASSWORD });
    const learner = await createLearner(db, {
      teacherId: session.teacherId,
      userId: user.id,
      fullNameEn: `Kid ${n}`,
      phone,
    });
    await db.insert(sessionParticipants).values({ sessionId, studentId: learner.id });
    people.push({ phone: phone.replace("+98", "0"), path: "app" });
  }

  const pages: Page[] = [];
  for (const person of people) {
    const page = await (
      await browser.newContext({ baseURL, permissions: ["camera", "microphone"] })
    ).newPage();
    await login(page, person.phone, PASSWORD);
    await expect(page).not.toHaveURL(/login/);
    await enterRoom(page, `/en/${person.path}/classroom/${sessionId}`);
    pages.push(page);
  }
  const sara = pages[1];
  await expect(sara.getByRole("figure")).toHaveCount(5, { timeout: 30_000 });

  for (const size of SIZES) {
    await sara.setViewportSize(size);
    await sara.waitForTimeout(600); // the grid measures itself, then settles
    const m = await sara.evaluate(() => {
      const rect = (e: Element) => e.getBoundingClientRect();
      // Your own floating video sits over the grid on purpose.
      const tiles = [...document.querySelectorAll("main figure:not([aria-label='You'])")]
        .map(rect)
        .filter((r) => r.width > 0 && r.height > 0);
      const stage = rect(document.querySelector("main")!);
      const leave = [...document.querySelectorAll("footer button")].map(rect);
      const overlap = tiles.some((a, i) =>
        tiles.some(
          (b, j) =>
            j > i &&
            a.left < b.right - 1 &&
            b.left < a.right - 1 &&
            a.top < b.bottom - 1 &&
            b.top < a.bottom - 1,
        ),
      );
      return {
        sideways: document.documentElement.scrollWidth - innerWidth,
        down: document.documentElement.scrollHeight - innerHeight,
        controlsVisible: leave.length > 0 && leave.every((r) => r.bottom <= innerHeight + 1),
        stageHeight: stage.height,
        biggest: Math.max(...tiles.map((r) => r.width * r.height)),
        smallest: Math.min(...tiles.map((r) => r.height)),
        overlap,
      };
    });
    const label = `${size.name} ${size.width}x${size.height}`;
    expect(m.sideways, `${label}: sideways scroll`).toBeLessThanOrEqual(0);
    expect(m.down, `${label}: page scrolls`).toBeLessThanOrEqual(0);
    expect(m.controlsVisible, `${label}: controls on screen`).toBe(true);
    expect(m.stageHeight, `${label}: stage height`).toBeGreaterThan(160);
    expect(m.smallest, `${label}: smallest tile`).toBeGreaterThan(50);
    if (size.width >= 768) expect(m.overlap, `${label}: tiles overlap`).toBe(false);
  }
});
