import React from "react";
import { useTranslation } from "react-i18next";

interface OnboardingShellProps {
  /** 1-based step index. */
  step: number;
  totalSteps: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

/**
 * Institutional file-drawer framing for the induction (onboarding) flow —
 * a clinical masthead with a designation number, clearance step meter, and
 * the Lumon corridor grid, matching the department-file aesthetic of the app
 * shell and the MDR transition.
 */
export const OnboardingShell: React.FC<OnboardingShellProps> = ({
  step,
  totalSteps,
  title,
  subtitle,
  children,
}) => {
  const { t } = useTranslation();
  const designation = String(step).padStart(2, "0");

  return (
    <div className="epos-induct lumon-grid">
      <div className="epos-induct-masthead scanlines">
        <div className="max-w-3xl mx-auto w-full flex flex-col gap-3">
          <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.28em] text-text/40">
            <span
              aria-hidden
              className="phosphor-lamp block h-1.5 w-1.5 rounded-[1px]"
            />
            <span>{t("onboarding.induction")}</span>
            <span className="text-live tabular-nums tracking-widest">
              {designation}
            </span>
            <span className="flex-1 h-px bg-hairline" aria-hidden />
            <span>
              {t("onboarding.stepIndicator", {
                current: step,
                total: totalSteps,
              })}
            </span>
          </div>

          <h1 className="text-[1.5rem] leading-none font-medium uppercase tracking-[0.2em] text-text">
            {title}
          </h1>

          {subtitle && (
            <p className="text-[14px] text-text/55 max-w-xl leading-relaxed">
              {subtitle}
            </p>
          )}

          {/* Clearance step meter */}
          <div className="flex items-center gap-1.5 pt-1" aria-hidden>
            {Array.from({ length: totalSteps }).map((_, i) => (
              <span
                key={i}
                className={`h-[3px] w-9 rounded-[1px] transition-colors duration-500 ease-lumon ${
                  i < step ? "bg-live" : "bg-hairline"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="epos-induct-body">
        <div className="epos-induct-inner animate-reveal">{children}</div>
      </div>
    </div>
  );
};

export default OnboardingShell;
