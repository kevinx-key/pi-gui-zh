import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";

/**
 * `pnpm test:desktop-unit` runs everything under `tests/` through Playwright (one Electron app per
 * spec), so the orchestration history rules are checked here as plain `node --test`:
 *
 *     node --test apps/desktop/tests/unit/orchestration-history.node-test.mjs
 *
 * The modules under test are Electron main-process TypeScript with no Electron imports, so they are
 * transpiled in memory and evaluated with the real Node `require` for everything outside `electron/`.
 */
const here = dirname(fileURLToPath(import.meta.url));
const electronRoot = resolve(here, "../../electron");
const nodeRequire = createRequire(import.meta.url);
const moduleCache = new Map();

function loadTsModule(filePath) {
  const cached = moduleCache.get(filePath);
  if (cached) {
    return cached.exports;
  }
  const module = { exports: {} };
  moduleCache.set(filePath, module);
  const { outputText } = ts.transpileModule(readFileSync(filePath, "utf8"), {
    fileName: filePath,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      isolatedModules: true,
    },
  });
  const localRequire = (request) => {
    if (!request.startsWith(".")) {
      return nodeRequire(request);
    }
    const target = resolve(dirname(filePath), request);
    return loadTsModule(target.endsWith(".ts") ? target : `${target}.ts`);
  };
  new Function("require", "module", "exports", "__filename", "__dirname", outputText)(
    localRequire,
    module,
    module.exports,
    filePath,
    dirname(filePath),
  );
  return module.exports;
}

const {
  DEFAULT_SUPERVISION_INTERVAL_MS,
  MIN_SUPERVISION_INTERVAL_MS,
  archiveOrchestrationChild,
  configureOrchestrationHistory,
  flushOrchestrationHistory,
  nextSupervisionRunAt,
  orchestrationHistoryFilePath,
  readOrchestrationChildArchive,
  supervisionIntervalMs,
  toPersistedOrchestrationChildren,
  trimFinishedOrchestrationChildrenOnLoad,
} = loadTsModule(resolve(electronRoot, "orchestration/orchestration-history.ts"));
const { readPersistedUiState, writePersistedUiState } = loadTsModule(
  resolve(electronRoot, "persistence/app-store-persistence.ts"),
);

const EVIDENCE_COUNT = 50;

function supervisionLoop(overrides = {}) {
  return {
    id: "loop-1",
    status: "monitoring",
    gate: "continue",
    intervalMs: DEFAULT_SUPERVISION_INTERVAL_MS,
    iterationCount: 1,
    lastCheckedAt: "2026-10-06T10:00:00.000Z",
    nextRunAt: "2026-10-06T10:05:00.000Z",
    reason: "Monitoring child thread.",
    lastChildStatus: "running",
    ...overrides,
  };
}

function evidence(index) {
  return {
    id: `worker:message-${index}`,
    childThreadId: "child-1",
    kind: "worker_report",
    source: "worker-reported",
    status: "reported",
    title: `Worker reported step ${index}`,
    detail: `Step ${index} finished with a finding long enough to matter: ${"x".repeat(600)}`,
    createdAt: new Date(Date.UTC(2026, 9, 6, 10, 0, index)).toISOString(),
  };
}

function childThread(overrides = {}) {
  return {
    id: "child-1",
    sourceToolCallId: "tool-call-1",
    parentWorkspaceId: "ws-1",
    parentSessionId: "parent-1",
    childWorkspaceId: "ws-1",
    childSessionId: "child-session-1",
    title: "Delegated child",
    goal: `Review the failing tests and summarize them. ${"g".repeat(500)}`,
    status: "running",
    latestTranscript: `Still working. ${"p".repeat(400)}`,
    transcript: Array.from({ length: 40 }, (_, index) => ({
      id: `message-${index}`,
      role: "child",
      text: `Transcript line ${index}`,
      createdAt: "2026-10-06T10:00:00.000Z",
    })),
    timeline: Array.from({ length: 60 }, (_, index) => ({
      kind: "message",
      id: `timeline-${index}`,
      createdAt: "2026-10-06T10:00:00.000Z",
    })),
    evidence: Array.from({ length: EVIDENCE_COUNT }, (_, index) => evidence(index)),
    supervisionLoop: supervisionLoop(),
    createdAt: "2026-10-06T09:59:00.000Z",
    updatedAt: "2026-10-06T10:00:00.000Z",
    ...overrides,
  };
}

async function tempUserDataDir() {
  return mkdtemp(join(tmpdir(), "orchestration-history-"));
}

function archiveLineCount(childId) {
  return readFile(orchestrationHistoryFilePath(childId), "utf8").then(
    (contents) => contents.split("\n").filter(Boolean).length,
  );
}

