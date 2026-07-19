import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { ModelInfo } from "@/bindings";
import type { ModelCardStatus } from "./ModelCard";
import { OnboardingModelRow } from "./OnboardingModelRow";
import { OnboardingShell } from "./OnboardingShell";
import { useModelStore } from "../../stores/modelStore";

interface OnboardingProps {
  onModelSelected: () => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onModelSelected }) => {
  const { t } = useTranslation();
  const {
    models,
    downloadModel,
    selectModel,
    downloadingModels,
    verifyingModels,
    extractingModels,
    downloadProgress,
    downloadStats,
  } = useModelStore();
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);

  const isDownloading = selectedModelId !== null;

  // Watch for the selected model to finish downloading + verifying + extracting
  useEffect(() => {
    if (!selectedModelId) return;

    const model = models.find((m) => m.id === selectedModelId);
    const stillDownloading = selectedModelId in downloadingModels;
    const stillVerifying = selectedModelId in verifyingModels;
    const stillExtracting = selectedModelId in extractingModels;

    if (
      model?.is_downloaded &&
      !stillDownloading &&
      !stillVerifying &&
      !stillExtracting
    ) {
      // Model is ready — select it and transition
      selectModel(selectedModelId).then((success) => {
        if (success) {
          onModelSelected();
        } else {
          toast.error(t("onboarding.errors.selectModel"));
          setSelectedModelId(null);
        }
      });
    }
  }, [
    selectedModelId,
    models,
    downloadingModels,
    verifyingModels,
    extractingModels,
    selectModel,
    onModelSelected,
  ]);

  const handleDownloadModel = async (modelId: string) => {
    setSelectedModelId(modelId);
    const success = await downloadModel(modelId);
    if (!success) {
      setSelectedModelId(null);
    }
  };

  const getModelStatus = (modelId: string): ModelCardStatus => {
    if (modelId in extractingModels) return "extracting";
    if (modelId in verifyingModels) return "verifying";
    if (modelId in downloadingModels) return "downloading";
    return "downloadable";
  };

  const getModelDownloadProgress = (modelId: string): number | undefined => {
    return downloadProgress[modelId]?.percentage;
  };

  const getModelDownloadSpeed = (modelId: string): number | undefined => {
    return downloadStats[modelId]?.speed;
  };

  const recommended = models
    .filter((m: ModelInfo) => !m.is_downloaded && m.is_recommended);
  const others = models
    .filter((m: ModelInfo) => !m.is_downloaded && !m.is_recommended)
    .sort((a: ModelInfo, b: ModelInfo) => Number(a.size_mb) - Number(b.size_mb));

  const renderRow = (model: ModelInfo, index: number) => (
    <OnboardingModelRow
      key={model.id}
      model={model}
      designation={index + 1}
      recommended={model.is_recommended}
      status={getModelStatus(model.id)}
      disabled={isDownloading}
      onDownload={handleDownloadModel}
      downloadProgress={getModelDownloadProgress(model.id)}
      downloadSpeed={getModelDownloadSpeed(model.id)}
    />
  );

  return (
    <OnboardingShell
      step={2}
      totalSteps={2}
      title={t("onboarding.modelStep.title")}
      subtitle={t("onboarding.modelStep.subtitle")}
    >
      <div className="flex flex-col gap-6">
        {recommended.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.24em] text-text/45">
              {t("onboarding.recommendedModels")}
            </h2>
            <div className="flex flex-col gap-3">
              {recommended.map((model, i) => renderRow(model, i))}
            </div>
          </section>
        )}

        {others.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.24em] text-text/45">
              {t("onboarding.otherModels")}
            </h2>
            <div className="flex flex-col gap-3">
              {others.map((model, i) => renderRow(model, recommended.length + i))}
            </div>
          </section>
        )}
      </div>
    </OnboardingShell>
  );
};

export default Onboarding;
