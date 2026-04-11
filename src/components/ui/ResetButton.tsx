import React from "react";
import ResetIcon from "../icons/ResetIcon";

interface ResetButtonProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  children?: React.ReactNode;
}

export const ResetButton: React.FC<ResetButtonProps> = React.memo(
  ({ onClick, disabled = false, className = "", ariaLabel, children }) => (
    <button
      type="button"
      aria-label={ariaLabel}
      className={`p-1.5 rounded-lg border border-transparent transition-all duration-200 ease-out ${
        disabled
          ? "opacity-50 cursor-not-allowed text-mid-gray"
          : "hover:bg-background-ui active:bg-primary/10 hover:cursor-pointer hover:border-primary/20 text-text/70 hover:text-primary shadow-sm"
      } ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children ?? <ResetIcon />}
    </button>
  ),
);
