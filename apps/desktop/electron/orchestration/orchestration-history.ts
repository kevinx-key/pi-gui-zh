import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  OrchestrationChildArchive,
  OrchestrationChildHistorySnapshot,
  OrchestrationChildThread,
  OrchestrationEvidenceRecord,
} from "../../contracts/desktop-state";

// The archive's shape is a shared contract: the renderer's lazy history panel reads it over IPC.
export type {
  OrchestrationChildArchive,
  OrchestrationChildHistorySnapshot,
} from "../../contracts/desktop-state";

/**
 * Orchestration history lives outside `ui-state.json`.
 *
 * The store keeps exactly one snapshot of the whole UI state and rewrites the file on every change
 * (debouced by 250 ms), so every byte in it is re-serialized every few seconds: a real profile had
 * 892 KB of child evidence inside a 1.2 MB file, which is what pinned the Electron main process.
 * Only what the supervision state machine needs stays in the snapshot — identity, status, the
 * loop's `intervalMs`/`nextRunAt` and the child's newest evidence record. The evidence log, plus a
 * snapshot of a child's record when it finishes, are appended to
 * `<userData>/orchestration/<childId>.ndjson`, one JSON object per line, and read back on demand.
 */
const HISTORY_DIRECTORY_NAME = "orchestration";
const HISTORY_FILE_VERSION = 1;
/** One evidence record is enough to describe a child in the snapshot; the log keeps the rest. */
const RETAINED_EVIDENCE_RECORDS = 1;
/** Persisted `goal`/preview text is a label and a preview, not the payload the child was given. */
const MAX_PERSISTED_CHILD_TEXT_LENGTH = 240;

/**
 * How long a supervised child may go unchecked. A tick only re-reads a session that is still
 * working, so this is a backstop, not a poll: nothing else about a child changes without an event.
 */
export const DEFAULT_SUPERVISION_INTERVAL_MS = 5 * 60_000;
/** Even an operator-configured interval keeps a debounce floor, so a tick can never spin. */
export const MIN_SUPERVISION_INTERVAL_MS = 5_000;

const ORCHESTRATION_SUPERVISION_INTERVAL_ENV = "PI_APP_ORCHESTRATION_SUPERVISION_INTERVAL_MS";

interface OrchestrationHistoryLine {
  readonly v: number;
  readonly childId: string;
  readonly at: string;
  readonly kind: "evidence" | "child";
  readonly evidence?: OrchestrationEvidenceRecord;
  readonly child?: OrchestrationChildHistorySnapshot;
}

let historyDirectory: string | undefined;
/** Record keys already on disk, per child: the append log must not gain the same record twice. */
const archivedKeysByChild = new Map<string, Set<string>>();
const appendQueues = new Map<string, Promise<void>>();

/** The archive sits next to `ui-state.json`, so the app-data directory is all this needs to know. */
export function configureOrchestrationHistory(uiStateFilePath: string | undefined): void {
  historyDirectory = uiStateFilePath
    ? join(dirname(uiStateFilePath), HISTORY_DIRECTORY_NAME)
    : undefined;
}

export function orchestrationHistoryDirectory(): string | undefined {
  return historyDirectory;
}

/**
 * A finished child needs no further supervision: it reached a terminal status, or its loop was
 * stopped by hand. Finished children keep their card (the parent window draws it, and the sidebar
 * hides the child's session behind it) but are never scheduled and never re-projected.
 */
export function isFinishedOrchestrationChild(child: OrchestrationChildThread): boolean {
  return (
    child.status === "complete" ||
    child.status === "failed" ||
    child.supervisionLoop?.status === "stopped"
  );
}

/**
 * The earliest wake any child still needs. Finished children are skipped even when a stale
 * `nextRunAt` survived a persisted file or a hand-stopped loop, which is what keeps a finished
 * child from waking the main process forever.
 */
export function nextSupervisionRunAt(
  children: readonly OrchestrationChildThread[],
): string | undefined {
  return children
    .flatMap((child) => {
      const nextRunAt = child.supervisionLoop?.nextRunAt;
      return !isFinishedOrchestrationChild(child) &&
        nextRunAt &&
        Number.isFinite(Date.parse(nextRunAt))
        ? [nextRunAt]
        : [];
    })
    .sort()[0];
}

