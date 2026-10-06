import { useEffect, useState } from "react";
import { useT, type MessageParams } from "../../../i18n/i18n";

export function useRunningLabel(startedAt: string | undefined) {
  const t = useT();
  const [label, setLabel] = useState(() => formatRunningLabel(startedAt, t));

  useEffect(() => {
    setLabel(formatRunningLabel(startedAt, t));
    if (!startedAt) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setLabel(formatRunningLabel(startedAt, t));
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [startedAt, t]);

  return label;
}

function formatRunningLabel(
  startedAt: string | undefined,
  t: (source: string, params?: MessageParams) => string,
): string {
  if (!startedAt) {
    return t("Working…");
  }

  const diffMs = Math.max(0, Date.now() - Date.parse(startedAt));
  const seconds = Math.max(1, Math.floor(diffMs / 1000));
  if (seconds < 60) {
    return t("Working for {seconds}s", { seconds });
  }

  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return remaining === 0
    ? t("Working for {minutes}m", { minutes })
    : t("Working for {minutes}m {seconds}s", { minutes, seconds: remaining });
}
