import type { ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  className?: string;
}

const variantStyles = {
  primary: "bg-accent-blue text-white hover:bg-accent-blue/90",
  secondary: "bg-bg-tertiary text-gray-300 hover:bg-bg-tertiary/80",
  ghost: "text-gray-400 hover:text-white hover:bg-bg-tertiary",
};

const sizeStyles = {
  sm: "px-3 py-1.5 text-xs rounded-lg",
  md: "px-4 py-2 text-sm rounded-xl",
  lg: "px-6 py-3 text-base rounded-xl",
};

export function Button({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled = false,
  className = "",
}: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        font-medium transition-all duration-150
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer active:scale-95"}
        ${className}
      `}
    >
      {children}
    </button>
  );
}
