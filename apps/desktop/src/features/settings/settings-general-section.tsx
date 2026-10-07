import { useEffect, useState } from "react";
import type { RuntimeSnapshot } from "@pi-gui/session-driver/runtime-types";
import {
  sessionIdleReclaimMinuteOptions,
  type ModelSettingsScopeMode,
  type SessionIdleReclaimMinutes,
} from "../../../contracts/desktop-state";
import { SettingsSegmented, SettingsSelect, SettingsSwitch } from "./settings-controls";
import { SettingsGroup, SettingsRow } from "./settings-utils";
import { useT } from "../../i18n/i18n";

interface SettingsGeneralSectionProps {
  readonly runtime?: RuntimeSnapshot;
  readonly modelSettingsScopeMode: ModelSettingsScopeMode;
  readonly integratedTerminalShell: string;
  readonly sessionIdleReclaimMinutes: SessionIdleReclaimMinutes;
  readonly onSetModelSettingsScopeMode: (mode: ModelSettingsScopeMode) => void;
  readonly onSetIntegratedTerminalShell: (shellPath: string) => void;
  readonly onSetSessionIdleReclaimMinutes: (minutes: SessionIdleReclaimMinutes) => void;
  readonly onToggleSkillCommands: (enabled: boolean) => void;
}

export function SettingsGeneralSection({
  runtime,
  modelSettingsScopeMode,
  integratedTerminalShell,
  sessionIdleReclaimMinutes,
  onSetModelSettingsScopeMode,
  onSetIntegratedTerminalShell,
  onSetSessionIdleReclaimMinutes,
  onToggleSkillCommands,
}: SettingsGeneralSectionProps) {
  const t = useT();
  const idleReclaimOptions = sessionIdleReclaimMinuteOptions.map((minutes) => ({
    value: String(minutes),
    label: minutes === 0 ? t("Never") : t("{minutes} minutes", { minutes }),
  }));
  const [terminalShellDraft, setTerminalShellDraft] = useState(integratedTerminalShell);

  useEffect(() => {
    setTerminalShellDraft(integratedTerminalShell);
  }, [integratedTerminalShell]);

  const commitTerminalShellDraft = () => {
    if (terminalShellDraft !== integratedTerminalShell) {
      onSetIntegratedTerminalShell(terminalShellDraft);
    }
  };

  return (
    <>
      <SettingsGroup title={t("Agent")}>
        <SettingsRow
          title={t("Model settings scope")}
          description={t(
            "Apply the default model and enabled models everywhere, or set them per repo.",
          )}
        >
          <SettingsSegmented
            label={t("Model settings scope")}
            options={[
              { value: "app-global", label: t("App global") },
              { value: "per-repo", label: t("Per repo") },
            ]}
            value={modelSettingsScopeMode}
            onChange={onSetModelSettingsScopeMode}
          />
        </SettingsRow>
        <SettingsRow
          title={t("Skill slash commands")}
          description={t("Offer each skill as a slash command in the composer.")}
        >
          <SettingsSwitch
            checked={runtime?.settings.enableSkillCommands ?? true}
            label={t("Enable skill slash commands")}
            onChange={onToggleSkillCommands}
          />
        </SettingsRow>
        <SettingsRow
          title={t("Idle session reclaim")}
          description={t(
            "Threads left unopened for this long release their runtime and MCP subprocesses. The conversation is kept and reopens with it on the next use. Threads on screen, running a turn, or waiting on a dialog are never reclaimed.",
          )}
        >
          <SettingsSelect
            label={t("Idle session reclaim")}
            options={idleReclaimOptions}
            value={String(sessionIdleReclaimMinutes)}
            onChange={(value) =>
              onSetSessionIdleReclaimMinutes(Number(value) as SessionIdleReclaimMinutes)
            }
          />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title={t("Terminal")}>
        <SettingsRow
          title={t("Shell")}
          description={t(
            "The shell the integrated terminal starts. Leave blank to use your login shell.",
          )}
        >
          <input
            aria-label={t("Shell of integrated terminal")}
            className="settings-text-input"
            placeholder="/bin/zsh"
            spellCheck={false}
            type="text"
            value={terminalShellDraft}
            onBlur={commitTerminalShellDraft}
            onChange={(event) => setTerminalShellDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
          />
        </SettingsRow>
      </SettingsGroup>
    </>
  );
}
