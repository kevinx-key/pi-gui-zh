import { expect, test } from "@playwright/test";
import { join } from "node:path";
import {
  createSessionViaIpc,
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
  seedAgentDir,
  seedLargeBranchedTreeSessionFixture,
  seedTranscriptMessages,
  selectSession,
  waitForSelectedSessionReady,
} from "../helpers/electron-app";

test("the message rail jumps back to a user message", async () => {
  test.setTimeout(90_000);
  const userDataDir = await makeUserDataDir();
  const agentDir = join(userDataDir, "agent");
  const workspacePath = await makeWorkspace("message-rail");
  await seedAgentDir(agentDir);
  const fixture = await seedLargeBranchedTreeSessionFixture(agentDir, workspacePath);

  const harness = await launchDesktop(userDataDir, {
    agentDir,
    initialWorkspaces: [workspacePath],
    testMode: "background",
  });

  try {
    const page = await harness.firstWindow();
    await selectSession(page, fixture.title);
    await waitForSelectedSessionReady(page, fixture);
    // Length is what makes the rail worth having, so grow the selected thread first.
    await seedTranscriptMessages(harness, page, {
      count: 40,
      textFactory: (index) => `Filler row ${index}\n\n` + "Padding prose. ".repeat(30),
    });

    const marks = page.getByTestId("message-rail-mark");
    await expect(marks.first()).toBeVisible();
    expect(await marks.count()).toBeGreaterThan(1);

    const messageId = await marks.first().getAttribute("data-message-id");
    expect(messageId).toBeTruthy();
    const paneTop = () =>
      page.getByTestId("timeline-pane").evaluate((pane) => (pane as HTMLElement).scrollTop);
    const atBottom = await paneTop();

    await marks.first().click();

    const target = page.locator(`[data-message-id="${messageId}"]`);
    await expect(target).toBeInViewport();
    await expect.poll(paneTop).toBeLessThan(atBottom);
  } finally {
    await harness.close();
  }
});

test("right clicking a selection in the transcript offers Copy", async () => {
  test.setTimeout(90_000);
  const harness = await launchDesktop(await makeUserDataDir(), {
    initialWorkspaces: [await makeWorkspace("transcript-menu")],
    testMode: "background",
  });

  try {
    const page = await harness.firstWindow();
    const state = await page.evaluate(() => globalThis.window.piApp!.getState());
    await createSessionViaIpc(page, state.selectedWorkspaceId!, "Transcript menu");
    await seedTranscriptMessages(harness, page, {
      count: 3,
      textFactory: (index) => `Selectable transcript text ${index}`,
    });
    const row = page.locator("[data-message-id]").first();
    await expect(row).toBeVisible();

    // The clipboard write is stubbed: workers on one display share a clipboard, and this
    // spec only owns the menu's half of the path (the same `navigator.clipboard.writeText`
    // call the tool-copy button already uses).
    const selection = await row.evaluate((element) => {
      const copied: string[] = [];
      (globalThis as { __copied?: string[] }).__copied = copied;
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: (text: string) => {
            copied.push(text);
            return Promise.resolve();
          },
        },
      });
      const range = document.createRange();
      range.selectNodeContents(element);
      const current = window.getSelection();
      current?.removeAllRanges();
      current?.addRange(range);
      const box = element.getBoundingClientRect();
      return { text: current?.toString() ?? "", x: box.left + 24, y: box.top + 24 };
    });
    expect(selection.text.trim().length).toBeGreaterThan(0);

    await page.mouse.click(selection.x, selection.y, { button: "right" });
    await expect(page.getByTestId("transcript-copy")).toBeVisible();
    await page.getByTestId("transcript-copy").click();
    await expect(page.getByTestId("transcript-copy")).toHaveCount(0);
    expect(await page.evaluate(() => (globalThis as { __copied?: string[] }).__copied)).toEqual([
      selection.text,
    ]);

    // With nothing selected there is nothing to copy, so no menu appears.
    await page.evaluate(() => window.getSelection()?.removeAllRanges());
    await page.mouse.click(selection.x, selection.y, { button: "right" });
    await expect(page.getByTestId("transcript-copy")).toHaveCount(0);
  } finally {
    await harness.close();
  }
});
