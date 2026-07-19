import React from "react";
import { useTranslation } from "react-i18next";
import { ToggleSwitch } from "../../ui/ToggleSwitch";
import { useSettings } from "../../../hooks/useSettings";

interface AutoAddToDictionaryToggleProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

export const AutoAddToDictionaryToggle: React.FC<AutoAddToDictionaryToggleProps> =
  React.memo(({ descriptionMode = "tooltip", grouped = false }) => {
    const { t } = useTranslation();
    const { getSetting, updateSetting, isUpdating } = useSettings();

    const enabled = getSetting("auto_add_to_dictionary") ?? false;

    return (
      <ToggleSwitch
        checked={enabled}
        onChange={(value) => updateSetting("auto_add_to_dictionary", value)}
        isUpdating={isUpdating("auto_add_to_dictionary")}
        label={t("settings.system.autoAddDictionary.label")}
        description={t("settings.system.autoAddDictionary.description")}
        descriptionMode={descriptionMode}
        grouped={grouped}
      />
    );
  });
