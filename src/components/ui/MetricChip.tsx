import type { ReactNode } from "react";

interface MetricChipProps {
  icon: ReactNode;
  value: string | number;
  unit?: string;
  color?: "green" | "yellow" | "orange" | "red" | "blue";
}

const chipColors = {
  green: "bg-accent-green/15 text-accent-green",
  yellow: "bg-accent-yellow/15 text-accent-yellow",
  orange: "bg-accent-orange/15 text-accent-orange",
  red: "bg-accent-red/15 text-accent-red",
  blue: "bg-accent-blue/15 text-accent-blue",
};

export function MetricChip({ icon, value, unit, color = "blue" }: MetricChipProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${chipColors[color]}`}>
      <span className="shrink-0">{icon}</span>
      <span>{value}</span>
      {unit && <span className="opacity-70">{unit}</span>}
    </span>
  );
}
