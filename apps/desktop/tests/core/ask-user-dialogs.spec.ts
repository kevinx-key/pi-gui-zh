import { expect, test } from "@playwright/test";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import type { SessionRef } from "@pi-gui/session-driver";
import {
  createNamedThread,
  getDesktopState,
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
  runAskUserTool,
  seedAgentDir,
} from "../helpers/electron-app";

async function selectedSessionRef(window: Page): Promise<SessionRef> {
  const state = await getDesktopState(window);
  if (!state.selectedWorkspaceId || !state.selectedSessionId) {
    throw new Error("Expected a selected session");
  }
  return { workspaceId: state.selectedWorkspaceId, sessionId: state.selectedSessionId };
}

async function launchAskUserHarness(name: string) {
  const userDataDir = await makeUserDataDir();
  const agentDir = join(userDataDir, "agent");
  const workspacePath = await makeWorkspace(name);
  await seedAgentDir(agentDir, { withOpenAiAuth: false });
  const harness = await launchDesktop(userDataDir, {
    agentDir,
    initialWorkspaces: [workspacePath],
    scrubProviderEnv: true,
    testMode: "background",
  });
  const window = await harness.firstWindow();
  await createNamedThread(window, "Ask the user thread");
  return { harness, window, sessionRef: await selectedSessionRef(window) };
}

test("ask_user waits for a choice, then returns the confirmed answer", async () => {
  test.setTimeout(60_000);
  const { harness, window, sessionRef } = await launchAskUserHarness("ask-user-choice");

  try {
    const pending = runAskUserTool(harness, {
      sessionRef,
      params: {
        question: "Which database should the worker use?",
        options: ["SQLite", "Postgres"],
        multiple: false,
        allow_custom: true,
      },
    });

    const dialog = window.getByTestId("extension-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Which database should the worker use?");

    // A question is not answered by the first click: it waits for Confirm.
    await window.getByTestId("extension-dialog-choice").filter({ hasText: "Postgres" }).click();
    await expect(dialog).toBeVisible();
    await window.getByTestId("extension-dialog-confirm").click();

    const result = await pending;
    expect(result.content[0]?.text).toBe("The user answered: Postgres");
    expect(result.details).toMatchObject({
      question: "Which database should the worker use?",
      answer: "Postgres",
    });
    await expect(dialog).toBeHidden();
  } finally {
    await harness.close();
  }
});

test("ask_user collects several options and a typed answer", async () => {
  test.setTimeout(60_000);
  const { harness, window, sessionRef } = await launchAskUserHarness("ask-user-multiple");

  try {
    const pending = runAskUserTool(harness, {
      sessionRef,
      params: {
        question: "Which checks should run before the commit?",
        options: ["Lint", "Unit tests", "End-to-end"],
        multiple: true,
        allow_custom: true,
      },
    });

    await expect(window.getByTestId("extension-dialog")).toBeVisible();
    await window.getByTestId("extension-dialog-choice").filter({ hasText: "Lint" }).click();
    await window.getByTestId("extension-dialog-choice").filter({ hasText: "End-to-end" }).click();
    await window.getByTestId("extension-dialog-custom").fill("Signed build");
    await window.getByTestId("extension-dialog-confirm").click();

    const result = await pending;
    expect(result.content[0]?.text).toBe("The user answered: Lint, End-to-end, Signed build");
    expect(result.details).toMatchObject({ answer: "Lint, End-to-end, Signed build" });
  } finally {
    await harness.close();
  }
});

test("closing the question returns a cancelled answer instead of hanging the tool", async () => {
  test.setTimeout(60_000);
  const { harness, window, sessionRef } = await launchAskUserHarness("ask-user-cancel");

  try {
    const pending = runAskUserTool(harness, {
      sessionRef,
      params: { question: "Ship it?", options: ["Ship", "Wait"], multiple: false },
    });

    const firstChoice = window.getByTestId("extension-dialog-choice").first();
    await expect(firstChoice).toBeVisible();
    await firstChoice.focus();
    await window.keyboard.press("Escape");

    const result = await pending;
    expect(result.content[0]?.text).toBe("The user closed the question without answering.");
    expect(result.details).toMatchObject({ cancelled: true });
    await expect(window.getByTestId("extension-dialog")).toBeHidden();
  } finally {
    await harness.close();
  }
});

test("a question without options is refused without opening a dialog", async () => {
  test.setTimeout(60_000);
  const { harness, window, sessionRef } = await launchAskUserHarness("ask-user-no-options");

  try {
    const result = await runAskUserTool(harness, {
      sessionRef,
      params: { question: "What should I do?", options: [] },
    });

    expect(result.content[0]?.text).toMatch(/between 1 and 12 options/);
    expect(result.details).toMatchObject({ error: expect.stringMatching(/options/) });
    await expect(window.getByTestId("extension-dialog")).toBeHidden();
  } finally {
    await harness.close();
  }
});