test("a persisted child keeps its state machine, not its history", async () => {
  const directory = await tempUserDataDir();
  configureOrchestrationHistory(join(directory, "ui-state.json"));

  const child = childThread();
  const [persisted] = toPersistedOrchestrationChildren([child]);

  assert.equal(persisted.evidence.length, 1);
  assert.equal(persisted.evidence[0].id, `worker:message-${EVIDENCE_COUNT - 1}`);
  assert.deepEqual(persisted.transcript, []);
  assert.deepEqual(persisted.timeline, []);
  assert.ok(persisted.goal.length <= 240, `goal stays a label, got ${persisted.goal.length}`);
  assert.ok(persisted.latestTranscript.length <= 240);
  assert.equal(persisted.status, "running");
  assert.deepEqual(persisted.supervisionLoop, child.supervisionLoop);

  const persistedBytes = JSON.stringify(persisted).length;
  const liveBytes = JSON.stringify(child).length;
  assert.ok(persistedBytes < 2_000, `one child stays small: ${persistedBytes} bytes`);
  assert.ok(liveBytes > 20_000, `the live record really is the big one: ${liveBytes} bytes`);

  // Persisting the same child again must not duplicate its log: a persist happens every few seconds.
  archiveOrchestrationChild(child);
  archiveOrchestrationChild(child);
  await flushOrchestrationHistory();

  assert.equal(
    orchestrationHistoryFilePath(child.id),
    join(directory, "orchestration", "child-1.ndjson"),
  );
  assert.equal(await archiveLineCount(child.id), EVIDENCE_COUNT);

  const archive = await readOrchestrationChildArchive(child.id);
  assert.equal(archive.evidence.length, EVIDENCE_COUNT);
  assert.equal(archive.evidence[0].id, `worker:message-${EVIDENCE_COUNT - 1}`);
  assert.equal(archive.snapshot, undefined, "a running child has no archive snapshot yet");
});

test("a finished child is archived once and never wakes the app again", async () => {
  const directory = await tempUserDataDir();
  configureOrchestrationHistory(join(directory, "ui-state.json"));

  const finished = childThread({
    id: "child-finished",
    status: "complete",
    supervisionLoop: supervisionLoop({ status: "attention", gate: "wake", nextRunAt: undefined }),
  });
  assert.equal(nextSupervisionRunAt([finished]), undefined);
  assert.equal(
    nextSupervisionRunAt([
      childThread({
        id: "child-stopped",
        supervisionLoop: supervisionLoop({ status: "stopped", nextRunAt: undefined }),
      }),
    ]),
    undefined,
  );
  // A stale future wake left in a persisted file is inert once the child has finished.
  assert.equal(
    nextSupervisionRunAt([
      childThread({
        id: "child-failed",
        status: "failed",
        supervisionLoop: supervisionLoop({
          gate: "wake",
          nextRunAt: "2099-01-01T00:00:00.000Z",
        }),
      }),
    ]),
    undefined,
  );

  const later = childThread({
    id: "child-2",
    supervisionLoop: supervisionLoop({ nextRunAt: "2026-10-06T10:09:00.000Z" }),
  });
  assert.equal(
    nextSupervisionRunAt([finished, later, childThread({ id: "child-1" })]),
    "2026-10-06T10:05:00.000Z",
  );

  archiveOrchestrationChild(finished);
  archiveOrchestrationChild(finished);
  await flushOrchestrationHistory();

  const archive = await readOrchestrationChildArchive(finished.id);
  assert.equal(archive.snapshot?.status, "complete");
  assert.equal(archive.snapshot?.transcript.length, 40);
  assert.equal(archive.snapshot?.timeline.length, 60);
  assert.equal(await archiveLineCount(finished.id), EVIDENCE_COUNT + 1);
});

test("supervision wakes are minutes apart and can never spin", () => {
  assert.equal(DEFAULT_SUPERVISION_INTERVAL_MS, 5 * 60_000);
  assert.equal(MIN_SUPERVISION_INTERVAL_MS, 5_000);

  const previous = process.env.PI_APP_ORCHESTRATION_SUPERVISION_INTERVAL_MS;
  try {
    delete process.env.PI_APP_ORCHESTRATION_SUPERVISION_INTERVAL_MS;
    assert.equal(supervisionIntervalMs(), DEFAULT_SUPERVISION_INTERVAL_MS);
    process.env.PI_APP_ORCHESTRATION_SUPERVISION_INTERVAL_MS = "1000";
    assert.equal(supervisionIntervalMs(), MIN_SUPERVISION_INTERVAL_MS);
    process.env.PI_APP_ORCHESTRATION_SUPERVISION_INTERVAL_MS = "60000";
    assert.equal(supervisionIntervalMs(), 60_000);
  } finally {
    if (previous === undefined) {
      delete process.env.PI_APP_ORCHESTRATION_SUPERVISION_INTERVAL_MS;
    } else {
      process.env.PI_APP_ORCHESTRATION_SUPERVISION_INTERVAL_MS = previous;
    }
  }
});

