import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "../../ui/Input";
import { SettingContainer } from "../../ui/SettingContainer";
import { useSettings } from "../../../hooks/useSettings";

interface UserNameSettingProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

export const UserNameSetting: React.FC<UserNameSettingProps> = React.memo(
  ({ descriptionMode = "tooltip", grouped = false }) => {
    const { t } = useTranslation();
    const { getSetting, updateSetting } = useSettings();

    const storedName = getSetting("user_name") ?? "";
    const [local, setLocal] = useState(storedName);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const dirtyRef = useRef(false);
    const latestRef = useRef(local);
    latestRef.current = local;

    // Sync from the store when the persisted value changes externally
    // (initial load, reset elsewhere) — but never clobber an in-flight edit.
    useEffect(() => {
      if (!dirtyRef.current) {
        setLocal(storedName);
      }
    }, [storedName]);

    const commit = (value: string) => {
      dirtyRef.current = false;
      void updateSetting("user_name", value);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      dirtyRef.current = true;
      setLocal(value);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => commit(value), 500);
    };

    const handleBlur = () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (dirtyRef.current) {
        commit(local);
      }
    };

    // Flush any pending edit on unmount (e.g. switching settings tabs quickly).
    useEffect(() => {
      return () => {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
        if (dirtyRef.current) {
          void updateSetting("user_name", latestRef.current);
        }
      };
      // updateSetting is a stable store action; run cleanup only on unmount.
    }, []);

    return (
      <SettingContainer
        title={t("settings.system.userName.label")}
        description={t("settings.system.userName.description")}
        descriptionMode={descriptionMode}
        grouped={grouped}
      >
        <Input
          type="text"
          variant="compact"
          className="max-w-48"
          placeholder={t("settings.system.userName.placeholder")}
          value={local}
          onChange={handleChange}
          onBlur={handleBlur}
        />
      </SettingContainer>
    );
  },
);
