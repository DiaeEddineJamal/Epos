import React from "react";
import { useTranslation } from "react-i18next";
import { Sun, Moon, Monitor } from "lucide-react";
import { SettingContainer } from "../ui/SettingContainer";
import { useThemeStore } from "../../stores/themeStore";
import type { ThemeMode } from "../../lib/theme";

interface ThemeSelectorProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  descriptionMode = "tooltip",
  grouped = false,
}) => {
  const { t } = useTranslation();
  const mode = useThemeStore((state) => state.mode);
  const setMode = useThemeStore((state) => state.setMode);

  const options: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
    { value: "light", label: t("settings.appearance.theme.light"), icon: Sun },
    { value: "dark", label: t("settings.appearance.theme.dark"), icon: Moon },
    {
      value: "system",
      label: t("settings.appearance.theme.system"),
      icon: Monitor,
    },
  ];

  return (
    <SettingContainer
      title={t("settings.appearance.theme.label")}
      description={t("settings.appearance.theme.description")}
      descriptionMode={descriptionMode}
      grouped={grouped}
    >
      <div className="inline-flex items-stretch border hairline rounded-sm divide-x divide-(--color-hairline) overflow-hidden">
        {options.map((option) => {
          const Icon = option.icon;
          const isActive = mode === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setMode(option.value)}
              aria-pressed={isActive}
              title={option.label}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider transition-colors duration-300 ease-in-out cursor-pointer ${
                isActive
                  ? "bg-primary text-background"
                  : "bg-background text-text/60 hover:text-text"
              }`}
            >
              <Icon size={14} strokeWidth={1.5} className="shrink-0" />
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    </SettingContainer>
  );
};
