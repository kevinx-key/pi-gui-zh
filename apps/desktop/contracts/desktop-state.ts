import type {
  ExtensionFlagValues,
  HostUiRequest,
  SessionConfig,
  SessionUsageSnapshot,
} from "@pi-gui/session-driver";
import type {
  ModelSettingsSnapshot,
  RuntimeCommandRecord,
  RuntimeSnapshot,
} from "@pi-gui/session-driver/runtime-types";
import type { SessionSchemaInfo } from "@pi-gui/session-driver";
export type { SessionSchemaInfo } from "@pi-gui/session-driver";
export type SessionStatus = "idle" | "running" | "failed";
export type {
  SessionRole,
  TimelineToolCall,
  TimelineTranscriptItem,
  TranscriptMessage,
} from "./timeline-types";
import type { TimelineTranscriptItem, TranscriptMessage } from "./timeline-types";
import type { ScheduledTaskRecord } from "./scheduled-tasks";
export type {
  CreateScheduledTaskInput,
  ScheduledTaskFilter,
  ScheduledTaskRecord,
  ScheduledTaskSchedule,
  ScheduledTaskStatus,
  ScheduledTaskTarget,
  UpdateScheduledTaskInput,
} from "./scheduled-tasks";

export type AppView = "threads" | "new-thread" | "scheduled" | "skills" | "extensions" | "settings";
export type WorkspaceKind = "primary" | "worktree";
export type WorktreeStatus = "ready" | "missing" | "error";
export type NewThreadEnvironment = "local" | "worktree";
export type ThemeMode = "system" | "light" | "dark";
export const themePresetIds = [
  "default",
  "catppuccin",
  "tokyo-night",
  "nord",
  "dracula",
  "gruvbox",
  "github",
  "vscode",
] as const;
export type ThemePresetId = (typeof themePresetIds)[number];
export type ModelSettingsScopeMode = "app-global" | "per-repo";
export type ThreadGrouping = "time" | "workspace";

export function isThreadGrouping(value: unknown): value is ThreadGrouping {
  return value === "time" || value === "workspace";
}

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "system" || value === "light" || value === "dark";
}

export function isThemePresetId(value: unknown): value is ThemePresetId {
  return typeof value === "string" && themePresetIds.includes(value as ThemePresetId);
}
export type ComposerDraftSyncSource =
  | "state"
  | "selection"
  | "persist"
  | "remote-persist"
  | "command"
  | "extension-editor-text"
  | "queued-message-edit";

export interface NotificationPreferences {
  readonly backgroundCompletion: boolean;
  readonly backgroundFailure: boolean;
  readonly attentionNeeded: boolean;
}

/**
 * How long a thread nobody has opened keeps its runtime before pi-gui reclaims it, in minutes.
 * `0` means "never reclaim": the idle sweep stays switched off and runtimes live until the
 * thread is closed by hand or the app quits.
 */
export type SessionIdleReclaimMinutes = 0 | 5 | 15 | 30 | 60;

/** The settings dropdown's choices, in the order it offers them; "never" comes last. */
export const sessionIdleReclaimMinuteOptions = [
  5, 15, 30, 60, 0,
] as const satisfies readonly SessionIdleReclaimMinutes[];

/** Reclaiming after 15 minutes is the behaviour pi-gui has always had, so it is the default. */
export const DEFAULT_SESSION_IDLE_RECLAIM_MINUTES: SessionIdleReclaimMinutes = 15;

export function isSessionIdleReclaimMinutes(value: unknown): value is SessionIdleReclaimMinutes {
  return sessionIdleReclaimMinuteOptions.includes(value as SessionIdleReclaimMinutes);
}

export interface ComposerImageAttachment {
  readonly id: string;
  readonly kind: "image";
  readonly name: string;
  readonly mimeType: string;
  readonly data: string;
}

