import type { ThemeMode, ThemePresetId } from "../../../contracts/desktop-state";
import { uiLocales, type UiLocale } from "../../../contracts/i18n";
import { SettingsSegmented, SettingsSelect, SettingsSwitch } from "./settings-controls";
import { SettingsGroup, SettingsRow } from "./settings-utils";
import type { CSSProperties } from "react";
import { themePreset, themePresets, themeSwatches, themeTokensFor } from "../../../contracts/theme";
import { useActiveTheme } from "../../ui/active-theme";
import { setActiveLocale, useLocale, useT } from "../../i18n/i18n";

interface SettingsAppearanceSectionProps {
  readonly themeMode: ThemeMode;
  readonly themePresetId: ThemePresetId;
  readonly onSetThemeMode: (mode: ThemeMode) => void;
  readonly onSetThemePresetId: (presetId: ThemePresetId) => void;
  readonly enableTransparency: boolean;
  readonly onSetEnableTransparency: (enabled: boolean) => void;
}

/** English source labels; translated with `t()` at render. */
const THEME_MODES: readonly { readonly mode: ThemeMode; readonly label: string }[] = [
  { mode: "system", label: "System" },
  { mode: "light", label: "Light" },
  { mode: "dark", label: "Dark" },
];

/** Language names are shown in their own language, so they are not translated. */
const LOCALE_LABELS: Readonly<Record<UiLocale, string>> = {
  "zh-CN": "简体中文",
  "en-US": "English",
};

export function SettingsAppearanceSection({
  themeMode,
  themePresetId,
  onSetThemeMode,
  onSetThemePresetId,
  enableTransparency,
  onSetEnableTransparency,
}: SettingsAppearanceSectionProps) {
  const activePreset = themePreset(themePresetId);
  const { variant } = useActiveTheme();
  const locale = useLocale();
  const t = useT();
  return (
    <>
      <SettingsGroup>
        <SettingsRow
          title={t("Interface language")}
          description={t("Choose the language used across the app.")}
        >
          <SettingsSegmented
            label={t("Interface language")}
            options={uiLocales.map((value) => ({ value, label: LOCALE_LABELS[value] }))}
            value={locale}
            onChange={setActiveLocale}
          />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title={t("Theme")} plain>
        <div
          aria-label={t("Theme")}
          className="theme-mode-tiles"
          role="radiogroup"
          style={tilePalette(themePresetId)}
        >
          {THEME_MODES.map((option) => (
            <label className="theme-mode-tile" key={option.mode}>
              <input
                checked={themeMode === option.mode}
                name="theme-mode"
                type="radio"
                onChange={() => onSetThemeMode(option.mode)}
              />
              <span
                aria-hidden="true"
                className={`theme-mode-tile__preview theme-mode-tile__preview--${option.mode}`}
              >
                <span className="theme-mode-tile__window">
                  <span className="theme-mode-tile__line theme-mode-tile__line--title" />
                  <span className="theme-mode-tile__line" />
                  <span className="theme-mode-tile__line" />
                </span>
              </span>
              <span className="theme-mode-tile__label">{t(option.label)}</span>
            </label>
          ))}
        </div>
      </SettingsGroup>

      <SettingsGroup>
        <SettingsRow title={t("Color preset")} description={t(activePreset.description)}>
          <span className="settings-preset-control">
            <span aria-hidden="true" className="settings-preset-swatches">
              {themeSwatches(themePresetId, variant).map((swatch, index) => (
                <span key={index} style={{ background: swatch }} />
              ))}
            </span>
            <SettingsSelect
              label={t("Color preset")}
              options={themePresets.map((preset) => ({
                value: preset.id,
                label: t(preset.name),
              }))}
              value={themePresetId}
              onChange={onSetThemePresetId}
            />
          </span>
        </SettingsRow>
        <SettingsRow
          title={t("Window transparency")}
          description={t("Let desktop colors show through supported surfaces.")}
        >
          <SettingsSwitch
            checked={enableTransparency}
            label={t("Window transparency")}
            onChange={onSetEnableTransparency}
          />
        </SettingsRow>
      </SettingsGroup>
    </>
  );
}

function tilePalette(presetId: ThemePresetId): CSSProperties {
  const light = themeTokensFor(presetId, "light");
  const dark = themeTokensFor(presetId, "dark");
  return {
    "--tile-light-bg": light["--sidebar"],
    "--tile-light-window": light["--main"],
    "--tile-light-line": light["--line-strong"],
    "--tile-dark-bg": dark["--sidebar"],
    "--tile-dark-window": dark["--main"],
    "--tile-dark-line": dark["--line-strong"],
  } as CSSProperties;
}
