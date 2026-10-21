import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { useHAStore } from "../../../store/ha-store";
import { callService } from "../../../lib/ha-client";
import { CONSUMABLES, type ConsumableKey } from "../../../lib/vacuum";

interface ConsumablesPanelProps {
  slug: string;
  attributes: Record<string, unknown> | undefined;
}

// Yellow/orange are identity-only in the design system, so "getting low" uses the informational blue
function levelColors(pct: number) {
  if (pct < 10) return { text: "text-accent-red", bar: "bg-accent-red" };
  if (pct < 30) return { text: "text-accent-blue", bar: "bg-accent-blue" };
  return { text: "text-accent-green", bar: "bg-accent-green" };
}

export function ConsumablesPanel({ slug, attributes }: ConsumablesPanelProps) {
  const connection = useHAStore((s) => s.connection);
  // Resetting a counter can't be undone — first tap arms, second tap (within 3 s) confirms
  const [armed, setArmed] = useState<ConsumableKey | null>(null);
  const [failed, setFailed] = useState<ConsumableKey | null>(null);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(null), 3000);
    return () => clearTimeout(t);
  }, [armed]);

  const reset = async (key: ConsumableKey) => {
    if (armed !== key) { setArmed(key); setFailed(null); return; }
    setArmed(null);
    if (!connection) return;
    try {
      await callService(connection, "button", "press", undefined, { entity_id: `button.${slug}_reset_${key}` });
    } catch {
      setFailed(key);
    }
  };

  const rows = CONSUMABLES
    .map((c) => ({
      ...c,
      pct:   attributes?.[`${c.key}_left`] as number | undefined,
      hours: attributes?.[`${c.key}_time_left`] as number | undefined,
    }))
    .filter((c) => typeof c.pct === "number");

  if (rows.length === 0) {
    return <p className="py-5 text-center text-xs text-text-secondary">Sin datos de consumibles.</p>;
  }

  return (
    <div className="space-y-3">
      {rows.map((c) => {
        const pct = Math.max(0, Math.min(100, c.pct!));
        const colors = levelColors(pct);
        const isArmed = armed === c.key;
        return (
          <div key={c.key} className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-sm font-medium text-text-primary truncate">{c.label}</span>
                <span className={`shrink-0 font-medium ${colors.text}`}>
                  {pct}%{typeof c.hours === "number" && <span className="text-text-secondary font-normal"> · {c.hours} h</span>}
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-bg-tertiary overflow-hidden">
                <div className={`h-full rounded-full ${colors.bar}`} style={{ width: `${pct}%` }} />
              </div>
              {failed === c.key && <p className="mt-1 text-xs text-accent-red">No se pudo resetear.</p>}
            </div>
            <button
              type="button"
              onClick={() => void reset(c.key)}
              className={`h-11 shrink-0 flex items-center justify-center rounded-xl text-xs font-medium border border-transparent transition-colors active:scale-95 focus-visible:outline-none focus-visible:border-accent-blue ${
                isArmed
                  ? "px-3 bg-accent-red/20 text-accent-red"
                  : "w-11 bg-bg-tertiary text-text-secondary hover:text-text-primary"
              }`}
              aria-label={isArmed ? `Confirmar reset de ${c.label}` : `Resetear ${c.label}`}
            >
              {isArmed ? "Confirmar" : <RotateCcw size={16} />}
            </button>
          </div>
        );
      })}
    </div>
  );
}
