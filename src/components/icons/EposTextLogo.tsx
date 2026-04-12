import React from "react";
import { useTranslation } from "react-i18next";

const EposTextLogo = ({
  width,
  height,
  className,
}: {
  width?: number | string;
  height?: number | string;
  className?: string;
}) => {
  const { t } = useTranslation();
  const appName = t("branding.appName", { defaultValue: "Epos" });

  return (
    <div className={`flex items-center justify-center select-none ${className || ''}`} style={{ width, height }}>
      <span className="font-serif text-[2.5rem] tracking-tight font-bold text-text" style={{ letterSpacing: "-0.02em" }}>
        <span className="text-accent-blue">
          {appName.charAt(0)}
        </span>
        {appName.slice(1)}
        <span className="text-primary italic ml-[1px]">.</span>
      </span>
    </div>
  );
};

export default EposTextLogo;
