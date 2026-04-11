import React from "react";

const EposTextLogo = ({
  width,
  height,
  className,
}: {
  width?: number | string;
  height?: number | string;
  className?: string;
}) => {
  return (
    <div className={`flex items-center justify-center select-none ${className || ''}`} style={{ width, height }}>
      <span className="font-serif text-[2.5rem] tracking-tight font-bold text-text" style={{ letterSpacing: "-0.02em" }}>
        Epos<span className="text-primary italic ml-[1px]">.</span>
      </span>
    </div>
  );
};

export default EposTextLogo;
