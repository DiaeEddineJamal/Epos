import React from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, Check, Download, Loader2 } from "lucide-react";
import type { ModelInfo } from "@/bindings";
import { formatModelSize } from "../../lib/utils/format";
import {
  getTranslatedModelDescription,
  getTranslatedModelName,
} from "../../lib/utils/modelTranslation";
import type { ModelCardStatus } from "./ModelCard";

interface OnboardingModelRowProps {
  model: ModelInfo;
  designation: number;
  status: ModelCardStatus;
  disabled: boolean;
  recommended?: boolean;
  onDownload: (id: string) => void;
  downloadProgress?: number;
  downloadSpeed?: number;
}

const Meter: React.FC<{ label: string; value: number }> = ({
  label,
  value,
}) => (
  <div className="flex items-center gap-2">
    <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-text/35 w-14 text-end">
      {label}
    </span>
    <span className="block h-1 w-14 bg-hairline overflow-hidden rounded-[1px]">
      <span
        className="block h-full bg-live"
        style={{ width: `${Math.round(value * 100)}%` }}
      />
    </span>
  </div>
);

/**
 * A single refinement-engine row in the induction model step — a Lumon file
 * row: designation number, engine name (tracked caps), description, accuracy /
 * speed micro-meters, install size, and an inline install-progress state.
 */
export const OnboardingModelRow: React.FC<OnboardingModelRowProps> = ({
  model,
  designation,
  status,
  disabled,
  recommended,
  onDownload,
  downloadProgress,
  downloadSpeed,
}) => {
  const { t } = useTranslation();
  const name = getTranslatedModelName(model, t);
  const description = getTranslatedModelDescription(model, t);
  const busy =
    status === "downloading" ||
    status === "verifying" ||
    status === "extracting";
  const interactive = status === "downloadable" && !disabled;

  const handleClick = () => {
    if (interactive) onDownload(model.id);
  };

  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-disabled={disabled}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" && interactive) handleClick();
      }}
      className={`epos-file-row group ${interactive ? "is-interactive" : ""} ${
        disabled && !busy ? "is-disabled" : ""
      } ${busy ? "is-active" : ""}`}
    >
      <div className="epos-file-desig">
        {String(designation).padStart(2, "0")}
      </div>

      <div className="flex flex-1 flex-col gap-2 px-5 py-4 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-[15px] font-medium uppercase tracking-[0.1em] text-text truncate">
                {name}
              </h3>
              {recommended && (
                <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-live border border-[color-mix(in_srgb,var(--color-live),transparent_60%)] rounded-[1px] px-1.5 py-0.5">
                  {t("onboarding.recommended")}
                </span>
              )}
            </div>
            <p className="text-[13px] text-text/55 leading-relaxed mt-1">
              {description}
            </p>
          </div>

          {(model.accuracy_score > 0 || model.speed_score > 0) && !busy && (
            <div className="hidden sm:flex flex-col gap-1.5 pt-0.5 shrink-0">
              <Meter
                label={t("onboarding.modelCard.accuracy")}
                value={model.accuracy_score}
              />
              <Meter
                label={t("onboarding.modelCard.speed")}
                value={model.speed_score}
              />
            </div>
          )}
        </div>

        {busy ? (
          <div className="flex flex-col gap-1.5 pt-1">
            <span className="block h-1 w-full bg-hairline overflow-hidden rounded-[1px]">
              <span
                className={`block h-full bg-live ${
                  status === "downloading" ? "" : "animate-pulse-slow"
                }`}
                style={{
                  width:
                    status === "downloading" && downloadProgress !== undefined
                      ? `${downloadProgress}%`
                      : "100%",
                }}
              />
            </span>
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-text/45">
              <Loader2 size={11} className="animate-spin" />
              {status === "downloading" ? (
                <span>
                  {t("modelSelector.downloading", {
                    percentage: Math.round(downloadProgress ?? 0),
                  })}
                  {downloadSpeed !== undefined && downloadSpeed > 0 && (
                    <span className="tabular-nums">
                      {" · "}
                      {t("modelSelector.downloadSpeed", {
                        speed: downloadSpeed.toFixed(1),
                      })}
                    </span>
                  )}
                </span>
              ) : status === "verifying" ? (
                <span>{t("modelSelector.verifyingGeneric")}</span>
              ) : (
                <span>{t("modelSelector.extractingGeneric")}</span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 pt-0.5">
            <span className="flex items-center gap-1.5 font-mono text-[11px] tabular-nums text-text/45">
              <Download size={13} strokeWidth={1.75} />
              {formatModelSize(Number(model.size_mb))}
            </span>
            {model.is_downloaded ? (
              <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-live">
                <Check size={13} strokeWidth={2} />
                {t("onboarding.permissions.granted")}
              </span>
            ) : (
              <span
                className={`flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors duration-300 ${
                  interactive
                    ? "text-text/50 group-hover:text-live"
                    : "text-text/25"
                }`}
              >
                {t("onboarding.install")}
                <ArrowRight size={13} strokeWidth={1.75} />
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingModelRow;
