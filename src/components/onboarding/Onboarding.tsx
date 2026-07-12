import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { ModelInfo } from "@/bindings";
import type { ModelCardStatus } from "./ModelCard";
import ModelCard from "./ModelCard";
import EposTextLogo from "../icons/EposTextLogo";
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

  return (
    <div className="h-full w-full flex flex-col p-8 gap-6 inset-0 bg-background overflow-hidden relative">
      <div className="flex flex-col items-center gap-6 shrink-0 pt-16">
        <EposTextLogo width={320} />
        <p className="text-primary max-w-xl font-serif text-3xl text-center leading-relaxed tracking-tight mt-2">
          {t("onboarding.subtitle")}
        </p>
      </div>

      <div className="max-w-[700px] w-full mx-auto text-center flex-1 flex flex-col min-h-0 z-10">
        <div className="flex flex-col gap-4 pb-12 overflow-y-auto px-4 custom-scrollbar">
          <div className="text-[17px] font-medium tracking-wide text-primary/60 mb-1 mt-4 text-left font-serif">
            {t("onboarding.recommendedModels")}
          </div>
          {models
            .filter((m: ModelInfo) => !m.is_downloaded)
            .filter((model: ModelInfo) => model.is_recommended)
            .map((model: ModelInfo, index: number) => (
              <ModelCard
                key={model.id}
                model={model}
                variant="featured"
                colorVariant={['tan', 'green', 'purple', 'blue'][index % 4] as any}
                status={getModelStatus(model.id)}
                disabled={isDownloading}
                onSelect={handleDownloadModel}
                onDownload={handleDownloadModel}
                downloadProgress={getModelDownloadProgress(model.id)}
                downloadSpeed={getModelDownloadSpeed(model.id)}
                className="py-6 px-7 rounded-[1.5rem] min-h-[130px]"
              />
            ))}

          <div className="text-[17px] font-medium tracking-wide text-mid-gray/80 mb-1 mt-8 text-left font-serif">
            {t("onboarding.otherModels")}
          </div>
          {models
            .filter((m: ModelInfo) => !m.is_downloaded)
            .filter((model: ModelInfo) => !model.is_recommended)
            .sort(
              (a: ModelInfo, b: ModelInfo) =>
                Number(a.size_mb) - Number(b.size_mb),
            )
            .map((model: ModelInfo, index: number) => (
              <ModelCard
                key={model.id}
                model={model}
                status={getModelStatus(model.id)}
                colorVariant={['tan', 'green', 'purple', 'blue'][(index + models.filter((m) => m.is_recommended).length) % 4] as any}
                disabled={isDownloading}
                onSelect={handleDownloadModel}
                onDownload={handleDownloadModel}
                downloadProgress={getModelDownloadProgress(model.id)}
                downloadSpeed={getModelDownloadSpeed(model.id)}
                className="py-6 px-7 rounded-[1.5rem] min-h-[130px]"
              />
            ))}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
