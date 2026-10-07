import { useEffect, useState } from "react";
import type {
  OrchestrationChildArchive,
  OrchestrationChildThread,
  OrchestrationChildThreadStatus,
  OrchestrationEvidenceRecord,
  OrchestrationEvidenceStatus,
} from "../../../contracts/desktop-state";
import { t } from "../../../contracts/i18n";
import { ChevronRightIcon } from "../../ui/icons";
import { useT } from "../../i18n/i18n";
import { formatRelativeTime, titleCase } from "../../lib/string-utils";
import { TimelineItem } from "./timeline-item";

/** A child's own rows, bounded like its transcript: the block stays a summary, not a second thread. */
const MAX_CHILD_BLOCK_ITEMS = 40;

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
 * paints that one for free; the rest of the log lives in the child's archive file and is read over
 * IPC only when the operator expands the card, which keeps a screen full of children from firing a
 * burst of archive reads at startup.
 */
function ChildThreadEvidence({
  childThreadId,
  stateEvidence,
  expanded,
}: {
  readonly childThreadId: string;
  readonly stateEvidence: readonly OrchestrationEvidenceRecord[];
  readonly expanded: boolean;
}) {
  const tr = useT();
  const [archive, setArchive] = useState<OrchestrationChildArchive | undefined>(undefined);
  const [unavailable, setUnavailable] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!expanded) {
      return;
    }
    const read = window.piApp?.readOrchestrationChildHistory;
    if (!read) {
      setUnavailable(true);
      return;
    }
    let cancelled = false;
    setLoading(true);
    read({ childThreadId }).then(
      (result) => {
        if (cancelled) {
          return;
        }
        setArchive(result);
        setUnavailable(!result);
        setLoading(false);
      },
      () => {
        if (!cancelled) {
          setUnavailable(true);
          setLoading(false);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [childThreadId, expanded]);

  const archived = archive?.evidence ?? [];
  const records = archived.length > 0 ? archived : stateEvidence;
  return (
    <div className="child-thread__evidence-area" data-testid="child-thread-evidence">
      <p className="child-thread__evidence-head">
        {loading && archived.length === 0
          ? tr("Loading history…")
          : tr("Evidence ({count})", { count: records.length })}
      </p>
      {records.length === 0 ? (
        <p className="child-thread__evidence-note">{tr("No evidence yet.")}</p>
      ) : (
        <ul className="child-thread__evidence-list">
          {records.map((record) => (
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

/**
 * A delegated child thread, drawn inside the parent's timeline under the tool call that started it.
 * The child's own session keeps running and stays reachable from here; this is what the parent
 * window shows instead of a second thread in the sidebar.
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
  const items = thread.timeline.slice(-MAX_CHILD_BLOCK_ITEMS);
  const actionCount = thread.timeline.filter((item) => item.kind === "tool").length;

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
        ) : (
          <p className="child-thread__empty">{tr("No messages yet.")}</p>
        )
      ) : thread.latestTranscript ? (
        <p className="child-thread__preview">{thread.latestTranscript}</p>
      ) : null}
      <ChildThreadEvidence
        childThreadId={thread.id}
        expanded={expanded}
        stateEvidence={thread.evidence}
      />
    </section>
  );
}
