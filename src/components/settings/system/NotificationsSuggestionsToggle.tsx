import React from "react";
import { useTranslation } from "react-i18next";
import { ToggleSwitch } from "../../ui/ToggleSwitch";
import { useSettings } from "../../../hooks/useSettings";

interface NotificationsSuggestionsToggleProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

export const NotificationsSuggestionsToggle: React.FC<NotificationsSuggestionsToggleProps> =
  React.memo(({ descriptionMode = "tooltip", grouped = false }) => {
    const { t } = useTranslation();
    const { getSetting, updateSetting, isUpdating } = useSettings();

    const enabled = getSetting("notifications_suggestions") ?? true;

    return (
      <ToggleSwitch
        checked={enabled}
        onChange={(value) => updateSetting("notifications_suggestions", value)}
        isUpdating={isUpdating("notifications_suggestions")}
        label={t("settings.system.notifications.suggestions.label")}
        description={t("settings.system.notifications.suggestions.description")}
        descriptionMode={descriptionMode}
        grouped={grouped}
      />
    );
  });
