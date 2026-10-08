import { useEffect, useState } from "react";
import type {
  OrchestrationChildThread,
  OrchestrationChildThreadStatus,
  OrchestrationEvidenceRecord,
  OrchestrationEvidenceStatus,
  TimelineTranscriptItem,
} from "../../../contracts/desktop-state";
import { t } from "../../../contracts/i18n";
import { ChevronRightIcon } from "../../ui/icons";
import { useT } from "../../i18n/i18n";
import { formatRelativeTime, titleCase } from "../../lib/string-utils";
import { TimelineItem } from "./timeline-item";

/** A child's own rows, bounded like its transcript: the block stays a summary, not a second thread. */
const MAX_CHILD_BLOCK_ITEMS = 40;

/** How many evidence rows an expanded card paints; collapsed it paints only the newest one. */
const MAX_CHILD_EVIDENCE_ITEMS = 10;

function childStatusLabel(status: OrchestrationChildThreadStatus): string {
  switch (status) {
    case "queued":
      return t("Queued");
    case "running":
      return t("Working");
    case "waiting":
      return t("Waiting");
    case "complete":
      return t("Done");
    case "failed":
      return t("Failed");
  }
}

function evidenceStatusLabel(status: OrchestrationEvidenceStatus): string {
  switch (status) {
    case "reported":
      return t("Reported");
    case "accepted":
      return t("Accepted");
    case "running":
      return t("Running");
    case "passed":
      return t("Passed");
    case "failed":
      return t("Failed");
    case "blocked":
      return t("Blocked");
  }
}

/**
 * The child's evidence, drawn under its card. The state holds only the newest record, so the card
 * paints that one for free; the rest of the log lives in the child's archive and is read over IPC
 * only when the operator expands the card, which keeps a screen full of children from firing a
 * burst of archive reads at startup.
 */
