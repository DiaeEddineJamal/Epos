import React from "react";
import { useTranslation } from "react-i18next";
import { SettingsGroup } from "../../ui/SettingsGroup";
import { AutostartToggle } from "../AutostartToggle";
import { ShowTrayIcon } from "../ShowTrayIcon";
import { StartHidden } from "../StartHidden";
import { ShowOverlay } from "../ShowOverlay";
import { AudioFeedback } from "../AudioFeedback";
import { MuteWhileRecording } from "../MuteWhileRecording";
import { UserNameSetting } from "./UserNameSetting";
import { FlowbarAlwaysToggle } from "./FlowbarAlwaysToggle";
import { NotificationsSuggestionsToggle } from "./NotificationsSuggestionsToggle";
import { NotificationsAnnouncementsToggle } from "./NotificationsAnnouncementsToggle";
import { NotificationsMilestonesToggle } from "./NotificationsMilestonesToggle";
import { ScratchpadBehaviorSetting } from "./ScratchpadBehaviorSetting";
import { AutoAddToDictionaryToggle } from "./AutoAddToDictionaryToggle";
import { CreatorModeToggle } from "./CreatorModeToggle";

export const SystemSettings: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="max-w-3xl w-full mx-auto space-y-6">
      <SettingsGroup title={t("settings.system.groups.app")}>
        <UserNameSetting descriptionMode="tooltip" grouped={true} />
        <AutostartToggle descriptionMode="tooltip" grouped={true} />
        <FlowbarAlwaysToggle descriptionMode="tooltip" grouped={true} />
        <ShowTrayIcon descriptionMode="tooltip" grouped={true} />
        <StartHidden descriptionMode="tooltip" grouped={true} />
        <ShowOverlay descriptionMode="tooltip" grouped={true} />
      </SettingsGroup>

      <SettingsGroup title={t("settings.system.groups.sound")}>
        <AudioFeedback descriptionMode="tooltip" grouped={true} />
        <MuteWhileRecording descriptionMode="tooltip" grouped={true} />
      </SettingsGroup>

      <SettingsGroup title={t("settings.system.groups.notifications")}>
        <NotificationsSuggestionsToggle
          descriptionMode="tooltip"
          grouped={true}
        />
        <NotificationsAnnouncementsToggle
          descriptionMode="tooltip"
          grouped={true}
        />
        <NotificationsMilestonesToggle
          descriptionMode="tooltip"
          grouped={true}
        />
      </SettingsGroup>

      <SettingsGroup title={t("settings.system.groups.scratchpad")}>
        <ScratchpadBehaviorSetting descriptionMode="tooltip" grouped={true} />
      </SettingsGroup>

      <SettingsGroup title={t("settings.system.groups.extras")}>
        <AutoAddToDictionaryToggle descriptionMode="tooltip" grouped={true} />
        <CreatorModeToggle descriptionMode="tooltip" grouped={true} />
      </SettingsGroup>
    </div>
  );
};
