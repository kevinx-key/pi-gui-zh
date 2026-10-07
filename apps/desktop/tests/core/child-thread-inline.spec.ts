import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { join } from "node:path";
import type { SessionDriverEvent, SessionRef } from "@pi-gui/session-driver";
import {
  emitTestSessionEvents,
  getDesktopState,
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
  seedAgentDir,
} from "../helpers/electron-app";
import { createThread, type SessionContext } from "../helpers/session-event-test-helpers";

const CHILD_TOOL_CALL_ID = "call-create-child-inline";
const CHILD_PROMPT = "Count the failing tests in the report and summarize them.";
const CHILD_ANSWER = "The delegated report holds 3 failing tests, all in the retry path.";
const CHILD_TOOL_OUTPUT = "3 failing tests";

/** The parent's own tool row, which pi-gui answers by actually starting the child thread. */
async function emitChildThreadToolCall(
  harness: Awaited<ReturnType<typeof launchDesktop>>,
  session: SessionContext,
): Promise<void> {
  const timestamp = new Date().toISOString();
  const started: Extract<SessionDriverEvent, { type: "toolStarted" }> = {
    type: "toolStarted",
    sessionRef: session.sessionRef,
    timestamp,
    toolName: "create_child_thread",
    callId: CHILD_TOOL_CALL_ID,
    input: { prompt: CHILD_PROMPT },
  };
  const finished: Extract<SessionDriverEvent, { type: "toolFinished" }> = {
    type: "toolFinished",
    sessionRef: session.sessionRef,
    timestamp,
    callId: CHILD_TOOL_CALL_ID,
    success: true,
    output: {
      content: [{ type: "text", text: "Child thread created" }],
      details: { action: "pi_gui_create_child_thread", prompt: CHILD_PROMPT },
    },
  };
  await emitTestSessionEvents(harness, [started, finished]);
}

/** What the child itself did in its own session, which is what the parent block has to show. */
async function emitChildActivity(
  harness: Awaited<ReturnType<typeof launchDesktop>>,
  childRef: SessionRef,
  childTitle: string,
): Promise<void> {
  const timestamp = new Date().toISOString();
  const events: SessionDriverEvent[] = [
    {
      type: "toolStarted",
      sessionRef: childRef,
      timestamp,
      toolName: "grep",
      callId: "call-child-grep",
      input: { pattern: "FAIL", path: "report.md" },
    },
    {
      type: "toolFinished",
      sessionRef: childRef,
      timestamp,
      toolName: "grep",
      callId: "call-child-grep",
      success: true,
      output: CHILD_TOOL_OUTPUT,
    },
    { type: "assistantDelta", sessionRef: childRef, timestamp, text: CHILD_ANSWER },
    { type: "assistantMessageEnded", sessionRef: childRef, timestamp },
    {
      type: "runCompleted",
      sessionRef: childRef,
      timestamp,
      snapshot: {
        ref: childRef,
        workspace: {
          workspaceId: childRef.workspaceId,
          path: "",
          displayName: "",
        },
        title: childTitle,
        status: "idle",
        updatedAt: timestamp,
        preview: CHILD_ANSWER,
      },
    },
  ];
  await emitTestSessionEvents(harness, events);
}

async function selectedSessionRef(window: Page): Promise<SessionRef> {
  const state = await getDesktopState(window);
  if (!state.selectedWorkspaceId || !state.selectedSessionId) {
    throw new Error("Expected a selected session");
  }
  return { workspaceId: state.selectedWorkspaceId, sessionId: state.selectedSessionId };
}

