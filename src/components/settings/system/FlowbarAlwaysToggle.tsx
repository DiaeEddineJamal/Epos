import React from "react";
import { useTranslation } from "react-i18next";
import { ToggleSwitch } from "../../ui/ToggleSwitch";
import { useSettings } from "../../../hooks/useSettings";

interface FlowbarAlwaysToggleProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

export const FlowbarAlwaysToggle: React.FC<FlowbarAlwaysToggleProps> =
  React.memo(({ descriptionMode = "tooltip", grouped = false }) => {
    const { t } = useTranslation();
    const { getSetting, updateSetting, isUpdating } = useSettings();

    const showFlowbarAlways = getSetting("show_flowbar_always") ?? false;

    return (
      <ToggleSwitch
        checked={showFlowbarAlways}
        onChange={(enabled) => updateSetting("show_flowbar_always", enabled)}
        isUpdating={isUpdating("show_flowbar_always")}
        label={t("settings.system.flowbarAlways.label")}
        description={t("settings.system.flowbarAlways.description")}
        descriptionMode={descriptionMode}
        grouped={grouped}
      />
    );
  });
