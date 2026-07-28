import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import { useSettings } from "../../hooks/useSettings";
import { commands } from "@/bindings";

interface GpuAccelerationProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

/**
 * Master switch for GPU acceleration across both engines (whisper.cpp and ONNX
 * Runtime). Covers integrated and dedicated GPUs alike — on Windows the ONNX
 * models run through DirectML, which targets any DirectX 12 adapter.
 *
 * Hidden entirely when the build has no GPU backend compiled in, so the toggle
 * is never shown where flipping it would change nothing.
 */
export const GpuAcceleration: React.FC<GpuAccelerationProps> = React.memo(
  ({ descriptionMode = "tooltip", grouped = false }) => {
    const { t } = useTranslation();
    const { getSetting, updateSetting, isUpdating } = useSettings();
    const [supported, setSupported] = useState<boolean | null>(null);

    useEffect(() => {
      let cancelled = false;
      commands
        .getAvailableAccelerators()
        .then((available) => {
          if (!cancelled) setSupported(available.gpu_supported);
        })
        .catch(() => {
          if (!cancelled) setSupported(false);
        });
      return () => {
        cancelled = true;
      };
    }, []);

    // Default to on, matching the Rust-side default.
    const enabled = getSetting("gpu_acceleration_enabled") ?? true;

    if (supported === false) return null;

    return (
      <ToggleSwitch
        checked={enabled}
        onChange={(value) => updateSetting("gpu_acceleration_enabled", value)}
        isUpdating={isUpdating("gpu_acceleration_enabled")}
        label={t("settings.advanced.gpuAcceleration.label")}
        description={t("settings.advanced.gpuAcceleration.description")}
        descriptionMode={descriptionMode}
        grouped={grouped}
      />
    );
  },
);
