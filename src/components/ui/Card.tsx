import type { ReactNode } from "react";

interface CardProps {
  header?: string;
  headerIcon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Card({ header, headerIcon, children, className = "" }: CardProps) {
  return (
    <div className={`bg-bg-secondary rounded-2xl p-5 border border-border-main ${className}`}>
      {header && (
        <div className="flex items-center gap-2 mb-4">
          {headerIcon && <span className="text-text-secondary">{headerIcon}</span>}
          <h3 className="text-text-primary font-medium text-sm">{header}</h3>
        </div>
      )}
      {children}
    </div>
  );
}
