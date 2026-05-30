import { useState } from "react";
import { X, Plus, Trash2, ChevronDown, ChevronUp, Sparkles, Wind, Settings2 } from "lucide-react";
import type { ScheduleSlot } from "../../store/vacuum-store";

const DAY_LABELS  = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const SUCTION_LABELS: Record<string, string> = {
  quiet: "Silencioso", standard: "Estándar", strong: "Fuerte", turbo: "Turbo",
};
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

function DayPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-12 h-12 rounded-xl text-sm font-semibold transition-all select-none active:scale-95 ${
        active
          ? "bg-accent-blue text-white shadow-sm"
          : "bg-bg-tertiary text-text-secondary"
      }`}
    >
      {label}
    </button>
  );
}

function OptionPill({
  active, onClick, children, wide,
}: { active: boolean; onClick: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 px-4 rounded-xl text-sm font-medium capitalize transition-all active:scale-95 ${wide ? "flex-1" : ""} ${
        active
          ? "bg-accent-blue/20 text-accent-blue ring-1 ring-accent-blue/40"
          : "bg-bg-tertiary text-text-secondary"
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
    <div className={`rounded-2xl border-2 transition-colors ${
      slot.enabled ? "border-border-main bg-bg-secondary" : "border-border-main/40 bg-bg-tertiary"
    }`}>
      <div className="p-4 space-y-4">

        {/* Top bar: enable toggle + delete */}
        <div className="flex items-center justify-between">
          {/* Enable toggle */}
          <button
            type="button"
            onClick={() => onChange({ enabled: !slot.enabled })}
            className="flex items-center gap-2.5"
            aria-label={slot.enabled ? "Deshabilitar" : "Habilitar"}
          >
            <div className={`w-12 h-6 rounded-full transition-colors relative ${slot.enabled ? "bg-accent-blue" : "bg-bg-tertiary border border-border-main"}`}>
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${slot.enabled ? "translate-x-6" : "translate-x-1"}`} />
            </div>
            <span className={`text-sm font-medium ${slot.enabled ? "text-text-primary" : "text-text-secondary"}`}>
              {slot.enabled ? "Activo" : "Pausado"}
            </span>
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-text-secondary hover:text-accent-red hover:bg-accent-red/10 transition-colors active:scale-95"
            aria-label="Eliminar"
          >
            <Trash2 size={18} />
          </button>
        </div>

        {/* Day pills */}
        <div>
          <p className="text-xs text-text-secondary mb-2 uppercase tracking-wider font-medium">Días</p>
          <div className="flex gap-2">
            {DAY_LABELS.map((label, i) => (
              <DayPill key={i} label={label} active={slot.days.includes(i)} onClick={() => toggleDay(i)} />
            ))}
          </div>
        </div>

        {/* Time + Preset row */}
        <div className="flex gap-3 items-end">
          <div className="flex-shrink-0">
            <p className="text-xs text-text-secondary mb-2 uppercase tracking-wider font-medium">Hora</p>
            <input
              type="time"
              value={slot.time}
              onChange={e => onChange({ time: e.target.value })}
              className="h-12 px-3 text-base bg-bg-tertiary border border-border-main rounded-xl text-text-primary focus:outline-none focus:border-accent-blue w-32"
            />
          </div>

          <div className="flex-1">
            <p className="text-xs text-text-secondary mb-2 uppercase tracking-wider font-medium">Tipo de limpieza</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onChange({ preset: "full" })}
                className={`flex-1 h-12 flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all active:scale-95 ${
                  slot.preset === "full"
                    ? "bg-accent-blue/20 text-accent-blue ring-1 ring-accent-blue/40"
                    : "bg-bg-tertiary text-text-secondary"
                }`}
              >
                <Sparkles size={16} /> Asp+Mopa
              </button>
              <button
                type="button"
                onClick={() => onChange({ preset: "sweep" })}
                className={`flex-1 h-12 flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all active:scale-95 ${
                  slot.preset === "sweep"
                    ? "bg-accent-blue/20 text-accent-blue ring-1 ring-accent-blue/40"
                    : "bg-bg-tertiary text-text-secondary"
                }`}
              >
                <Wind size={16} /> Solo aspirado
              </button>
            </div>
          </div>
        </div>

        {/* Advanced options toggle — clearly labeled */}
        <button
          type="button"
          onClick={() => setAdvOpen(o => !o)}
          className={`w-full h-11 flex items-center justify-between px-4 rounded-xl border transition-all active:scale-[0.99] ${
            advOpen
              ? "border-accent-blue/40 bg-accent-blue/5 text-accent-blue"
              : "border-border-main bg-bg-tertiary text-text-secondary"
          }`}
        >
          <div className="flex items-center gap-2">
            <Settings2 size={16} />
            <span className="text-sm font-medium">Opciones avanzadas</span>
            {(slot.suctionOverride || slot.vacuumPasses || slot.mopPasses) && (
              <span className="px-2 py-0.5 rounded-full bg-accent-blue text-white text-[10px] font-semibold">
                personalizado
              </span>
            )}
          </div>
          {advOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {/* Advanced section */}
        {advOpen && (
          <div className="rounded-xl bg-bg-tertiary border border-border-main p-4 space-y-4">

            {/* Suction */}
            <div>
              <p className="text-sm font-medium text-text-primary mb-1">Nivel de succión</p>
              <p className="text-xs text-text-secondary mb-2.5">
                "Por defecto" usa la configuración global del preset.
              </p>
              <div className="flex gap-2 flex-wrap">
                <OptionPill active={!slot.suctionOverride} onClick={() => onChange({ suctionOverride: undefined })}>
                  Por defecto
                </OptionPill>
                {opts.map(opt => (
                  <OptionPill key={opt} active={slot.suctionOverride === opt} onClick={() => onChange({ suctionOverride: opt })}>
                    {SUCTION_LABELS[opt] ?? opt}
                  </OptionPill>
                ))}
              </div>
            </div>

            {/* Vacuum passes */}
            <div>
              <p className="text-sm font-medium text-text-primary mb-2.5">Pasadas de aspiradora</p>
              <div className="flex gap-2">
                <OptionPill active={!slot.vacuumPasses} onClick={() => onChange({ vacuumPasses: undefined })} wide>
                  Por defecto
                </OptionPill>
                {[1, 2, 3].map(n => (
                  <OptionPill key={n} active={slot.vacuumPasses === n} onClick={() => onChange({ vacuumPasses: n })} wide>
                    {n} {n === 1 ? "vez" : "veces"}
                  </OptionPill>
                ))}
              </div>
            </div>

            {/* Mop passes */}
            {slot.preset === "full" && (
              <div>
                <p className="text-sm font-medium text-text-primary mb-2.5">Pasadas de mopa</p>
                <div className="flex gap-2">
                  <OptionPill active={!slot.mopPasses} onClick={() => onChange({ mopPasses: undefined })} wide>
                    Por defecto
                  </OptionPill>
                  {[1, 2, 3].map(n => (
                    <OptionPill key={n} active={slot.mopPasses === n} onClick={() => onChange({ mopPasses: n })} wide>
                      {n} {n === 1 ? "vez" : "veces"}
                    </OptionPill>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-text-secondary/80 italic leading-relaxed">
              Nota: estas opciones aplican al lanzamiento manual desde la card.
              La ejecución automática del schedule usa el preset global.
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
        className="bg-bg-secondary border border-border-main rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border-main">
          <h2 className="text-text-primary font-semibold text-base">🗓 Horarios de limpieza</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Slot list */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {slots.length === 0 && (
            <div className="py-12 text-center space-y-2">
              <p className="text-text-secondary text-base">Sin horarios configurados.</p>
              <p className="text-text-secondary/70 text-sm">Tocá "Agregar horario" para crear uno.</p>
            </div>
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
        <div className="px-6 py-5 border-t border-border-main flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSlots(ss => [...ss, newSlot()])}
            className="h-12 flex items-center gap-2 px-5 rounded-xl bg-bg-tertiary text-text-secondary text-sm font-medium hover:text-text-primary transition-colors active:scale-95"
          >
            <Plus size={16} /> Agregar horario
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="h-12 px-5 rounded-xl bg-bg-tertiary text-text-secondary text-sm font-medium hover:text-text-primary transition-colors active:scale-95"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="h-12 px-6 rounded-xl bg-accent-blue text-white text-sm font-semibold hover:bg-accent-blue/90 disabled:opacity-50 transition-colors active:scale-95"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