test("a child thread's question reaches the parent window", async () => {
  test.setTimeout(90_000);
  const userDataDir = await makeUserDataDir();
  const agentDir = join(userDataDir, "agent");
  const workspacePath = await makeWorkspace("child-thread-question");
  await seedAgentDir(agentDir, { withOpenAiAuth: false });
  const harness = await launchDesktop(userDataDir, {
    agentDir,
    initialWorkspaces: [workspacePath],
    scrubProviderEnv: true,
    testMode: "background",
  });

  try {
    const window = await harness.firstWindow();
    const parent = await createThread(window, "Parent with a question");
    await emitChildThreadToolCall(harness, parent);
    await expect
      .poll(async () => (await getDesktopState(window)).orchestrationChildren.length)
      .toBe(1);
    const child = (await getDesktopState(window)).orchestrationChildren[0];
    const childRef: SessionRef = {
      workspaceId: child?.childWorkspaceId ?? "",
      sessionId: child?.childSessionId ?? "",
    };

    // The child session is hidden in the sidebar, so its dialog has to be shown here.
    const requestId = "child-question-dialog";
    await emitTestSessionEvents(harness, [
      {
        type: "hostUiRequest",
        sessionRef: childRef,
        timestamp: new Date().toISOString(),
        request: {
          kind: "select",
          requestId,
          title: "Continue with the wide refactor?",
          options: ["Keep it narrow", "Refactor everything"],
          allowMultiple: false,
          allowCustom: true,
        },
      },
    ]);

    const dialog = window.getByTestId("extension-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Continue with the wide refactor?");
    await expect(
      window.getByTestId("extension-dialog-choice").filter({ hasText: "Keep it narrow" }),
    ).toBeVisible();
    await expect(window.getByTestId("extension-dialog-custom")).toBeVisible();

    await emitTestSessionEvents(harness, [
      {
        type: "hostUiRequest",
        sessionRef: childRef,
        timestamp: new Date().toISOString(),
        request: { kind: "dismiss", requestId },
      },
    ]);
    await expect(dialog).toBeHidden();
  } finally {
    await harness.close();
  }
});

test("a child thread shows in the parent timeline and stays out of the sidebar", async () => {
  test.setTimeout(90_000);
  const userDataDir = await makeUserDataDir();
  const agentDir = join(userDataDir, "agent");
  const workspacePath = await makeWorkspace("child-thread-inline");
  await seedAgentDir(agentDir, { withOpenAiAuth: false });
  const harness = await launchDesktop(userDataDir, {
    agentDir,
    initialWorkspaces: [workspacePath],
    scrubProviderEnv: true,
    testMode: "background",
  });

  try {
    const window = await harness.firstWindow();
    const parent = await createThread(window, "Parent thread");

    await emitChildThreadToolCall(harness, parent);
    await expect
      .poll(async () => (await getDesktopState(window)).orchestrationChildren.length)
      .toBe(1);
    const child = (await getDesktopState(window)).orchestrationChildren[0];
    expect(child?.sourceToolCallId).toBe(CHILD_TOOL_CALL_ID);
    expect(child?.parentSessionId).toBe(parent.sessionRef.sessionId);
    const childRef: SessionRef = {
      workspaceId: child?.childWorkspaceId ?? "",
      sessionId: child?.childSessionId ?? "",
    };

    // The child session is a real session, but it is not one of the sidebar's threads.
    expect(
      await window.locator(`.session-row[data-session-id="${childRef.sessionId}"]`).count(),
    ).toBe(0);

    const block = window.getByTestId("child-thread-block");
    await expect(block).toBeVisible();
    await expect(block).toContainText(child?.title ?? "");

    // Its activity arrives after the block is drawn, exactly as a running child's would.
    await emitChildActivity(harness, childRef, child?.title ?? "");
    await expect(block.locator(".child-thread__status--complete")).toBeVisible();

    await block.getByTestId("child-thread-toggle").click();
    const timeline = block.getByTestId("child-thread-timeline");
    await expect(timeline).toBeVisible();
    await expect(timeline).toContainText(CHILD_ANSWER);
    await expect(timeline).toContainText("grep");

    // Opening the child is the only way it becomes a listed thread, and then it is marked.
    await block.getByTestId("child-thread-open").click();
    await expect
      .poll(async () => (await getDesktopState(window)).selectedSessionId)
      .toBe(childRef.sessionId);
    const row = window.locator(`.session-row[data-session-id="${childRef.sessionId}"]`);
    await expect(row).toBeVisible();
    await expect(row.getByTestId("session-row-child-badge")).toBeVisible();
    expect(
      (await window.locator('.session-row[data-testid="session-row-child-badge"]').count()) < 2,
    ).toBe(true);

    // Back on the parent, the child row is gone again and the block is still there.
    await window.locator(`.session-row[data-session-id="${parent.sessionRef.sessionId}"]`).click();
    await expect
      .poll(async () => (await getDesktopState(window)).selectedSessionId)
      .toBe(parent.sessionRef.sessionId);
    await expect(
      window.locator(`.session-row[data-session-id="${childRef.sessionId}"]`),
    ).toHaveCount(0);
    await expect(window.getByTestId("child-thread-block")).toBeVisible();
    expect(await selectedSessionRef(window)).toEqual(parent.sessionRef);
  } finally {
    await harness.close();
  }
});