export interface ComposerFileAttachment {
  readonly id: string;
  readonly kind: "file";
  readonly name: string;
  readonly mimeType: string;
  readonly fsPath: string;
  readonly sizeBytes?: number;
}

export type ComposerAttachment = ComposerImageAttachment | ComposerFileAttachment;

export type QueuedComposerMessageMode = "steer" | "followUp";

export interface QueuedComposerMessage {
  readonly id: string;
  readonly mode: QueuedComposerMessageMode;
  readonly text: string;
  readonly attachments: readonly ComposerAttachment[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SessionRecord {
  readonly id: string;
  readonly title: string;
  readonly updatedAt: string;
  readonly pinnedAt?: string;
  readonly lastViewedAt?: string;
  readonly lastInteractedAt?: string;
  readonly archivedAt?: string;
  readonly preview: string;
  readonly status: SessionStatus;
  readonly runningSince?: string;
  readonly hasUnseenUpdate: boolean;
  readonly config?: SessionConfig;
}

export type OrchestrationChildThreadStatus =
  "queued" | "running" | "waiting" | "complete" | "failed";
export type OrchestrationSupervisionGate = "continue" | "stop" | "wake";
export type OrchestrationSupervisionStatus = "monitoring" | "attention" | "stopped";
export type OrchestrationEvidenceKind =
  | "worker_report"
  | "orchestrator_acceptance"
  | "orchestrator_observation"
  | "orchestrator_action"
  | "command"
  | "review_finding"
  | "blocker";
export type OrchestrationEvidenceSource =
  | "worker-reported"
  | "orchestrator-accepted"
  | "orchestrator-observed"
  | "orchestrator-action"
  | "command"
  | "review"
  | "blocker";
export type OrchestrationEvidenceStatus =
  "reported" | "accepted" | "running" | "passed" | "failed" | "blocked";

export interface OrchestrationEvidenceGitRef {
  readonly workspaceId: string;
  readonly branchName?: string;
  readonly headSha?: string;
}

export interface OrchestrationEvidenceRecord {
  readonly id: string;
  readonly childThreadId: string;
  readonly kind: OrchestrationEvidenceKind;
  readonly source: OrchestrationEvidenceSource;
  readonly status: OrchestrationEvidenceStatus;
  readonly title: string;
  readonly detail?: string;
  readonly command?: string;
  readonly toolName?: string;
  readonly severity?: "P0" | "P1" | "P2" | "P3";
  readonly parentSessionId?: string;
  readonly childSessionId?: string;
  readonly git?: OrchestrationEvidenceGitRef;
  readonly createdAt: string;
  readonly updatedAt?: string;
}

export interface OrchestrationSupervisionLoop {
  readonly id: string;
  readonly status: OrchestrationSupervisionStatus;
  readonly gate: OrchestrationSupervisionGate;
  readonly intervalMs: number;
  readonly iterationCount: number;
  readonly lastCheckedAt: string;
  readonly nextRunAt?: string;
  readonly reason: string;
  readonly lastChildStatus: OrchestrationChildThreadStatus;
  readonly stoppedAt?: string;
}

export interface OrchestrationChildTranscriptMessage {
  readonly id: string;
  readonly role: "parent" | "child" | "system";
  readonly text: string;
  readonly createdAt: string;
}

export interface OrchestrationChildThread {
  readonly id: string;
  readonly sourceToolCallId?: string;
  readonly parentWorkspaceId: string;
  readonly parentSessionId: string;
  readonly childWorkspaceId: string;
  readonly childSessionId: string;
  readonly title: string;
  readonly goal: string;
  readonly status: OrchestrationChildThreadStatus;
  readonly latestTranscript: string;
  /**
   * What the child has reported, capped to the newest record. This is the card's summary: the whole
   * UI state is deep-cloned and broadcast on every event, so a child carries only its newest record
   * here. Its full evidence log and recent timeline live outside the state and are read on demand
   * (`readOrchestrationChildHistory`) when the operator expands the card.
   */
  readonly evidence: readonly OrchestrationEvidenceRecord[];
  /** Tool actions in the child's recent timeline, drawn on the collapsed card's header. */
  readonly actionCount: number;
  readonly supervisionLoop?: OrchestrationSupervisionLoop;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * A finished child's record as it stood when it finished: the catalog entry of the child's archive.
 * The archive holds it because `ui-state.json` keeps only the child's card and newest evidence.
 */
export interface OrchestrationChildHistorySnapshot {
  readonly id: string;
  readonly title: string;
  readonly goal: string;
  readonly status: OrchestrationChildThreadStatus;
  readonly parentWorkspaceId: string;
  readonly parentSessionId: string;
  readonly childWorkspaceId: string;
  readonly childSessionId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * A child's archived history: its evidence log (newest first, one entry per record id) plus the
 * snapshot written when it finished. Read on demand from `<userData>/orchestration/<id>.ndjson`.
 */
export interface OrchestrationChildArchive {
  readonly snapshot?: OrchestrationChildHistorySnapshot;
  readonly evidence: readonly OrchestrationEvidenceRecord[];
}

/**
 * A child's full history, read on demand over IPC when its card is expanded: the archive's evidence
 * plus the child's live recent timeline (read from its session, falling back to the snapshot when
 * the session is gone). Never held in the app state.
 */
export interface OrchestrationChildHistory {
  readonly snapshot?: OrchestrationChildHistorySnapshot;
  readonly evidence: readonly OrchestrationEvidenceRecord[];
  readonly timeline: readonly TimelineTranscriptItem[];
}

/** Input of the read-only archive request; the archive itself stays in the main process. */
export interface ReadOrchestrationChildHistoryInput {
  readonly childThreadId: string;
}

export interface SendChildThreadFollowUpInput {
  readonly childThreadId: string;
  readonly text: string;
}

export interface SetChildSupervisionLoopInput {
  readonly childThreadId: string;
  readonly gate: Extract<OrchestrationSupervisionGate, "continue" | "stop">;
}

export interface SelectedTranscriptRecord {
  readonly workspaceId: string;
  readonly sessionId: string;
  readonly transcript: readonly TranscriptMessage[];
  // Session-file schema-version skew, when known. `writtenByNewerRuntime` drives the version-skew
  // notice; undefined until the (async, static-per-session) header read resolves.
  readonly schemaInfo?: SessionSchemaInfo;
}

export interface WorktreeRecord {
  readonly id: string;
  readonly rootWorkspaceId: string;
  readonly linkedWorkspaceId?: string;
  readonly name: string;
  readonly path: string;
  readonly status: WorktreeStatus;
  readonly branchName?: string;
  readonly updatedAt: string;
}

export interface SessionExtensionStatusRecord {
  readonly key: string;
  readonly text: string;
}

export interface SessionExtensionWidgetRecord {
  readonly key: string;
  readonly lines: readonly string[];
  readonly placement: "aboveComposer" | "belowComposer";
}

export type SessionExtensionDialogRecord = Extract<
  HostUiRequest,
  { readonly kind: "confirm" | "select" | "input" | "editor" }
>;

export interface SessionExtensionNoticeRecord {
  readonly id: string;
  readonly level: "info" | "warning" | "error";
  readonly message: string;
  readonly createdAt: string;
}

export interface SessionExtensionUiStateRecord {
  readonly instanceId: string;
  readonly statuses: readonly SessionExtensionStatusRecord[];
  readonly widgets: readonly SessionExtensionWidgetRecord[];
  readonly pendingDialogs: readonly SessionExtensionDialogRecord[];
  /** `ctx.ui.notify` toasts, newest last. Main caps and expires them; the renderer only draws them. */
  readonly notices: readonly SessionExtensionNoticeRecord[];
  readonly title?: string;
  readonly editorText?: string;
}

export type ExtensionCommandCompatibilityStatus = "supported" | "terminal-only";

export interface ExtensionCommandCompatibilityRecord {
  readonly commandName: string;
  readonly extensionPath: string;
  readonly status: ExtensionCommandCompatibilityStatus;
  readonly message: string;
  readonly capability: string;
  readonly updatedAt: string;
}

export interface WorkspaceRecord {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly lastOpenedAt: string;
  readonly kind: WorkspaceKind;
  readonly rootWorkspaceId?: string;
  readonly branchName?: string;
  readonly sessions: readonly SessionRecord[];
}

export interface CreateWorktreeInput {
  readonly workspaceId: string;
  readonly fromSessionWorkspaceId?: string;
  readonly fromSessionId?: string;
}

export type StartThreadInput = {
  readonly rootWorkspaceId: string;
  readonly environment: NewThreadEnvironment;
  readonly prompt?: string;
  readonly attachments?: readonly ComposerAttachment[];
  readonly provider?: string;
  readonly modelId?: string;
  readonly thinkingLevel?: string;
  /**
   * The flag values chosen for this thread, `false` and empty strings included so
   * they are remembered as the workspace's next defaults. Main checks them against
   * the flags the workspace's extensions registered before pi sees them.
   */
  readonly extensionFlags?: ExtensionFlagValues;
};

export type ForkThreadPosition = "before" | "at" | "after";

export type ForkThreadInput = {
  readonly sourceWorkspaceId: string;
  readonly sourceSessionId: string;
  /** Root workspace used as the base when forking into a new worktree. */
  readonly rootWorkspaceId: string;
  /** "local" forks into the source workspace; "worktree" creates a new worktree. */
  readonly environment: NewThreadEnvironment;
  /** ID of the rendered transcript message selected as the fork point, when it maps to a session entry. */
  readonly sourceMessageId?: string;
  /** 0-based index of the rendered transcript message selected as the fork point. */
  readonly sourceMessageIndex?: number;
  /** 0-based rendered user-message index kept as a fallback for older callers. */
  readonly userMessageIndex?: number;
  readonly position?: ForkThreadPosition;
};

export interface RemoveWorktreeInput {
  readonly workspaceId: string;
  readonly worktreeId: string;
}

export interface StartupDiagnostic {
  readonly scope: "application" | "workspace";
  readonly message: string;
  readonly workspacePath?: string;
}

export interface DesktopAppState {
  readonly workspaces: readonly WorkspaceRecord[];
  readonly worktreesByWorkspace: Readonly<Record<string, readonly WorktreeRecord[]>>;
  readonly selectedWorkspaceId: string;
  readonly selectedSessionId: string;
  readonly activeView: AppView;
  readonly composerDraft: string;
  readonly composerDraftSyncSource: ComposerDraftSyncSource;
  readonly composerDraftSyncNonce: number;
  readonly composerAttachments: readonly ComposerAttachment[];
  readonly queuedComposerMessages: readonly QueuedComposerMessage[];
  readonly editingQueuedMessageId?: string;
  readonly runtimeByWorkspace: Readonly<Record<string, RuntimeSnapshot>>;
  readonly sessionCommandsBySession: Readonly<Record<string, readonly RuntimeCommandRecord[]>>;
  /** Context, cache and usage for open sessions; absent until pi reports it. */
  readonly sessionUsageBySession: Readonly<Record<string, SessionUsageSnapshot>>;
  readonly sessionExtensionUiBySession: Readonly<Record<string, SessionExtensionUiStateRecord>>;
  readonly extensionCommandCompatibilityByWorkspace: Readonly<
    Record<string, readonly ExtensionCommandCompatibilityRecord[]>
  >;
  /** Flag values last chosen for a new thread in each root workspace: the next thread's defaults. */
  readonly extensionFlagsByWorkspace: Readonly<Record<string, ExtensionFlagValues>>;
  /** Flag values each thread's pi session started with (only the ones pi receives). */
  readonly extensionFlagsBySession: Readonly<Record<string, ExtensionFlagValues>>;
  readonly orchestrationChildren: readonly OrchestrationChildThread[];
  readonly scheduledTasks: readonly ScheduledTaskRecord[];
  readonly notificationPreferences: NotificationPreferences;
  readonly integratedTerminalShell: string;
  /** Minutes an untouched thread may stay idle before its runtime is reclaimed; `0` never reclaims. */
  readonly sessionIdleReclaimMinutes: SessionIdleReclaimMinutes;
  readonly lastViewedAtBySession: Readonly<Record<string, string>>;
  readonly lastInteractedAtBySession: Readonly<Record<string, string>>;
  readonly pinnedAtBySession: Readonly<Record<string, string>>;
  readonly pinnedSessionOrder: readonly string[];
  readonly workspaceOrder: readonly string[];
  readonly modelSettingsScopeMode: ModelSettingsScopeMode;
  readonly globalModelSettings: ModelSettingsSnapshot;
  readonly themeMode: ThemeMode;
  readonly themePresetId: ThemePresetId;
  readonly sidebarCollapsed: boolean;
  readonly threadGrouping: ThreadGrouping;
  /** Folder groups the user collapsed in the sidebar, by workspace id. */
  readonly collapsedWorkspaceIds: readonly string[];
  readonly enableTransparency: boolean;
  readonly startupDiagnostics: readonly StartupDiagnostic[];
  readonly revision: number;
  readonly lastError?: string;
}

export interface CreateSessionInput {
  readonly workspaceId: string;
  readonly title?: string;
}

export interface WorkspaceSessionTarget {
  readonly workspaceId: string;
  readonly sessionId: string;
}

export function createEmptyDesktopAppState(): DesktopAppState {
  return {
    workspaces: [],
    worktreesByWorkspace: {},
    selectedWorkspaceId: "",
    selectedSessionId: "",
    activeView: "threads",
    composerDraft: "",
    composerDraftSyncSource: "state",
    composerDraftSyncNonce: 0,
    composerAttachments: [],
    queuedComposerMessages: [],
    runtimeByWorkspace: {},
    sessionCommandsBySession: {},
    sessionUsageBySession: {},
    sessionExtensionUiBySession: {},
    extensionCommandCompatibilityByWorkspace: {},
    extensionFlagsByWorkspace: {},
    extensionFlagsBySession: {},
    orchestrationChildren: [],
    scheduledTasks: [],
    notificationPreferences: {
      backgroundCompletion: true,
      backgroundFailure: true,
      attentionNeeded: true,
    },
    integratedTerminalShell: "",
    sessionIdleReclaimMinutes: DEFAULT_SESSION_IDLE_RECLAIM_MINUTES,
    lastViewedAtBySession: {},
    lastInteractedAtBySession: {},
    pinnedAtBySession: {},
    pinnedSessionOrder: [],
    workspaceOrder: [],
    modelSettingsScopeMode: "app-global",
    globalModelSettings: {
      enabledModelPatterns: [],
    },
    themeMode: "system",
    themePresetId: "default",
    sidebarCollapsed: false,
    threadGrouping: "time",
    collapsedWorkspaceIds: [],
    enableTransparency: false,
    startupDiagnostics: [],
    revision: 0,
  };
}

export function getSelectedWorkspace(state: DesktopAppState): WorkspaceRecord | undefined {
  return state.workspaces.find((workspace) => workspace.id === state.selectedWorkspaceId);
}

export interface DesktopAppViewState {
  readonly selectedWorkspaceId?: string;
  readonly selectedSessionId?: string;
  readonly activeView?: AppView;
  readonly sidebarCollapsed?: boolean;
}

export function getSelectedSession(state: DesktopAppState): SessionRecord | undefined {
  return getSelectedWorkspace(state)?.sessions.find(
    (session) => session.id === state.selectedSessionId,
  );
}
