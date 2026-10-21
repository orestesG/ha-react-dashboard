import type { ReactNode } from "react";

export interface ChipOption<V extends string | number> {
  value: V;
  label: string;
}

interface ChipGroupProps<V extends string | number> {
  options: ChipOption<V>[];
  /** undefined selects the "default" chip when one is provided */
  value: V | undefined;
  onChange: (value: V | undefined) => void;
  /** Optional leading chip that maps to `undefined` (e.g. "Por habitación") */
  defaultLabel?: string;
  size?: "sm" | "md";
  disabled?: boolean;
}

// Same scale as Button sm/md — both keep the 44px touch target
const sizeStyles = {
  sm: "min-h-11 px-3 text-xs rounded-lg",
  md: "min-h-11 px-4 text-sm rounded-xl",
};

export function ChipGroup<V extends string | number>({
  options,
  value,
  onChange,
  defaultLabel,
  size = "sm",
  disabled = false,
}: ChipGroupProps<V>) {
  const chip = (key: string, label: string, active: boolean, onClick: () => void) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`${sizeStyles[size]} font-medium border border-transparent transition focus-visible:outline-none focus-visible:border-accent-blue enabled:active:scale-95 disabled:opacity-40 ${
        active
          ? "bg-accent-blue/20 text-accent-blue"
          : "bg-bg-tertiary text-text-secondary enabled:hover:text-text-primary"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-wrap gap-2">
      {defaultLabel !== undefined && chip("__default", defaultLabel, value === undefined, () => onChange(undefined))}
      {options.map((o) => chip(String(o.value), o.label, o.value === value, () => onChange(o.value)))}
    </div>
  );
}

export function ChipField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-text-secondary mb-1">{label}</p>
      {children}
    </div>
  );
}
