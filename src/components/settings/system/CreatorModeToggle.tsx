import React from "react";
import { useTranslation } from "react-i18next";
import { ToggleSwitch } from "../../ui/ToggleSwitch";
import { useSettings } from "../../../hooks/useSettings";

interface CreatorModeToggleProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

export const CreatorModeToggle: React.FC<CreatorModeToggleProps> = React.memo(
  ({ descriptionMode = "tooltip", grouped = false }) => {
    const { t } = useTranslation();
    const { getSetting, updateSetting, isUpdating } = useSettings();

    const enabled = getSetting("creator_mode") ?? false;

    return (
      <ToggleSwitch
        checked={enabled}
        onChange={(value) => updateSetting("creator_mode", value)}
        isUpdating={isUpdating("creator_mode")}
        label={t("settings.system.creatorMode.label")}
        description={t("settings.system.creatorMode.description")}
        descriptionMode={descriptionMode}
        grouped={grouped}
      />
    );
  },
);
