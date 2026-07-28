import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { SettingContainer } from "../ui/SettingContainer";
import { ResetButton } from "../ui/ResetButton";
import { Dropdown } from "../ui/Dropdown";
import { useSettings } from "../../hooks/useSettings";
import { LANGUAGES } from "../../lib/constants/languages";

interface LanguageSelectorProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
  supportedLanguages?: string[];
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  descriptionMode = "tooltip",
  grouped = false,
  supportedLanguages,
}) => {
  const { t } = useTranslation();
  const { getSetting, updateSetting, resetSetting, isUpdating } = useSettings();

  const selectedLanguage = getSetting("selected_language") || "auto";
  const updating = isUpdating("selected_language");

  const options = useMemo(() => {
    const available =
      !supportedLanguages || supportedLanguages.length === 0
        ? LANGUAGES
        : LANGUAGES.filter(
            (lang) =>
              lang.value === "auto" || supportedLanguages.includes(lang.value),
          );
    return available.map((lang) => ({ value: lang.value, label: lang.label }));
  }, [supportedLanguages]);

  const handleLanguageSelect = async (languageCode: string) => {
    await updateSetting("selected_language", languageCode);
  };

  const handleReset = async () => {
    await resetSetting("selected_language");
  };

  return (
    <SettingContainer
      title={t("settings.general.language.title")}
      description={t("settings.general.language.description")}
      descriptionMode={descriptionMode}
      grouped={grouped}
    >
      <div className="flex items-center space-x-1">
        <Dropdown
          options={options}
          selectedValue={selectedLanguage}
          onSelect={handleLanguageSelect}
          placeholder={t("settings.general.language.auto")}
          disabled={updating}
          searchable
          searchPlaceholder={t("settings.general.language.searchPlaceholder")}
          noResultsLabel={t("settings.general.language.noResults")}
        />
        <ResetButton onClick={handleReset} disabled={updating} />
      </div>
      {updating && (
        <div className="absolute inset-0 bg-background/20 backdrop-blur-[1px] rounded flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </SettingContainer>
  );
};