export function supervisionIntervalMs(): number {
  const configured = Number(process.env[ORCHESTRATION_SUPERVISION_INTERVAL_ENV]);
  if (!Number.isFinite(configured) || configured <= 0) {
    return DEFAULT_SUPERVISION_INTERVAL_MS;
  }
  return Math.max(MIN_SUPERVISION_INTERVAL_MS, Math.floor(configured));
}

/**
 * The record `ui-state.json` keeps for a child: everything the supervision state machine and the
 * child's card need, and nothing that grows with the child's work.
 */
export function toPersistedOrchestrationChild(
  child: OrchestrationChildThread,
): OrchestrationChildThread {
  return {
    id: child.id,
    ...(child.sourceToolCallId ? { sourceToolCallId: child.sourceToolCallId } : {}),
    parentWorkspaceId: child.parentWorkspaceId,
    parentSessionId: child.parentSessionId,
    childWorkspaceId: child.childWorkspaceId,
    childSessionId: child.childSessionId,
    title: child.title,
    goal: persistedText(child.goal),
    status: child.status,
    latestTranscript: persistedText(child.latestTranscript),
    // A child with a session re-projects both from that session's cached transcript on load; a
    // legacy record without one keeps its transcript, which is the only copy that exists.
    transcript: child.childSessionId ? [] : child.transcript,
    timeline: child.childSessionId ? [] : child.timeline,
    evidence: newestEvidence(child.evidence),
    supervisionLoop: child.supervisionLoop,
    createdAt: child.createdAt,
    updatedAt: child.updatedAt,
  };
}

/**
 * The slice of `ui-state.json` that orchestration owns: every child reduced to what the state
 * machine and its card need, with everything else appended to that child's archive.
 */
export function toPersistedOrchestrationChildren(
  children: readonly OrchestrationChildThread[],
): readonly OrchestrationChildThread[] | undefined {
  if (children.length === 0) {
    return undefined;
  }
  return children.map((child) => {
    archiveOrchestrationChild(child);
    return toPersistedOrchestrationChild(child);
  });
}

/**
 * Load-time trim: a finished child keeps its card and nothing else — its history goes to the
 * archive first (nothing is lost), then the in-memory record drops the transcript, the timeline
 * and all but the newest evidence, which the parent window re-projects from the child's session.
 * Children that are still running (or waiting on a supervision loop) are left untouched, so an
 * app restart does not disturb work in flight.
 */
export function trimFinishedOrchestrationChildrenOnLoad(
  children: readonly OrchestrationChildThread[],
): readonly OrchestrationChildThread[] {
  return children.map((child) => {
    if (!isFinishedOrchestrationChild(child)) {
      return child;
    }
    archiveOrchestrationChild(child);
    return toPersistedOrchestrationChild(child);
  });
}

/**
 * Append whatever the child has produced since the last call to its archive. Appends are queued per
 * child and fire-and-forget: persisting UI state must never wait on a log write, and a missing
 * archive must never fail a persist. Reading stops at the newest record per id, so re-appending a
 * record that a previous run already wrote is harmless.
 */
export function archiveOrchestrationChild(child: OrchestrationChildThread): void {
  if (!historyDirectory) {
    return;
  }
  const archived = archivedKeys(child.id);
  const at = new Date().toISOString();
  const lines: string[] = [];
  for (const record of child.evidence) {
    const key = `evidence:${record.id}`;
    if (archived.has(key)) {
      continue;
    }
    archived.add(key);
    lines.push(encodeHistoryLine({ kind: "evidence", childId: child.id, at, evidence: record }));
  }
  if (isFinishedOrchestrationChild(child) && !archived.has("child")) {
    archived.add("child");
    lines.push(
      encodeHistoryLine({ kind: "child", childId: child.id, at, child: childSnapshot(child) }),
    );
  }
  appendHistoryLines(child.id, lines);
}

