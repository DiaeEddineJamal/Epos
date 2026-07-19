import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Dropdown } from "../ui/Dropdown";
import { SettingContainer } from "../ui/SettingContainer";
import { useSettings } from "../../hooks/useSettings";
import type { OverlayPosition } from "@/bindings";

interface ShowOverlayProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

export const ShowOverlay: React.FC<ShowOverlayProps> = React.memo(
  ({ descriptionMode = "tooltip", grouped = false }) => {
    const { t } = useTranslation();
    const { getSetting, updateSetting, isUpdating } = useSettings();

    const overlayOptions = [
      { value: "bottom", label: t("settings.advanced.overlay.options.bottom") },
      { value: "top", label: t("settings.advanced.overlay.options.top") },
    ];

    const storedPosition = getSetting("overlay_position");
    const selectedPosition: OverlayPosition =
      storedPosition === "top" ? "top" : "bottom";

    useEffect(() => {
      if (storedPosition !== "top" && storedPosition !== "bottom") {
        updateSetting("overlay_position", "bottom");
      }
    }, [storedPosition, updateSetting]);

    return (
      <SettingContainer
        title={t("settings.advanced.overlay.title")}
        description={t("settings.advanced.overlay.description")}
        descriptionMode={descriptionMode}
        grouped={grouped}
      >
        <Dropdown
          options={overlayOptions}
          selectedValue={selectedPosition}
          onSelect={(value) =>
            updateSetting("overlay_position", value as OverlayPosition)
          }
          disabled={isUpdating("overlay_position")}
        />
      </SettingContainer>
    );
  },
);
