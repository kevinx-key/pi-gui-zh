/**
 * THROWAWAY diagnostic: cost of streaming a parent while many orchestration
 * child threads are projected. Mirrors streaming-profile.spec.ts but seeds N
 * children with large transcripts, to reproduce "opening a task freezes".
 */
import { expect, test, type Page } from "@playwright/test";
import type { SessionDriverEvent, SessionRef } from "@pi-gui/session-driver";
import {
  createSessionViaIpc,
  emitTestSessionEvents,
  getDesktopState,
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
  selectSession,
  waitForWorkspaceByPath,
  type DesktopHarness,
} from "../helpers/electron-app";

const N_CHILDREN = Number(process.env.PERF_CHILDREN ?? 25);
const CHILD_STEPS = Number(process.env.PERF_CHILD_STEPS ?? 30);
const DELTAS = Number(process.env.PERF_DELTAS ?? 120);

function now(): string {
  return new Date().toISOString();
}

async function createChildThrottle(
  harness: DesktopHarness,
  parent: SessionRef,
  callId: string,
  expected: number,
  window: Page,
): Promise<SessionRef> {
  const events: SessionDriverEvent[] = [
    {
      type: "toolStarted",
      sessionRef: parent,
      timestamp: now(),
      toolName: "create_child_thread",
      callId,
      input: { prompt: `child ${callId}` },
    } as SessionDriverEvent,
    {
      type: "toolFinished",
      sessionRef: parent,
      timestamp: now(),
      callId,
      success: true,
      output: {
        content: [{ type: "text", text: "Child thread created" }],
        details: { action: "pi_gui_create_child_thread", prompt: `child ${callId}` },
      },
    } as SessionDriverEvent,
  ];
  await emitTestSessionEvents(harness, events);
  await expect
    .poll(async () => (await getDesktopState(window)).orchestrationChildren.length)
    .toBe(expected);
  const child = (await getDesktopState(window)).orchestrationChildren.find(
    (entry) => entry.sourceToolCallId === callId,
  );
  if (!child) throw new Error(`child ${callId} not found`);
  return { workspaceId: child.childWorkspaceId, sessionId: child.childSessionId };
}

async function seedChildTranscript(
  harness: DesktopHarness,
  childRef: SessionRef,
  steps: number,
): Promise<void> {
  const events: SessionDriverEvent[] = [];
  for (let j = 0; j < steps; j += 1) {
    const ts = now();
    events.push({
      type: "toolStarted",
      sessionRef: childRef,
      timestamp: ts,
      toolName: "grep",
      callId: `c-${childRef.sessionId}-${j}`,
      input: { pattern: `FAIL-${j}`, path: "report.md" },
    } as SessionDriverEvent);
    events.push({
      type: "toolFinished",
      sessionRef: childRef,
      timestamp: ts,
      toolName: "grep",
      callId: `c-${childRef.sessionId}-${j}`,
      success: true,
      output: `match ${j}`,
    } as SessionDriverEvent);
    events.push({
      type: "assistantDelta",
      sessionRef: childRef,
      timestamp: ts,
      runId: `run-${j}`,
      text: `child step ${j} output `,
    } as SessionDriverEvent);
    events.push({
      type: "assistantMessageEnded",
      sessionRef: childRef,
      timestamp: ts,
      runId: `run-${j}`,
    } as SessionDriverEvent);
  }
  await emitTestSessionEvents(harness, events);
}

async function patchClones(harness: DesktopHarness): Promise<void> {
  await harness.electronApp.evaluate(() => {
    const g = globalThis as unknown as Record<string, unknown>;
    if (!g.__clonePatched) {
      g.__clonePatched = true;
      const original = globalThis.structuredClone;
      globalThis.structuredClone = <T>(value: T, options?: StructuredSerializeOptions): T => {
        const started = performance.now();
        const result = original(value, options);
        const store = globalThis as unknown as { __cloneCount: number; __cloneMs: number };
        store.__cloneCount += 1;
        store.__cloneMs += performance.now() - started;
        return result;
      };
    }
    g.__cloneCount = 0;
    g.__cloneMs = 0;
  });
}

async function startMainSample(harness: DesktopHarness): Promise<void> {
  await harness.electronApp.evaluate(() => {
    const g = globalThis as unknown as Record<string, unknown>;
    g.__perfCpu = process.cpuUsage();
    g.__perfWall = Date.now();
  });
}

async function stopMainSample(
  harness: DesktopHarness,
): Promise<{ cpuUserMs: number; wallMs: number; cloneCount: number; cloneMs: number }> {
  return harness.electronApp.evaluate(() => {
    const g = globalThis as unknown as {
      __perfCpu: NodeJS.CpuUsage;
      __perfWall: number;
      __cloneCount: number;
      __cloneMs: number;
    };
    const delta = process.cpuUsage(g.__perfCpu);
    return {
      cpuUserMs: delta.user / 1000,
      wallMs: Date.now() - g.__perfWall,
      cloneCount: g.__cloneCount ?? 0,
      cloneMs: g.__cloneMs ?? 0,
    };
  });
}

