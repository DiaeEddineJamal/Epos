import React from "react";

type ModelStatus =
  | "ready"
  | "loading"
  | "downloading"
  | "verifying"
  | "extracting"
  | "error"
  | "unloaded"
  | "none";

interface ModelStatusButtonProps {
  status: ModelStatus;
  displayText: string;
  isDropdownOpen: boolean;
  onClick: () => void;
  className?: string;
}

const ModelStatusButton: React.FC<ModelStatusButtonProps> = ({
  status,
  displayText,
  isDropdownOpen,
  onClick,
  className = "",
}) => {
  const getStatusColor = (status: ModelStatus): string => {
    switch (status) {
      case "ready":
        return "bg-emerald-600 shadow-sm";
      case "loading":
        return "bg-primary animate-pulse shadow-sm";
      case "downloading":
        return "bg-primary animate-pulse shadow-sm";
      case "verifying":
        return "bg-primary/50 animate-pulse shadow-sm";
      case "extracting":
        return "bg-primary/50 animate-pulse shadow-sm";
      case "error":
        return "bg-red-600 shadow-sm";
      case "unloaded":
        return "bg-mid-gray/40";
      case "none":
        return "bg-red-600 shadow-sm";
      default:
        return "bg-mid-gray/40";
    }
  };

  return (
    <button
      onClick={onClick}
      className={`group flex items-center gap-2.5 hover:text-text transition-all duration-200 ease-out ${className}`}
      title={`Model status: ${displayText}`}
    >
      <div className={`w-2.5 h-2.5 rounded-full ring-2 ring-white ${getStatusColor(status)} transition-all duration-300 group-hover:scale-110`} />
      <span className="max-w-[140px] truncate font-medium tracking-tight text-text/70 group-hover:text-primary transition-colors">{displayText}</span>
      <svg
        className={`w-3.5 h-3.5 text-text/50 group-hover:text-primary transition-all duration-300 ${isDropdownOpen ? "rotate-180 text-primary" : ""}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </button>
  );
};

export default ModelStatusButton;
