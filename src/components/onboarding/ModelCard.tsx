import React from "react";
import { useTranslation } from "react-i18next";
import {
  Check,
  Download,
  Globe,
  Languages,
  Loader2,
  Trash2,
} from "lucide-react";
import type { ModelInfo } from "@/bindings";
import { formatModelSize } from "../../lib/utils/format";
import {
  getTranslatedModelDescription,
  getTranslatedModelName,
} from "../../lib/utils/modelTranslation";
import { LANGUAGES } from "../../lib/constants/languages";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

// Get display text for model's language support
const getLanguageDisplayText = (
  supportedLanguages: string[],
  t: (key: string, options?: Record<string, unknown>) => string,
): string => {
  if (supportedLanguages.length === 1) {
    const langCode = supportedLanguages[0];
    const langName =
      LANGUAGES.find((l) => l.value === langCode)?.label || langCode;
    return t("modelSelector.capabilities.languageOnly", { language: langName });
  }
  return t("modelSelector.capabilities.multiLanguage");
};

export type ModelCardStatus =
  | "downloadable"
  | "downloading"
  | "verifying"
  | "extracting"
  | "switching"
  | "active"
  | "available";

interface ModelCardProps {
  model: ModelInfo;
  variant?: "default" | "featured";
  status?: ModelCardStatus;
  disabled?: boolean;
  className?: string;
  onSelect: (modelId: string) => void;
  onDownload?: (modelId: string) => void;
  onDelete?: (modelId: string) => void;
  onCancel?: (modelId: string) => void;
  downloadProgress?: number;
  downloadSpeed?: number; // MB/s
  showRecommended?: boolean;
  colorVariant?: "white" | "tan" | "green" | "purple" | "blue" | "light-tan";
}

