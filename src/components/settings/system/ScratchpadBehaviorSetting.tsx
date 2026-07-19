import React from "react";
import { useTranslation } from "react-i18next";
import { Dropdown } from "../../ui/Dropdown";
import { SettingContainer } from "../../ui/SettingContainer";
import { useSettings } from "../../../hooks/useSettings";

interface ScratchpadBehaviorSettingProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

export const ScratchpadBehaviorSetting: React.FC<ScratchpadBehaviorSettingProps> =
  React.memo(({ descriptionMode = "tooltip", grouped = false }) => {
    const { t } = useTranslation();
    const { getSetting, updateSetting, isUpdating } = useSettings();

    const options = [
      {
        value: "resume",
        label: t("settings.system.scratchpadBehavior.options.resumeLast"),
      },
      {
        value: "new",
        label: t("settings.system.scratchpadBehavior.options.newNote"),
      },
    ];

    const resumeLast = getSetting("scratchpad_resume_last") ?? true;
    const selectedValue = resumeLast ? "resume" : "new";

    return (
      <SettingContainer
        title={t("settings.system.scratchpadBehavior.label")}
        description={t("settings.system.scratchpadBehavior.description")}
        descriptionMode={descriptionMode}
        grouped={grouped}
      >
        <Dropdown
          options={options}
          selectedValue={selectedValue}
          onSelect={(value) =>
            updateSetting("scratchpad_resume_last", value === "resume")
          }
          disabled={isUpdating("scratchpad_resume_last")}
        />
      </SettingContainer>
    );
  });
