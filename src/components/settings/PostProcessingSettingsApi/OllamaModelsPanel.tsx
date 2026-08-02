import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { Download, Trash2, Cpu, Zap, RefreshCw } from "lucide-react";
import {
  commands,
  type OllamaModelOption,
  type OllamaGpuStatus,
} from "@/bindings";
import { Button } from "../../ui/Button";
import { Alert } from "../../ui/Alert";
import ProgressBar from "../../shared/ProgressBar";

// Mirrors managers::ollama::OllamaPullProgress. Emitted via a raw event
// (like the ASR model-download-progress pattern) rather than a typed
// tauri-specta event, so it isn't in bindings.ts — defined here instead.
interface OllamaPullProgress {
  model_id: string;
  status: string;
  completed: number;
  total: number;
  percentage: number;
}

type Phase =
  | "checking"
  | "not_installed"
  | "installing"
  | "installed_not_running"
  | "starting"
  | "running";

interface OllamaModelsPanelProps {
  selectedModel: string;
  onSelectModel: (tag: string) => void;
}

const formatSize = (mb: number): string =>
  mb >= 1000 ? `${(mb / 1000).toFixed(1)} GB` : `${mb} MB`;

export const OllamaModelsPanel: React.FC<OllamaModelsPanelProps> = ({
  selectedModel,
  onSelectModel,
}) => {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>("checking");
  const [installStep, setInstallStep] = useState<string>("");
  const [installError, setInstallError] = useState<string | null>(null);
  const [models, setModels] = useState<OllamaModelOption[]>([]);
  const [pullProgress, setPullProgress] = useState<
    Record<string, OllamaPullProgress>
  >({});
  const [pullErrors, setPullErrors] = useState<Record<string, string>>({});
  const [gpuStatus, setGpuStatus] = useState<Record<string, OllamaGpuStatus>>(
    {},
  );
  // Non-Windows platforms have no verified silent-install path (see
  // managers::ollama::install), so success there means "the browser tab is
  // open" — we poll status instead of waiting on a single install() call.
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshModels = useCallback(async () => {
    const result = await commands.getOllamaRecommendedModels();
    if (result.status === "ok") {
      setModels(result.data);
    }
  }, []);

  const checkStatus = useCallback(async () => {
    const result = await commands.getOllamaStatus();
    if (result.status !== "ok") return;

    if (result.data.availability === "running") {
      setPhase("running");
      void refreshModels();
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    } else if (result.data.availability === "installed_not_running") {
      setPhase((prev) =>
        prev === "installing" ? prev : "installed_not_running",
      );
    } else {
      setPhase((prev) => (prev === "installing" ? prev : "not_installed"));
    }
  }, [refreshModels]);

  useEffect(() => {
    void checkStatus();
    // Intentionally run once on mount only — checkStatus is re-created each
    // render (it closes over refreshModels), and re-running it on every
    // change would restart the availability check in a loop.
  }, []);

  useEffect(() => {
    const unlistenProgress = listen<OllamaPullProgress>(
      "ollama-pull-progress",
      (event) => {
        setPullProgress((prev) => ({
          ...prev,
          [event.payload.model_id]: event.payload,
        }));
        if (event.payload.status === "success") {
          setPullErrors((prev) => {
            const next = { ...prev };
            delete next[event.payload.model_id];
            return next;
          });
          setTimeout(() => {
            setPullProgress((prev) => {
              const next = { ...prev };
              delete next[event.payload.model_id];
              return next;
            });
            void refreshModels();
          }, 600);
        }
      },
    );

    const unlistenFailed = listen<{ model_id: string; error: string }>(
      "ollama-pull-failed",
      (event) => {
        setPullErrors((prev) => ({
          ...prev,
          [event.payload.model_id]: event.payload.error,
        }));
        setPullProgress((prev) => {
          const next = { ...prev };
          delete next[event.payload.model_id];
          return next;
        });
      },
    );

    const unlistenInstall = listen<string>(
      "ollama-install-progress",
      (event) => {
        setInstallStep(event.payload);
      },
    );

    const unlistenInstallFailed = listen<string>(
      "ollama-install-failed",
      (event) => {
        setInstallError(event.payload);
        setPhase("not_installed");
      },
    );

    return () => {
      unlistenProgress.then((fn) => fn());
      unlistenFailed.then((fn) => fn());
      unlistenInstall.then((fn) => fn());
      unlistenInstallFailed.then((fn) => fn());
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refreshModels]);

  const handleInstall = async () => {
    setInstallError(null);
    setPhase("installing");
    setInstallStep("");

    if (navigator.platform.toLowerCase().includes("win")) {
      const result = await commands.installOllama();
      if (result.status === "ok") {
        setPhase("running");
        void refreshModels();
      } else {
        setInstallError(result.error);
        setPhase("not_installed");
      }
      return;
    }

    // macOS/Linux: no verified silent installer — send the user to the
    // official download page and poll until Ollama comes up.
    await commands.installOllama().catch(() => undefined);
    window.open("https://ollama.com/download", "_blank");
    pollRef.current = setInterval(() => void checkStatus(), 3000);
  };

  const handleStart = async () => {
    setPhase("starting");
    const result = await commands.startOllamaServer();
    if (result.status === "ok") {
      setPhase("running");
      void refreshModels();
    } else {
      setInstallError(result.error);
      setPhase("installed_not_running");
    }
  };

  const handleDownload = async (model: OllamaModelOption) => {
    setPullErrors((prev) => {
      const next = { ...prev };
      delete next[model.id];
      return next;
    });
    setModels((prev) =>
      prev.map((m) => (m.id === model.id ? { ...m, is_downloading: true } : m)),
    );
    await commands.pullOllamaModel(model.id);
  };

  const handleCancel = async (modelId: string) => {
    await commands.cancelOllamaPull(modelId);
    setPullProgress((prev) => {
      const next = { ...prev };
      delete next[modelId];
      return next;
    });
    void refreshModels();
  };

  const handleDelete = async (model: OllamaModelOption) => {
    await commands.deleteOllamaModel(model.id);
    void refreshModels();
  };

  const handleUse = async (model: OllamaModelOption) => {
    onSelectModel(model.tag);
    const status = await commands.getOllamaGpuStatus(model.id);
    if (status.status === "ok") {
      setGpuStatus((prev) => ({ ...prev, [model.id]: status.data }));
    }
  };

  if (phase === "checking") {
    return (
      <p className="text-sm text-text/60 italic">
        {t("settings.postProcessing.ollama.checking")}
      </p>
    );
  }

  if (phase === "not_installed" || phase === "installing") {
    return (
      <div className="space-y-3">
        <Alert variant="info" contained>
          {t("settings.postProcessing.ollama.introduction")}
        </Alert>
        {installError && (
          <Alert variant="error" contained>
            {installError}
          </Alert>
        )}
        <Button
          onClick={handleInstall}
          variant="primary"
          size="md"
          disabled={phase === "installing"}
        >
          {phase === "installing"
            ? t(`settings.postProcessing.ollama.installStep.${installStep}`, {
                defaultValue: t("settings.postProcessing.ollama.installing"),
              })
            : t("settings.postProcessing.ollama.install")}
        </Button>
      </div>
    );
  }

  if (phase === "installed_not_running" || phase === "starting") {
    return (
      <div className="space-y-3">
        <Alert variant="warning" contained>
          {t("settings.postProcessing.ollama.notRunning")}
        </Alert>
        <Button
          onClick={handleStart}
          variant="primary"
          size="md"
          disabled={phase === "starting"}
        >
          {phase === "starting"
            ? t("settings.postProcessing.ollama.starting")
            : t("settings.postProcessing.ollama.start")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text/60">
          {t("settings.postProcessing.ollama.runningDescription")}
        </p>
        <button
          type="button"
          onClick={() => void refreshModels()}
          aria-label={t("settings.postProcessing.ollama.refresh")}
          className="text-text/50 hover:text-text transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-2">
        {models.map((model) => {
          const progress = pullProgress[model.id];
          const error = pullErrors[model.id];
          const isActive = selectedModel === model.tag;
          const gpu = gpuStatus[model.id];

          return (
            <div
              key={model.id}
              className={`p-3 rounded-lg border transition-colors ${
                isActive
                  ? "border-primary bg-primary/5"
                  : "border-hairline bg-background-ui"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text">
                      {model.name}
                    </span>
                    {model.is_recommended && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                        {t("settings.postProcessing.ollama.recommended")}
                      </span>
                    )}
                    {isActive && gpu && (
                      <span
                        className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-text/60"
                        title={t(
                          `settings.postProcessing.ollama.gpuStatus.${gpu}`,
                        )}
                      >
                        {gpu === "gpu" || gpu === "partial" ? (
                          <Zap className="h-3 w-3" />
                        ) : (
                          <Cpu className="h-3 w-3" />
                        )}
                        {t(`settings.postProcessing.ollama.gpuStatus.${gpu}`)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text/60 mt-0.5">
                    {model.description}
                  </p>
                  <p className="text-[11px] text-text/40 mt-1">
                    {formatSize(model.size_mb)}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {progress ? (
                    <div className="flex items-center gap-2">
                      <ProgressBar
                        progress={[
                          { id: model.id, percentage: progress.percentage },
                        ]}
                        size="small"
                      />
                      <button
                        type="button"
                        onClick={() => void handleCancel(model.id)}
                        className="text-xs text-text/50 hover:text-text"
                      >
                        {t("settings.postProcessing.ollama.cancel")}
                      </button>
                    </div>
                  ) : model.is_downloaded ? (
                    <>
                      <Button
                        onClick={() => void handleUse(model)}
                        variant={isActive ? "secondary" : "primary-soft"}
                        size="sm"
                        disabled={isActive}
                      >
                        {isActive
                          ? t("settings.postProcessing.ollama.inUse")
                          : t("settings.postProcessing.ollama.use")}
                      </Button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(model)}
                        aria-label={t("settings.postProcessing.ollama.delete")}
                        className="text-text/40 hover:text-amber-deep transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <Button
                      onClick={() => void handleDownload(model)}
                      variant="primary-soft"
                      size="sm"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {t("settings.postProcessing.ollama.download")}
                    </Button>
                  )}
                </div>
              </div>

              {error && <p className="text-xs text-amber-deep mt-2">{error}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
};
