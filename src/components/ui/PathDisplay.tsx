import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";

interface PathDisplayProps {
  path: string;
  onOpen: () => void;
  disabled?: boolean;
}

export const PathDisplay: React.FC<PathDisplayProps> = ({
  path,
  onOpen,
  disabled = false,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2 px-1 py-1">
      <div className="flex-1 min-w-0 px-4 py-2.5 bg-white border border-primary/10 rounded-xl text-[12px] font-mono break-all select-text cursor-text text-text/70 transition-all hover:bg-background-ui hover:text-text shadow-sm">
        {path}
      </div>
      <Button
        onClick={onOpen}
        variant="secondary"
        size="sm"
        disabled={disabled}
        className="px-4 py-2 shrink-0 h-full"
      >
        {t("common.open")}
      </Button>
    </div>
  );
};