const ModelCard: React.FC<ModelCardProps> = ({
  model,
  variant = "default",
  status = "downloadable",
  disabled = false,
  className = "",
  onSelect,
  onDownload,
  onDelete,
  onCancel,
  downloadProgress,
  downloadSpeed,
  showRecommended = true,
  colorVariant = "white",
}) => {
  const { t } = useTranslation();
  const isFeatured = variant === "featured";
  const isClickable =
    status === "available" || status === "active" || status === "downloadable";

  // Get translated model name and description
  const displayName = getTranslatedModelName(model, t);
  const displayDescription = getTranslatedModelDescription(model, t);

  const baseClasses =
    "flex flex-col rounded-xl px-4 py-3 gap-2 text-left transition-all duration-200 overflow-hidden";

  const getVariantClasses = () => {
    if (status === "active") {
      return "border border-live/35 bg-accent-tan-dark shadow-sm dark:border-slate/45 dark:bg-[color-mix(in_srgb,var(--color-midnight),var(--color-slate-deep)_42%)]";
    }

    switch (colorVariant) {
      case "tan":
        return "border border-primary/10 bg-accent-tan";
      case "green":
        return "border border-primary/10 bg-secondary";
      case "purple":
        return "border border-primary/10 bg-accent-purple";
      case "blue":
        return "border border-primary/10 bg-accent-blue";
      case "light-tan":
        return "border border-primary/10 bg-background-ui";
      default:
        if (isFeatured) {
          return "border border-primary/10 bg-accent-tan";
        }
        return "border border-primary/10 bg-white";
    }
  };

  const getInteractiveClasses = () => {
    if (!isClickable) return "";
    if (disabled) return "opacity-50 cursor-not-allowed";
    return "cursor-pointer hover:shadow-md transition-all duration-200 ease-out group hover:-translate-y-0.5";
  };

  const handleClick = () => {
    if (!isClickable || disabled) return;
    if (status === "downloadable" && onDownload) {
      onDownload(model.id);
    } else {
      onSelect(model.id);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(model.id);
  };

  return (
    <div
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" && isClickable) handleClick();
      }}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      className={[
        baseClasses,
        getVariantClasses(),
        getInteractiveClasses(),
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex justify-between items-start w-full gap-4">
        <div className="flex flex-col items-start flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h3
              className={`text-[32px] font-serif font-bold text-text ${isClickable ? "group-hover:text-primary transition-colors" : ""} tracking-tight leading-none mt-1`}
            >
              {displayName}
            </h3>
            {showRecommended && model.is_recommended && (
              <Badge
                variant="primary"
                className="bg-[#1A1A1A] text-white rounded-full px-3 py-0.5 text-[11px] font-sans tracking-wide border-none uppercase"
              >
                {t("onboarding.recommended")}
              </Badge>
            )}
            {status === "active" && (
              <Badge
                variant="primary"
                className="bg-[#1A1A1A] text-white rounded-full px-3 py-0.5 text-[11px] font-sans tracking-wide border-none uppercase"
              >
                <Check className="w-3 h-3 mr-1 inline" />
                {t("modelSelector.active")}
              </Badge>
            )}
            {model.is_custom && (
              <Badge
                variant="secondary"
                className="rounded-full px-3 py-0.5 text-[11px] font-sans tracking-wide uppercase bg-black/5"
              >
                {t("modelSelector.custom")}
              </Badge>
            )}
            {status === "switching" && (
              <Badge
                variant="secondary"
                className="rounded-full px-3 py-0.5 text-[11px] font-sans tracking-wide uppercase bg-black/5"
              >
                <Loader2 className="w-3 h-3 mr-1 animate-spin inline" />
                {t("modelSelector.switching")}
              </Badge>
            )}
          </div>
          <p className="text-text/70 text-[15px] leading-relaxed font-medium mt-1 font-sans">
            {displayDescription}
          </p>
        </div>

        <div className="flex flex-col items-end gap-3 mt-1 shrink-0">
          {(model.accuracy_score > 0 || model.speed_score > 0) && (
            <div className="hidden sm:flex items-center">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-text/40 w-20 text-end font-sans">
                    {t("onboarding.modelCard.accuracy")}
                  </p>
                  <div className="w-16 h-1 bg-primary/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-700"
                      style={{ width: `${model.accuracy_score * 100}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-text/40 w-20 text-end font-sans">
                    {t("onboarding.modelCard.speed")}
                  </p>
                  <div className="w-16 h-1 bg-primary/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-700"
                      style={{ width: `${model.speed_score * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 w-full justify-end">
            {status === "downloadable" && (
              <div className="flex items-center gap-2 text-[14px] font-medium text-text/60 font-sans border border-primary/10 rounded-full px-3 py-1 bg-white/50">
                <Download className="w-4 h-4" />
                <span>{formatModelSize(Number(model.size_mb))}</span>
              </div>
            )}

            {onDelete && (status === "available" || status === "active") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                title={t("modelSelector.deleteModel", {
                  modelName: displayName,
                })}
                className="flex items-center gap-1.5 text-primary/80 hover:text-primary hover:bg-primary/5 rounded-full px-3 py-1 font-sans"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t("common.delete")}</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Download/extract progress */}
      {status === "downloading" && downloadProgress !== undefined && (
        <div className="w-full mt-3">
          <div className="w-full h-1.5 bg-mid-gray/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${downloadProgress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs mt-1">
            <span className="text-text/50">
              {t("modelSelector.downloading", {
                percentage: Math.round(downloadProgress),
              })}
            </span>
            <div className="flex items-center gap-2">
              {downloadSpeed !== undefined && downloadSpeed > 0 && (
                <span className="tabular-nums text-text/50">
                  {t("modelSelector.downloadSpeed", {
                    speed: downloadSpeed.toFixed(1),
                  })}
                </span>
              )}
              {onCancel && (
                <Button
                  variant="danger-ghost"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onCancel(model.id);
                  }}
                  aria-label={t("modelSelector.cancelDownload")}
                >
                  {t("modelSelector.cancel")}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
      {status === "verifying" && (
        <div className="w-full mt-3">
          <div className="w-full h-1.5 bg-mid-gray/20 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full animate-pulse w-full shadow-[0_0_8px_rgba(217,119,87,0.4)]" />
          </div>
          <p className="text-xs text-text/50 mt-1">
            {t("modelSelector.verifyingGeneric")}
          </p>
        </div>
      )}
      {status === "extracting" && (
        <div className="w-full mt-3">
          <div className="w-full h-1.5 bg-mid-gray/20 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full animate-pulse w-full shadow-[0_0_8px_rgba(217,119,87,0.4)]" />
          </div>
          <p className="text-xs text-text/50 mt-1">
            {t("modelSelector.extractingGeneric")}
          </p>
        </div>
      )}
    </div>
  );
};

export default ModelCard;
