import React from "react";
import { useTranslation } from "react-i18next";
import type { ModelInfo } from "@/bindings";
import {
  getTranslatedModelName,
  getTranslatedModelDescription,
} from "../../lib/utils/modelTranslation";

interface ModelDropdownProps {
  models: ModelInfo[];
  currentModelId: string;
  onModelSelect: (modelId: string) => void;
}

const ModelDropdown: React.FC<ModelDropdownProps> = ({
  models,
  currentModelId,
  onModelSelect,
}) => {
  const { t } = useTranslation();
  const downloadedModels = models.filter((m) => m.is_downloaded);

  const handleModelClick = (modelId: string) => {
    onModelSelect(modelId);
  };

  return (
    <div className="absolute bottom-full start-0 mb-4 w-80 max-h-[60vh] overflow-y-auto bg-white border border-primary/10 rounded-2xl shadow-md py-3 z-50">
      {downloadedModels.length > 0 ? (
        <div>
          {downloadedModels.map((model) => (
            <div
              key={model.id}
              onClick={() => handleModelClick(model.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleModelClick(model.id);
                }
              }}
              tabIndex={0}
              role="button"
              className={`group w-full px-5 py-4 text-start hover:bg-background-ui transition-all duration-200 ease-out cursor-pointer focus:outline-none ${
                currentModelId === model.id
                  ? "bg-accent-tan/30 text-primary"
                  : "text-text/70 outline-none focus:bg-background-ui"
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className={`text-[15px] font-medium tracking-tight truncate ${currentModelId === model.id ? 'text-primary' : 'text-text group-hover:text-primary'}`}>
                    {getTranslatedModelName(model, t)}
                    {model.is_custom && (
                      <span className="ms-2 px-1.5 py-0.5 rounded bg-background-ui border border-primary/10 text-[9px] font-medium text-text/70 uppercase tracking-wider">
                        {t("modelSelector.custom")}
                      </span>
                    )}
                  </div>
                  <div className="text-[12px] text-text/60 leading-tight mt-1 truncate group-hover:text-text/80 group-hover:whitespace-normal transition-colors">
                    {getTranslatedModelDescription(model, t)}
                  </div>
                </div>
                {currentModelId === model.id && (
                  <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-primary shrink-0 bg-primary/10 px-2.5 py-1 rounded-full shadow-sm ring-1 ring-primary/20">
                    {t("modelSelector.active")}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-3 py-2 text-sm text-text/60">
          {t("modelSelector.noModelsAvailable")}
        </div>
      )}
    </div>
  );
};

export default ModelDropdown;
