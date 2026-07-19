import React from "react";
import { useTranslation } from "react-i18next";
import { ToggleSwitch } from "../../ui/ToggleSwitch";
import { useSettings } from "../../../hooks/useSettings";

interface NotificationsAnnouncementsToggleProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

export const NotificationsAnnouncementsToggle: React.FC<NotificationsAnnouncementsToggleProps> =
  React.memo(({ descriptionMode = "tooltip", grouped = false }) => {
    const { t } = useTranslation();
    const { getSetting, updateSetting, isUpdating } = useSettings();

    const enabled = getSetting("notifications_announcements") ?? true;

    return (
      <ToggleSwitch
        checked={enabled}
        onChange={(value) =>
          updateSetting("notifications_announcements", value)
        }
        isUpdating={isUpdating("notifications_announcements")}
        label={t("settings.system.notifications.announcements.label")}
        description={t(
          "settings.system.notifications.announcements.description",
        )}
        descriptionMode={descriptionMode}
        grouped={grouped}
      />
    );
  });
