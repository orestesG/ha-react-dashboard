import { useState } from "react";
import { X, Plus, Trash2, ChevronDown, ChevronRight, Sparkles, Wind } from "lucide-react";
import type { ScheduleSlot } from "../../store/vacuum-store";

const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const SUCTION_OPTIONS = ["quiet", "standard", "strong", "turbo"];

interface VacuumScheduleModalProps {
  slots: ScheduleSlot[];
  suctionOptions?: string[];
  onClose: () => void;
  onSave: (slots: ScheduleSlot[]) => Promise<void>;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function newSlot(): ScheduleSlot {
  return { id: uid(), days: [0,1,2,3,4], time: "09:00", preset: "full", enabled: true };
}

function ToggleChip({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all select-none ${
        active
          ? "bg-accent-blue text-white"
          : "bg-bg-secondary text-text-secondary hover:text-text-primary"
      }`}
    >
      {children}
    </button>
  );
}

function OptionChip({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-0.5 rounded text-[10px] font-medium capitalize transition-all ${
        active
          ? "bg-accent-blue/20 text-accent-blue"
          : "bg-bg-secondary text-text-secondary hover:text-text-primary"
      }`}
    >
      {children}
    </button>
  );
}

function SlotRow({
  slot,
  allSuctionOptions,
  onChange,
  onDelete,
}: {
  slot: ScheduleSlot;
  allSuctionOptions: string[];
  onChange: (patch: Partial<ScheduleSlot>) => void;
  onDelete: () => void;
}) {
  const [advOpen, setAdvOpen] = useState(false);
  const opts = allSuctionOptions.length > 0 ? allSuctionOptions : SUCTION_OPTIONS;

  const toggleDay = (d: number) => {
    const next = slot.days.includes(d) ? slot.days.filter(x => x !== d) : [...slot.days, d];
    if (next.length > 0) onChange({ days: next });
  };

  return (
    <div className={`rounded-xl border transition-colors ${slot.enabled ? "border-border-main bg-bg-secondary" : "border-border-main/50 bg-bg-tertiary opacity-60"}`}>
      <div className="p-3 space-y-2.5">
        {/* Row: days + time + preset + toggle + delete */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Day pills */}
          <div className="flex gap-1 flex-wrap">
            {DAY_LABELS.map((label, i) => (
              <ToggleChip key={i} active={slot.days.includes(i)} onClick={() => toggleDay(i)}>
                {label}
              </ToggleChip>
            ))}
          </div>

          {/* Time */}
          <input
            type="time"
            value={slot.time}
            onChange={e => onChange({ time: e.target.value })}
            className="text-xs bg-bg-tertiary border border-border-main rounded px-1.5 py-0.5 text-text-primary focus:outline-none focus:border-accent-blue"
          />

          {/* Preset */}
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onChange({ preset: "full" })}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                slot.preset === "full" ? "bg-accent-blue/20 text-accent-blue" : "bg-bg-tertiary text-text-secondary hover:text-text-primary"
              }`}
            >
              <Sparkles size={10} /> Asp+Mopa
            </button>
            <button
              type="button"
              onClick={() => onChange({ preset: "sweep" })}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                slot.preset === "sweep" ? "bg-accent-blue/20 text-accent-blue" : "bg-bg-tertiary text-text-secondary hover:text-text-primary"
              }`}
            >
              <Wind size={10} /> Aspirado
            </button>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            {/* Enable toggle */}
            <button
              type="button"
              onClick={() => onChange({ enabled: !slot.enabled })}
              className={`w-8 h-4 rounded-full transition-colors relative ${slot.enabled ? "bg-accent-blue" : "bg-bg-tertiary border border-border-main"}`}
              aria-label={slot.enabled ? "Deshabilitar" : "Habilitar"}
            >
              <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${slot.enabled ? "translate-x-4" : "translate-x-0.5"}`} />
            </button>

            {/* Advanced toggle */}
            <button
              type="button"
              onClick={() => setAdvOpen(o => !o)}
              className="p-1 rounded text-text-secondary hover:text-text-primary transition-colors"
              aria-label="Opciones avanzadas"
            >
              {advOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </button>

            {/* Delete */}
            <button
              type="button"
              onClick={onDelete}
              className="p-1 rounded text-text-secondary hover:text-accent-red transition-colors"
              aria-label="Eliminar"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Advanced section */}
        {advOpen && (
          <div className="pt-2 border-t border-border-main space-y-2">
            <p className="text-[10px] text-text-secondary uppercase tracking-wider">Opciones avanzadas</p>

            {/* Suction */}
            <div>
              <p className="text-[10px] text-text-secondary mb-1">Succión</p>
              <div className="flex flex-wrap gap-1">
                <OptionChip active={!slot.suctionOverride} onClick={() => onChange({ suctionOverride: undefined })}>
                  (global)
                </OptionChip>
                {opts.map(opt => (
                  <OptionChip key={opt} active={slot.suctionOverride === opt} onClick={() => onChange({ suctionOverride: opt })}>
                    {opt}
                  </OptionChip>
                ))}
              </div>
            </div>

            {/* Vacuum passes */}
            <div>
              <p className="text-[10px] text-text-secondary mb-1">Pasadas aspiradora</p>
              <div className="flex gap-1">
                {[undefined, 1, 2, 3].map(n => (
                  <OptionChip
                    key={n ?? "global"}
                    active={n === undefined ? !slot.vacuumPasses : slot.vacuumPasses === n}
                    onClick={() => onChange({ vacuumPasses: n })}
                  >
                    {n === undefined ? "(global)" : n}
                  </OptionChip>
                ))}
              </div>
            </div>

            {/* Mop passes — only for full preset */}
            {slot.preset === "full" && (
              <div>
                <p className="text-[10px] text-text-secondary mb-1">Pasadas mopa</p>
                <div className="flex gap-1">
                  {[undefined, 1, 2, 3].map(n => (
                    <OptionChip
                      key={n ?? "global"}
                      active={n === undefined ? !slot.mopPasses : slot.mopPasses === n}
                      onClick={() => onChange({ mopPasses: n })}
                    >
                      {n === undefined ? "(global)" : n}
                    </OptionChip>
                  ))}
                </div>
              </div>
            )}

            <p className="text-[10px] text-text-secondary/70 italic">
              En ejecución automática se usa la configuración global del preset.
              Los overrides aplican al lanzamiento manual desde la card.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function VacuumScheduleModal({ slots: initial, suctionOptions = [], onClose, onSave }: VacuumScheduleModalProps) {
  const [slots, setSlots] = useState<ScheduleSlot[]>(() => initial.map(s => ({ ...s })));
  const [saving, setSaving] = useState(false);

  const update = (id: string, patch: Partial<ScheduleSlot>) =>
    setSlots(ss => ss.map(s => s.id === id ? { ...s, ...patch } : s));

  const remove = (id: string) => setSlots(ss => ss.filter(s => s.id !== id));

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(slots); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-bg-secondary border border-border-main rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-main">
          <h2 className="text-text-primary font-semibold text-sm">🗓 Horarios de limpieza</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary transition-colors" aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>

        {/* Slot list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {slots.length === 0 && (
            <p className="text-text-secondary text-sm text-center py-6">Sin horarios. Agregá uno con el botón de abajo.</p>
          )}
          {slots.map(slot => (
            <SlotRow
              key={slot.id}
              slot={slot}
              allSuctionOptions={suctionOptions}
              onChange={patch => update(slot.id, patch)}
              onDelete={() => remove(slot.id)}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border-main flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSlots(ss => [...ss, newSlot()])}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-bg-tertiary text-text-secondary text-xs font-medium hover:text-text-primary transition-colors"
          >
            <Plus size={13} /> Agregar horario
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-bg-tertiary text-text-secondary text-xs font-medium hover:text-text-primary transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 rounded-xl bg-accent-blue text-white text-xs font-medium hover:bg-accent-blue/90 disabled:opacity-50 transition-colors"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