test("streaming cost with many children", async () => {
  test.setTimeout(900_000);
  const userDataDir = await makeUserDataDir();
  const workspacePath = await makeWorkspace("perf-children");
  const harness = await launchDesktop(userDataDir, {
    initialWorkspaces: [workspacePath],
    testMode: "background",
  });
  try {
    const window = await harness.firstWindow();
    await waitForWorkspaceByPath(window, workspacePath);
    await createSessionViaIpc(window, workspacePath, "perf-parent");
    await selectSession(window, "perf-parent");
    const state = await getDesktopState(window);
    const ws = state.workspaces.find((w) => w.id === state.selectedWorkspaceId)!;
    const session = ws.sessions.find((s) => s.id === state.selectedSessionId)!;
    const parentRef: SessionRef = { workspaceId: ws.id, sessionId: session.id };
    const workspaceRef = { workspaceId: ws.id, path: ws.path, displayName: ws.name };

    for (let i = 0; i < N_CHILDREN; i += 1) {
      const childRef = await createChildThrottle(harness, parentRef, `child-${i}`, i + 1, window);
      await seedChildTranscript(harness, childRef, CHILD_STEPS);
    }
    // Back to the parent so its timeline (with N child blocks) is on screen.
    await selectSession(window, "perf-parent");

    await window.evaluate(() => {
      const g = globalThis as unknown as Record<string, unknown>;
      g.__perfLongTaskMs = 0;
      try {
        const observer = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            (globalThis as unknown as { __perfLongTaskMs: number }).__perfLongTaskMs += e.duration;
          }
        });
        observer.observe({ entryTypes: ["longtask"] });
        g.__perfObserver = observer;
      } catch {
        // ignore
      }
    });

    const runId = `perf-${Date.now()}`;
    const startedAt = now();
    await emitTestSessionEvents(harness, [
      {
        type: "sessionUpdated",
        sessionRef: parentRef,
        timestamp: startedAt,
        runId,
        snapshot: {
          ref: parentRef,
          workspace: workspaceRef,
          title: session.title,
          status: "running",
          updatedAt: startedAt,
          preview: "streaming",
          runningRunId: runId,
        },
      } as SessionDriverEvent,
    ]);

    await patchClones(harness);
    await startMainSample(harness);
    const t0 = Date.now();
    for (let index = 0; index < DELTAS; index += 1) {
      await emitTestSessionEvents(harness, [
        {
          type: "assistantDelta",
          sessionRef: parentRef,
          timestamp: now(),
          runId,
          text: `tok${index} `,
        } as SessionDriverEvent,
        {
          type: "sessionUpdated",
          sessionRef: parentRef,
          timestamp: now(),
          runId,
          snapshot: {
            ref: parentRef,
            workspace: workspaceRef,
            title: session.title,
            status: "running",
            updatedAt: now(),
            preview: `tok${index}`,
            runningRunId: runId,
          },
        } as SessionDriverEvent,
      ]);
    }
    const streamWallMs = Date.now() - t0;
    const main = await stopMainSample(harness);

    const createDuringStreamMs = await window
      .evaluate(async (workspaceId) => {
        const app = globalThis.window.piApp;
        const started = performance.now();
        await app!.createSession({ workspaceId, title: `during-${Date.now()}` });
        return performance.now() - started;
      }, ws.id)
      .catch(() => null);

    const longTaskMs = await window.evaluate(() => {
      const g = globalThis as unknown as {
        __perfLongTaskMs: number;
        __perfObserver?: PerformanceObserver;
      };
      g.__perfObserver?.disconnect();
      return g.__perfLongTaskMs;
    });

    const cpuMsPerDelta = main.cpuUserMs / DELTAS;
    // Regression guard for the "opening a task freezes" bug: a summary-only card keeps the main
    // process near the childless baseline. Before the fix a 25-child session burned ~24 ms/delta
    // here (almost all of it cloning the state); the bound is loose to survive a slow CI box.
    expect(cpuMsPerDelta).toBeLessThan(10);

    console.log(
      JSON.stringify(
        {
          children: N_CHILDREN,
          childSteps: CHILD_STEPS,
          deltas: DELTAS,
          streamWallMs,
          mainCpuUserMs: Number(main.cpuUserMs.toFixed(0)),
          mainCpuMsPerDelta: Number(cpuMsPerDelta.toFixed(2)),
          cloneCount: main.cloneCount,
          cloneMs: Number(main.cloneMs.toFixed(0)),
          cloneMsPerDelta: Number((main.cloneMs / DELTAS).toFixed(2)),
          createDuringStreamMs:
            createDuringStreamMs === null ? "unavailable" : Number(createDuringStreamMs.toFixed(0)),
          rendererLongTaskMs: Number(longTaskMs.toFixed(0)),
        },
        null,
        2,
      ),
    );
  } finally {
    await harness.close();
  }
});