function ChildThreadEvidence({
  stateEvidence,
  archivedEvidence,
  expanded,
  loading,
  unavailable,
}: {
  readonly stateEvidence: readonly OrchestrationEvidenceRecord[];
  readonly archivedEvidence: readonly OrchestrationEvidenceRecord[];
  readonly expanded: boolean;
  readonly loading: boolean;
  readonly unavailable: boolean;
}) {
  const tr = useT();
  const archived = expanded ? archivedEvidence : [];
  const records = archived.length > 0 ? archived : stateEvidence;
  const limit = expanded ? MAX_CHILD_EVIDENCE_ITEMS : 1;
  const visibleRecords = records.slice(-limit);
  return (
    <div className="child-thread__evidence-area" data-testid="child-thread-evidence">
      <p className="child-thread__evidence-head">
        {loading && archived.length === 0
          ? tr("Loading history…")
          : records.length > limit
            ? tr("Evidence ({shown} of {total})", {
                shown: visibleRecords.length,
                total: records.length,
              })
            : tr("Evidence ({count})", { count: records.length })}
      </p>
      {records.length === 0 ? (
        <p className="child-thread__evidence-note">{tr("No evidence yet.")}</p>
      ) : (
        <ul className="child-thread__evidence-list">
          {visibleRecords.map((record) => (
            <li
              className={`child-thread__evidence child-thread__evidence--${record.status}`}
              data-testid="child-thread-evidence-row"
              key={record.id}
            >
              <div className="child-thread__evidence-meta">
                <span className="child-thread__evidence-kind">{titleCase(record.kind)}</span>
                <span className="child-thread__evidence-status">
                  {evidenceStatusLabel(record.status)}
                </span>
                <time
                  className="child-thread__evidence-time"
                  dateTime={record.createdAt}
                  title={new Date(record.createdAt).toLocaleString()}
                >
                  {formatRelativeTime(record.createdAt)}
                </time>
              </div>
              <p className="child-thread__evidence-title">{record.title}</p>
              {record.detail ? (
                <p className="child-thread__evidence-detail">{record.detail}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {unavailable && archived.length === 0 ? (
        <p className="child-thread__evidence-note">{tr("Earlier history is unavailable.")}</p>
      ) : null}
    </div>
  );
}

/** A child's on-demand history: recent timeline plus the archived evidence log. */
type ChildHistory = {
  readonly timeline: readonly TimelineTranscriptItem[];
  readonly evidence: readonly OrchestrationEvidenceRecord[];
};

/**
 * A delegated child thread, drawn inside the parent's timeline under the tool call that started it.
 * The child's own session keeps running and stays reachable from here; this is what the parent
 * window shows instead of a second thread in the sidebar. The card carries only a summary — its
 * recent timeline and full evidence log are read over IPC when the operator expands it.
 */
export function ChildThreadBlock({
  thread,
  onOpenSession,
}: {
  readonly thread: OrchestrationChildThread;
  readonly onOpenSession?: (thread: OrchestrationChildThread) => void;
}) {
  const tr = useT();
  const [expanded, setExpanded] = useState(false);
  const [expandedToolCallIds, setExpandedToolCallIds] = useState<ReadonlySet<string>>(new Set());
  const [history, setHistory] = useState<ChildHistory | undefined>(undefined);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyUnavailable, setHistoryUnavailable] = useState(false);

  useEffect(() => {
    if (!expanded) {
      return;
    }
    const read = window.piApp?.readOrchestrationChildHistory;
    if (!read) {
      setHistoryUnavailable(true);
      return;
    }
    let cancelled = false;
    setHistoryLoading(true);
    read({ childThreadId: thread.id }).then(
      (result) => {
        if (cancelled) {
          return;
        }
        setHistory(result ? { timeline: result.timeline, evidence: result.evidence } : undefined);
        setHistoryUnavailable(!result);
        setHistoryLoading(false);
      },
      () => {
        if (!cancelled) {
          setHistoryUnavailable(true);
          setHistoryLoading(false);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [thread.id, expanded]);

  const items = (history?.timeline ?? []).slice(-MAX_CHILD_BLOCK_ITEMS);
  const actionCount = thread.actionCount;

  const toggleToolCall = (callId: string) => {
    setExpandedToolCallIds((current) => {
      const next = new Set(current);
      if (next.has(callId)) {
        next.delete(callId);
      } else {
        next.add(callId);
      }
      return next;
    });
  };

  return (
    <section
      className="child-thread"
      data-child-thread-id={thread.id}
      data-testid="child-thread-block"
    >
      <div className="child-thread__header">
        <button
          aria-expanded={expanded}
          className="child-thread__toggle"
          data-testid="child-thread-toggle"
          type="button"
          onClick={() => setExpanded((current) => !current)}
        >
          <span
            className={`child-thread__chevron ${expanded ? "child-thread__chevron--expanded" : ""}`}
          >
            <ChevronRightIcon />
          </span>
          <span className="child-thread__title">{thread.title || thread.goal}</span>
        </button>
        <span
          className={`child-thread__status child-thread__status--${thread.status}`}
          data-testid="child-thread-status"
        >
          {childStatusLabel(thread.status)}
        </span>
        <span className="child-thread__meta">{tr("{count} actions", { count: actionCount })}</span>
        {onOpenSession ? (
          <button
            className="child-thread__open"
            data-testid="child-thread-open"
            type="button"
            onClick={() => onOpenSession(thread)}
          >
            {tr("Open in session")}
          </button>
        ) : null}
      </div>
      {expanded ? (
        items.length > 0 ? (
          <div className="child-thread__timeline" data-testid="child-thread-timeline">
            {items.map((item) => (
              <TimelineItem
                key={item.id}
                item={item}
                expandedToolCallIds={expandedToolCallIds}
                onToggleToolCall={toggleToolCall}
              />
            ))}
          </div>
        ) : historyLoading ? (
          <p className="child-thread__empty">{tr("Loading history…")}</p>
        ) : (
          <p className="child-thread__empty">{tr("No messages yet.")}</p>
        )
      ) : thread.latestTranscript ? (
        <p className="child-thread__preview">{thread.latestTranscript}</p>
      ) : null}
      <ChildThreadEvidence
        archivedEvidence={history?.evidence ?? []}
        expanded={expanded}
        loading={historyLoading}
        stateEvidence={thread.evidence}
        unavailable={historyUnavailable}
      />
    </section>
  );
}
