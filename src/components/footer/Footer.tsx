import React, { useState, useEffect } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { useTranslation } from "react-i18next";

import ModelSelector from "../model-selector";
import UpdateChecker from "../update-checker";

const Footer: React.FC = () => {
  const { t } = useTranslation();
  const [version, setVersion] = useState("");

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const appVersion = await getVersion();
        setVersion(appVersion);
      } catch (error) {
        console.error("Failed to get app version:", error);
        setVersion("0.1.2");
      }
    };

    fetchVersion();
  }, []);

  return (
    <div className="w-full border-t hairline bg-background-ui z-10 transition-colors duration-500 ease-in-out">
      <div className="flex justify-between items-center px-6 py-3.5 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-text/50">
        <div className="flex items-center gap-4 min-w-0">
          <ModelSelector />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <UpdateChecker />
          <span className="text-text/25" aria-hidden>
            ·
          </span>
          <span className="text-text/40">{t("sidebar.build")}</span>
          {/* eslint-disable-next-line i18next/no-literal-string */}
          <span className="text-live/80 tabular-nums">v{version}</span>
        </div>
      </div>
    </div>
  );
};

export default Footer;
