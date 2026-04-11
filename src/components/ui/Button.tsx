import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "primary"
    | "primary-soft"
    | "secondary"
    | "danger"
    | "danger-ghost"
    | "ghost";
  size?: "sm" | "md" | "lg";
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className = "",
  variant = "primary",
  size = "md",
  ...props
}) => {
  const baseClasses =
    "font-medium rounded-lg border focus:outline-none transition-all duration-200 ease-out disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2";

  const variantClasses = {
    primary:
      "text-background bg-primary border-primary hover:bg-text hover:shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-primary",
    "primary-soft":
      "text-primary bg-primary/5 border-transparent hover:bg-primary/10 focus:ring-2 focus:ring-offset-2 focus:ring-primary",
    secondary:
      "text-text bg-background-ui border-background-ui hover:bg-mid-gray/10 focus:ring-2 focus:ring-offset-2 focus:ring-secondary",
    danger:
      "text-white bg-red-600 border-red-600 hover:bg-red-700 focus:ring-2 focus:ring-offset-2 focus:ring-red-500",
    "danger-ghost":
      "text-red-600 border-transparent hover:bg-red-50 focus:ring-2 focus:ring-offset-2 focus:ring-red-500",
    ghost:
      "text-mid-gray border-transparent hover:text-text hover:bg-black/5 focus:ring-2 focus:ring-offset-2 focus:ring-mid-gray/20",
  };

  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-4 py-[5px] text-sm",
    lg: "px-4 py-2 text-base",
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
