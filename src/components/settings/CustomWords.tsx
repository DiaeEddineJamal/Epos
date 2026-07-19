import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { commands } from "../../bindings";
import { useSettings } from "../../hooks/useSettings";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { SettingContainer } from "../ui/SettingContainer";

interface CustomWordsProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

export const CustomWords: React.FC<CustomWordsProps> = React.memo(
  ({ descriptionMode = "tooltip", grouped = false }) => {
    const { t } = useTranslation();
    const { getSetting, updateSetting, isUpdating } = useSettings();
    const [newWord, setNewWord] = useState("");
    const [heardText, setHeardText] = useState("");
    const [correctedText, setCorrectedText] = useState("");
    const [isTeaching, setIsTeaching] = useState(false);
    const customWords = getSetting("custom_words") || [];

    const handleAddWord = () => {
      const trimmedWord = newWord.trim();
      const sanitizedWord = trimmedWord.replace(/[<>"'&]/g, "");
      if (
        sanitizedWord &&
        !sanitizedWord.includes(" ") &&
        sanitizedWord.length <= 50
      ) {
        if (customWords.includes(sanitizedWord)) {
          toast.error(
            t("settings.advanced.customWords.duplicate", {
              word: sanitizedWord,
            }),
          );
          return;
        }
        updateSetting("custom_words", [...customWords, sanitizedWord]);
        setNewWord("");
      }
    };

    const handleRemoveWord = (wordToRemove: string) => {
      updateSetting(
        "custom_words",
        customWords.filter((word) => word !== wordToRemove),
      );
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddWord();
      }
    };

    const handleTeach = async () => {
      if (!heardText.trim() || !correctedText.trim()) return;
      setIsTeaching(true);
      try {
        const result = await commands.teachEposCorrection(
          heardText.trim(),
          correctedText.trim(),
        );
        if (result.status === "error") {
          toast.error(result.error);
          return;
        }
        setHeardText("");
        setCorrectedText("");
        toast.success(
          t("settings.advanced.customWords.taught", {
            defaultValue: "Correction learned locally",
          }),
        );
      } catch (error) {
        toast.error(String(error));
      } finally {
        setIsTeaching(false);
      }
    };

    return (
      <>
        <SettingContainer
          title={t("settings.advanced.customWords.title")}
          description={t("settings.advanced.customWords.description")}
          descriptionMode={descriptionMode}
          grouped={grouped}
        >
          <div className="flex items-center gap-2">
            <Input
              type="text"
              className="max-w-40"
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={t("settings.advanced.customWords.placeholder")}
              variant="compact"
              disabled={isUpdating("custom_words")}
            />
            <Button
              onClick={handleAddWord}
              disabled={
                !newWord.trim() ||
                newWord.includes(" ") ||
                newWord.trim().length > 50 ||
                isUpdating("custom_words")
              }
              variant="primary"
              size="md"
            >
              {t("settings.advanced.customWords.add")}
            </Button>
          </div>
        </SettingContainer>
        <SettingContainer
          title={t("settings.advanced.customWords.teachTitle", {
            defaultValue: "Teach EPOS a correction",
          })}
          description={t("settings.advanced.customWords.teachDescription", {
            defaultValue:
              "Save what EPOS heard and the wording you want. Future dictations are corrected locally.",
          })}
          descriptionMode={descriptionMode}
          grouped={grouped}
          layout="stacked"
        >
          <div className="flex w-full min-w-0 flex-col gap-2">
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
              <Input
                type="text"
                className="min-w-0 w-full"
                value={heardText}
                onChange={(event) => setHeardText(event.target.value)}
                placeholder={t("settings.advanced.customWords.heard", {
                  defaultValue: "What EPOS heard",
                })}
                variant="compact"
              />
              <span aria-hidden className="font-mono text-mid-gray">
                →
              </span>
              <Input
                type="text"
                className="min-w-0 w-full"
                value={correctedText}
                onChange={(event) => setCorrectedText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void handleTeach();
                }}
                placeholder={t("settings.advanced.customWords.corrected", {
                  defaultValue: "Use this instead",
                })}
                variant="compact"
              />
            </div>
            <Button
              className="self-end"
              onClick={() => void handleTeach()}
              disabled={
                isTeaching || !heardText.trim() || !correctedText.trim()
              }
              variant="primary"
              size="sm"
            >
              {t("settings.advanced.customWords.teach", {
                defaultValue: "Teach",
              })}
            </Button>
          </div>
        </SettingContainer>
        {customWords.length > 0 && (
          <div
            className={`px-4 p-2 ${grouped ? "" : "rounded-xl border border-primary/10 bg-white shadow-sm"} flex flex-wrap gap-1`}
          >
            {customWords.map((word) => (
              <Button
                key={word}
                onClick={() => handleRemoveWord(word)}
                disabled={isUpdating("custom_words")}
                variant="secondary"
                size="sm"
                className="inline-flex items-center gap-1 cursor-pointer"
                aria-label={t("settings.advanced.customWords.remove", { word })}
              >
                <span>{word}</span>
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </Button>
            ))}
          </div>
        )}
      </>
    );
  },
);