/** Read a child's archive back: the catalog snapshot plus its evidence log, newest first. */
export async function readOrchestrationChildArchive(
  childId: string,
): Promise<OrchestrationChildArchive | undefined> {
  const filePath = orchestrationHistoryFilePath(childId);
  if (!filePath) {
    return undefined;
  }
  let contents: string;
  try {
    contents = await readFile(filePath, "utf8");
  } catch (error) {
    if (isMissingFileError(error)) {
      return undefined;
    }
    throw error;
  }

  let snapshot: OrchestrationChildHistorySnapshot | undefined;
  const evidence = new Map<string, OrchestrationEvidenceRecord>();
  for (const line of contents.split("\n")) {
    const entry = decodeHistoryLine(line, childId);
    if (!entry) {
      continue;
    }
    if (entry.kind === "evidence" && entry.evidence) {
      evidence.set(entry.evidence.id, entry.evidence);
    } else if (entry.kind === "child" && entry.child) {
      snapshot = entry.child;
    }
  }

  // Reading the log claims its records: a later persist of the same child appends only new ones.
  const archived = archivedKeys(childId);
  for (const id of evidence.keys()) {
    archived.add(`evidence:${id}`);
  }
  if (snapshot) {
    archived.add("child");
  }

  return {
    ...(snapshot ? { snapshot } : {}),
    evidence: [...evidence.values()].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    ),
  };
}

/** Resolves once every queued append has hit the disk; used by tests and shutdown paths. */
export async function flushOrchestrationHistory(): Promise<void> {
  while (appendQueues.size > 0) {
    await Promise.all([...appendQueues.values()]);
  }
}

export function orchestrationHistoryFilePath(childId: string): string | undefined {
  return historyDirectory
    ? join(historyDirectory, `${encodeURIComponent(childId)}.ndjson`)
    : undefined;
}

function childSnapshot(child: OrchestrationChildThread): OrchestrationChildHistorySnapshot {
  return {
    id: child.id,
    title: child.title,
    goal: child.goal,
    status: child.status,
    parentWorkspaceId: child.parentWorkspaceId,
    parentSessionId: child.parentSessionId,
    childWorkspaceId: child.childWorkspaceId,
    childSessionId: child.childSessionId,
    createdAt: child.createdAt,
    updatedAt: child.updatedAt,
    transcript: child.transcript,
    timeline: child.timeline,
  };
}

function newestEvidence(
  evidence: readonly OrchestrationEvidenceRecord[],
): readonly OrchestrationEvidenceRecord[] {
  return [...evidence]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, RETAINED_EVIDENCE_RECORDS);
}

function persistedText(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > MAX_PERSISTED_CHILD_TEXT_LENGTH
    ? `${normalized.slice(0, MAX_PERSISTED_CHILD_TEXT_LENGTH - 3)}...`
    : normalized;
}

function archivedKeys(childId: string): Set<string> {
  const existing = archivedKeysByChild.get(childId);
  if (existing) {
    return existing;
  }
  const created = new Set<string>();
  archivedKeysByChild.set(childId, created);
  return created;
}

function encodeHistoryLine(entry: Omit<OrchestrationHistoryLine, "v">): string {
  return JSON.stringify({ v: HISTORY_FILE_VERSION, ...entry } satisfies OrchestrationHistoryLine);
}

function decodeHistoryLine(line: string, childId: string): OrchestrationHistoryLine | undefined {
  if (!line.trim()) {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    // A torn last line (crash mid-append) must not hide the records before it.
    return undefined;
  }
  if (!parsed || typeof parsed !== "object") {
    return undefined;
  }
  const entry = parsed as Partial<OrchestrationHistoryLine>;
  if (entry.v !== HISTORY_FILE_VERSION || entry.childId !== childId) {
    return undefined;
  }
  if (entry.kind !== "evidence" && entry.kind !== "child") {
    return undefined;
  }
  return entry as OrchestrationHistoryLine;
}

function appendHistoryLines(childId: string, lines: readonly string[]): void {
  const filePath = orchestrationHistoryFilePath(childId);
  const directory = historyDirectory;
  if (!filePath || !directory || lines.length === 0) {
    return;
  }
  const payload = `${lines.join("\n")}\n`;
  const previous = appendQueues.get(filePath) ?? Promise.resolve();
  const next = previous.then(async () => {
    try {
      await mkdir(directory, { recursive: true });
      await appendFile(filePath, payload, "utf8");
    } catch (error) {
      console.error(`[orchestration-history] could not append to ${filePath}`, error);
    }
  });
  appendQueues.set(filePath, next);
  next
    .then(() => {
      if (appendQueues.get(filePath) === next) {
        appendQueues.delete(filePath);
      }
    })
    .catch(() => {});
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
