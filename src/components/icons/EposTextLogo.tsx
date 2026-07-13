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
    <div
      className={`flex items-center select-none ${className || ""}`}
      style={{ width, height }}
    >
      <span
        className="text-[2.5rem] tracking-tight font-bold text-text"
        style={{ letterSpacing: "-0.02em" }}
      >
        {/* Accent letter uses the MDR phosphor `live` color so it stays visible
            against both the bone and evergreen surfaces. */}
        <span className="text-live">{appName.charAt(0)}</span>
        {appName.slice(1)}
        <span className="text-live ms-[1px]">.</span>
      </span>
    </div>
  );
};

export default EposTextLogo;