test("ui-state.json holds a small orchestration slice that older files still load", async () => {
  const directory = await tempUserDataDir();
  const uiStatePath = join(directory, "ui-state.json");

  const child = childThread({ id: "child-e2e" });
  // Production configures this when the app first reads or writes ui-state.json, before any
  // payload is built; without it the archive has no directory and enqueueing is a no-op.
  configureOrchestrationHistory(uiStatePath);
  await writePersistedUiState(uiStatePath, {
    version: 19,
    composerDraft: "kept",
    orchestrationChildren: toPersistedOrchestrationChildren([child]),
  });
  await flushOrchestrationHistory();

  const written = await readFile(uiStatePath, "utf8");
  assert.ok(written.length < 5_000, `ui-state stays small: ${written.length} bytes`);
  const stored = JSON.parse(written);
  assert.equal(stored.orchestrationChildren.length, 1);
  assert.equal(stored.orchestrationChildren[0].evidence.length, 1);
  assert.equal(await archiveLineCount(child.id), EVIDENCE_COUNT);

  // Reading it back keeps the child's card and its supervision loop, with history on disk.
  const reloaded = await readPersistedUiState(uiStatePath);
  assert.equal(reloaded.composerDraft, "kept");
  assert.equal(reloaded.orchestrationChildren[0].status, "running");
  assert.equal(reloaded.orchestrationChildren[0].evidence.length, 1);
  assert.equal(
    reloaded.orchestrationChildren[0].supervisionLoop.nextRunAt,
    "2026-10-06T10:05:00.000Z",
  );

  // A file written by an older build (fat evidence, no archive) still loads, and migrating it
  // writes the small shape instead of failing.
  const legacyChild = childThread({ id: "child-legacy" });
  await writeFile(
    uiStatePath,
    JSON.stringify({ version: 19, orchestrationChildren: [legacyChild] }, null, 2),
    "utf8",
  );
  const legacy = await readPersistedUiState(uiStatePath);
  assert.equal(legacy.orchestrationChildren.length, 1);
  assert.equal(legacy.orchestrationChildren[0].evidence.length, EVIDENCE_COUNT);

  await writePersistedUiState(uiStatePath, {
    version: 19,
    orchestrationChildren: toPersistedOrchestrationChildren(legacy.orchestrationChildren),
  });
  await flushOrchestrationHistory();
  assert.ok((await readFile(uiStatePath, "utf8")).length < 5_000);
  assert.equal(await archiveLineCount("child-legacy"), EVIDENCE_COUNT);
});

test("a trimmed finished child still reads back its whole evidence log", async () => {
  const directory = await tempUserDataDir();
  configureOrchestrationHistory(join(directory, "ui-state.json"));

  const finished = childThread({ id: "child-archive-read", status: "complete" });
  // What a persist does: the log goes to the archive, the card keeps only the newest record.
  const [card] = toPersistedOrchestrationChildren([finished]);
  await flushOrchestrationHistory();
  assert.equal(card.evidence.length, 1, "ui-state keeps one record; the card cannot show more");

  // The read-only IPC channel hands the renderer exactly this shape, so expanding the card can
  // paint the full log without any of it going back into ui-state.json.
  const archive = await readOrchestrationChildArchive(card.id);
  assert.ok(archive, "a trimmed finished child still has an archive to read");
  assert.equal(archive.evidence.length, EVIDENCE_COUNT);
  assert.equal(archive.evidence[0].id, `worker:message-${EVIDENCE_COUNT - 1}`, "newest first");
  assert.equal(archive.evidence.at(-1).id, "worker:message-0");
  assert.equal(archive.snapshot?.id, card.id);
  assert.equal(archive.snapshot?.status, "complete");
  assert.equal(archive.snapshot?.transcript.length, 40);
  assert.equal(archive.snapshot?.timeline.length, 60);

  // A child with no archive file is `undefined`, which is what the card shows as "no history".
  assert.equal(await readOrchestrationChildArchive("child-never-archived"), undefined);
});

test("a finished child is trimmed to its card on load while a running one is left alone", async () => {
  const directory = await tempUserDataDir();
  configureOrchestrationHistory(join(directory, "ui-state.json"));

  const finished = childThread({ id: "child-done", status: "complete" });
  const running = childThread({ id: "child-live", status: "running" });

  const [doneAfter, liveAfter] = trimFinishedOrchestrationChildrenOnLoad([finished, running]);

  // The finished child keeps its card, and only its card: history moved to the archive.
  assert.equal(doneAfter.status, "complete");
  assert.equal(doneAfter.evidence.length, 1, "only the newest evidence stays in memory");
  assert.deepEqual(doneAfter.transcript, [], "the transcript is re-projected from the session");
  assert.deepEqual(doneAfter.timeline, [], "the timeline is re-projected from the session");
  await flushOrchestrationHistory();
  assert.equal(await archiveLineCount("child-done"), EVIDENCE_COUNT + 1, "history is on disk");

  // A restart must not disturb work in flight.
  assert.equal(liveAfter.evidence.length, EVIDENCE_COUNT, "a running child keeps its records");
  assert.equal(liveAfter.transcript.length, 40);
  assert.equal(liveAfter.timeline.length, 60);
});
