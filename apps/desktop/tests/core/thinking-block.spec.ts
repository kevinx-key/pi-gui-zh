import { expect, test } from "@playwright/test";
import {
  createSessionViaIpc,
  emitTestSessionEvent,
  getDesktopState,
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
} from "../helpers/electron-app";

/*
 * Reasoning streams as its own event, and the block that shows it opens while the row is
 * live so the reader can watch it think, then closes once Pi has persisted the answer.
 */
test("reasoning streams into a block that collapses once the answer is stored", async () => {
  test.setTimeout(90_000);
  const harness = await launchDesktop(await makeUserDataDir(), {
    initialWorkspaces: [await makeWorkspace("thinking-block")],
    testMode: "background",
  });

  try {
    const page = await harness.firstWindow();
    await createSessionViaIpc(
      page,
      (await page.evaluate(() => globalThis.window.piApp!.getState())).selectedWorkspaceId!,
      "Thinking",
    );
    const state = await getDesktopState(page);
    const sessionRef = {
      workspaceId: state.selectedWorkspaceId!,
      sessionId: state.selectedSessionId!,
    };
    const timestamp = new Date().toISOString();

    await emitTestSessionEvent(harness, {
      type: "thinkingDelta",
      sessionRef,
      timestamp,
      text: "First I read the ",
    });
    await emitTestSessionEvent(harness, {
      type: "thinkingDelta",
      sessionRef,
      timestamp,
      text: "config file.",
    });
    await emitTestSessionEvent(harness, {
      type: "assistantDelta",
      sessionRef,
      timestamp,
      text: "The config is fine.",
    });

    const toggle = page.getByTestId("thinking-toggle");
    await expect(toggle).toBeVisible();
    await expect(page.getByTestId("thinking-body")).toContainText("First I read the config file.");
    await expect(page.getByTestId("transcript")).toContainText("The config is fine.");
    // The live row thinks out loud.
    await expect(toggle).toHaveAttribute("aria-expanded", "true");

    await emitTestSessionEvent(harness, {
      type: "assistantMessageEnded",
      sessionRef,
      timestamp,
    });
    await emitTestSessionEvent(harness, {
      type: "assistantMessagePersisted",
      sessionRef,
      timestamp,
      sourceMessageId: "persisted-thinking-row",
    });
    // Answer stored: the reasoning steps out of the way on its own.
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByTestId("thinking-body")).toHaveCount(0);

    // A click pins it open, and the reasoning is still there to read.
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByTestId("thinking-body")).toContainText("config file.");
  } finally {
    await harness.close();
  }
});
