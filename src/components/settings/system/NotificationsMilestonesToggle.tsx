import React from "react";
import { useTranslation } from "react-i18next";
import { ToggleSwitch } from "../../ui/ToggleSwitch";
import { useSettings } from "../../../hooks/useSettings";

interface NotificationsMilestonesToggleProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

export const NotificationsMilestonesToggle: React.FC<NotificationsMilestonesToggleProps> =
  React.memo(({ descriptionMode = "tooltip", grouped = false }) => {
    const { t } = useTranslation();
    const { getSetting, updateSetting, isUpdating } = useSettings();

    const enabled = getSetting("notifications_milestones") ?? true;

    return (
      <ToggleSwitch
        checked={enabled}
        onChange={(value) => updateSetting("notifications_milestones", value)}
        isUpdating={isUpdating("notifications_milestones")}
        label={t("settings.system.notifications.milestones.label")}
        description={t("settings.system.notifications.milestones.description")}
        descriptionMode={descriptionMode}
        grouped={grouped}
      />
    );
  });
