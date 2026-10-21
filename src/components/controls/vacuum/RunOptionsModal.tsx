import { X } from "lucide-react";
import { DEFAULT_RUN_OPTIONS, PASSES, SUCTION, hasOverrides, type Passes, type RunOptions, type SuctionKey } from "../../../lib/vacuum";
import { ChipField, ChipGroup } from "./ChipGroup";

const SUCTION_CHIPS = SUCTION.map((o) => ({ value: o.key, label: o.label }));
const PASSES_CHIPS  = PASSES.map((n) => ({ value: n, label: n === 1 ? "1 vez" : `${n} veces` }));
const TYPE_CHIPS    = [{ value: "sweep" as const, label: "Solo aspirado" }];

interface RunOptionsModalProps {
  value: RunOptions;
  onChange: (value: RunOptions) => void;
  /** "Solo aspirado" runs through the HA script — unavailable for other robots or while it is running */
  sweepDisabled: boolean;
  sweepNote?: string;
  onClose: () => void;
}

export function RunOptionsModal({ value, onChange, sweepDisabled, sweepNote, onClose }: RunOptionsModalProps) {
  const customized = value.sweepOnly || hasOverrides(value);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="vacuum-run-options-title"
        className="w-full max-w-md max-h-[92vh] flex flex-col bg-bg-secondary border border-border-main rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 pl-5 pr-3 py-2 border-b border-border-main">
          <h2 id="vacuum-run-options-title" className="text-base font-semibold text-text-primary">Ajustes de esta limpieza</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-xl border border-transparent text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors focus-visible:outline-none focus-visible:border-accent-blue"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:var(--color-text-secondary)_transparent] px-5 py-4 space-y-4">
          <ChipField label="Tipo">
            <ChipGroup<"sweep">
              size="md"
              options={TYPE_CHIPS}
              defaultLabel="Según habitación"
              value={value.sweepOnly ? "sweep" : undefined}
              disabled={sweepDisabled}
              onChange={(v) => onChange({ ...value, sweepOnly: v === "sweep" })}
            />
            {sweepNote && <p className="mt-2 text-xs text-text-secondary">{sweepNote}</p>}
          </ChipField>
          <ChipField label="Succión">
            <ChipGroup<SuctionKey>
              size="md"
              options={SUCTION_CHIPS}
              defaultLabel="Por habitación"
              value={value.suction}
              onChange={(v) => onChange({ ...value, suction: v })}
            />
          </ChipField>
          <ChipField label="Pasadas">
            <ChipGroup<Passes>
              size="md"
              options={PASSES_CHIPS}
              defaultLabel="Por habitación"
              value={value.passes}
              onChange={(v) => onChange({ ...value, passes: v })}
            />
          </ChipField>
          <p className="text-xs text-text-secondary leading-relaxed">
            Aplica solo a la próxima limpieza manual. "Solo aspirado" restaura el modo de cada habitación cuando el robot vuelve a la base.
          </p>
        </div>

        <div className="flex items-center gap-3 px-5 py-4 border-t border-border-main">
          <button
            type="button"
            onClick={() => onChange(DEFAULT_RUN_OPTIONS)}
            disabled={!customized}
            className="h-11 px-4 rounded-xl border border-transparent bg-bg-tertiary text-text-primary text-sm font-medium transition focus-visible:outline-none focus-visible:border-accent-blue enabled:active:scale-95 disabled:opacity-40"
          >
            Restablecer
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="h-11 px-4 rounded-xl border border-transparent bg-accent-blue text-white text-sm font-medium transition hover:bg-accent-blue/90 focus-visible:outline-none focus-visible:border-white active:scale-95"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
