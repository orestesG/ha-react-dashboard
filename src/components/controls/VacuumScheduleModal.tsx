import { useMemo, useState } from "react";
import { AlertTriangle, Calendar, ChevronDown, ChevronUp, Plus, Settings2, Trash2, X } from "lucide-react";
import { PASSES, SUCTION, findSlotConflicts, type Passes, type ScheduleSlot, type SuctionKey } from "../../lib/vacuum";
import type { SyncResult } from "../../store/vacuum-store";
import { ChipField, ChipGroup } from "./vacuum/ChipGroup";
import { SwitchTrack } from "./vacuum/SwitchTrack";

const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const SUCTION_CHIPS = SUCTION.map((o) => ({ value: o.key, label: o.label }));
const PASSES_CHIPS  = PASSES.map((n) => ({ value: n, label: n === 1 ? "1 vez" : `${n} veces` }));
const TYPE_CHIPS    = [{ value: "sweep" as const, label: "Solo aspirado" }];

// Design system: focus is a border swap to accent-blue; no shadows; 44px touch targets
const focusRing = "border border-transparent focus-visible:outline-none focus-visible:border-accent-blue";

interface VacuumScheduleModalProps {
  slots: ScheduleSlot[];
  automationOn: boolean;
  onToggleAutomation: (on: boolean) => Promise<SyncResult>;
  onClose: () => void;
  onSave: (slots: ScheduleSlot[]) => Promise<SyncResult>;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function newSlot(): ScheduleSlot {
  return { id: uid(), days: [0, 1, 2, 3, 4], time: "09:00", enabled: true, sweepOnly: false };
}

function Toggle({ on, label, onClick, disabled }: { on: boolean; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`flex items-center gap-3 min-h-11 px-1 rounded-xl disabled:opacity-40 ${focusRing}`} aria-pressed={on}>
      <SwitchTrack on={on} />
      <span className={`text-sm font-medium ${on ? "text-text-primary" : "text-text-secondary"}`}>{label}</span>
    </button>
  );
}

function SlotRow({
  slot,
  conflict,
  onChange,
  onDelete,
}: {
  slot: ScheduleSlot;
  conflict: boolean;
  onChange: (patch: Partial<ScheduleSlot>) => void;
  onDelete: () => void;
}) {
  const customized = slot.suction !== undefined || slot.passes !== undefined;
  const [advOpen, setAdvOpen] = useState(customized);

  const toggleDay = (d: number) => {
    const next = slot.days.includes(d) ? slot.days.filter((x) => x !== d) : [...slot.days, d].sort();
    if (next.length > 0) onChange({ days: next });
  };

  return (
    <div className={`rounded-2xl border transition-colors ${conflict ? "border-accent-red" : "border-border-main"}`}>
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <Toggle on={slot.enabled} label={slot.enabled ? "Activado" : "Pausado"} onClick={() => onChange({ enabled: !slot.enabled })} />
          <button
            type="button"
            onClick={onDelete}
            className={`w-11 h-11 -mr-2 flex items-center justify-center rounded-xl text-text-secondary hover:text-accent-red hover:bg-accent-red/15 transition active:scale-95 ${focusRing}`}
            aria-label="Eliminar horario"
          >
            <Trash2 size={18} />
          </button>
        </div>

        {conflict && (
          <p className="flex items-center gap-2 text-xs text-accent-red">
            <AlertTriangle size={14} className="shrink-0" /> Coincide con otro horario el mismo día y hora.
          </p>
        )}

        <ChipField label="Días">
          <div className="flex gap-2">
            {DAY_LABELS.map((label, i) => {
              const active = slot.days.includes(i);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDay(i)}
                  aria-pressed={active}
                  className={`flex-1 min-w-0 h-11 rounded-xl text-sm font-medium transition select-none active:scale-95 ${focusRing} ${
                    active ? "bg-accent-blue/20 text-accent-blue" : "bg-bg-tertiary text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </ChipField>

        <div className="flex flex-wrap gap-4 items-end">
          <ChipField label="Hora">
            <input
              type="time"
              value={slot.time}
              onChange={(e) => e.target.value && onChange({ time: e.target.value })}
              className="h-11 px-3 text-base bg-bg-tertiary border border-border-main rounded-xl text-text-primary focus:outline-none focus:border-accent-blue w-32 dark:[color-scheme:dark]"
            />
          </ChipField>
          <div className="flex-1 min-w-[200px]">
            <ChipField label="Tipo de limpieza">
              <ChipGroup<"sweep">
                size="md"
                options={TYPE_CHIPS}
                defaultLabel="Según habitación"
                value={slot.sweepOnly ? "sweep" : undefined}
                onChange={(v) => onChange({ sweepOnly: v === "sweep" })}
              />
            </ChipField>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setAdvOpen((o) => !o)}
          aria-expanded={advOpen}
          className={`w-full h-11 flex items-center justify-between px-4 rounded-xl bg-bg-tertiary text-text-primary transition-colors ${focusRing}`}
        >
          <span className="flex items-center gap-2">
            <Settings2 size={16} className="text-text-secondary" />
            <span className="text-sm font-medium">Opciones avanzadas</span>
            {customized && (
              <span className="px-2 py-1 rounded-lg bg-accent-blue/15 text-accent-blue text-xs font-medium leading-none">Personalizado</span>
            )}
          </span>
          {advOpen ? <ChevronUp size={16} className="text-text-secondary" /> : <ChevronDown size={16} className="text-text-secondary" />}
        </button>

        {advOpen && (
          <div className="rounded-xl border border-border-main p-4 space-y-4">
            <ChipField label="Succión">
              <ChipGroup<SuctionKey>
                size="md"
                options={SUCTION_CHIPS}
                defaultLabel="Por habitación"
                value={slot.suction}
                onChange={(v) => onChange({ suction: v })}
              />
            </ChipField>
            <ChipField label="Pasadas">
              <ChipGroup<Passes>
                size="md"
                options={PASSES_CHIPS}
                defaultLabel="Por habitación"
                value={slot.passes}
                onChange={(v) => onChange({ passes: v })}
              />
            </ChipField>
            <p className="text-xs text-text-secondary leading-relaxed">
              "Por habitación" usa lo configurado en la pestaña Habitaciones. Un valor fijo se aplica a todas las habitaciones solo en este horario.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function VacuumScheduleModal({ slots: initial, automationOn, onToggleAutomation, onClose, onSave }: VacuumScheduleModalProps) {
  const [slots, setSlots] = useState<ScheduleSlot[]>(() => initial.map((s) => ({ ...s, days: [...s.days] })));
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const conflicts = useMemo(() => new Set(findSlotConflicts(slots)), [slots]);

  const update = (id: string, patch: Partial<ScheduleSlot>) =>
    setSlots((ss) => ss.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const remove = (id: string) => setSlots((ss) => ss.filter((s) => s.id !== id));

  const handleSave = async () => {
    setSaving(true);
    setErrors([]);
    try {
      const res = await onSave(slots);
      if (res.ok) onClose();
      else setErrors(res.errors);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async () => {
    setToggling(true);
    setErrors([]);
    try {
      const res = await onToggleAutomation(!automationOn);
      if (!res.ok) setErrors(res.errors);
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="vacuum-schedule-title"
        className="bg-bg-secondary border border-border-main rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 pl-5 pr-3 py-2 border-b border-border-main">
          <h2 id="vacuum-schedule-title" className="flex items-center gap-2 text-text-primary font-semibold text-base">
            <Calendar size={18} className="text-text-secondary" /> Horarios de limpieza
          </h2>
          <div className="flex items-center gap-2">
            <Toggle
              on={automationOn}
              label={toggling ? "…" : automationOn ? "Programación activada" : "Programación pausada"}
              onClick={() => void handleToggle()}
              disabled={toggling || saving}
            />
            <button
              onClick={onClose}
              className={`w-11 h-11 flex items-center justify-center rounded-xl text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors ${focusRing}`}
              aria-label="Cerrar"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:var(--color-text-secondary)_transparent] px-5 py-4 space-y-4">
          {!automationOn && (
            <p className="rounded-xl border border-border-main p-3 text-xs text-text-secondary leading-relaxed">
              La programación está pausada: los horarios se guardan pero no se ejecutan. Al reanudarla se sincroniza todo con Home Assistant primero.
            </p>
          )}
          {slots.length === 0 && (
            <div className="py-5 text-center space-y-1">
              <p className="text-text-primary text-sm">Sin horarios configurados.</p>
              <p className="text-text-secondary text-xs">Tocá "Agregar horario" para crear uno.</p>
            </div>
          )}
          {slots.map((slot) => (
            <SlotRow
              key={slot.id}
              slot={slot}
              conflict={conflicts.has(slot.id)}
              onChange={(patch) => update(slot.id, patch)}
              onDelete={() => remove(slot.id)}
            />
          ))}
        </div>

        {errors.length > 0 && (
          <div className="mx-5 mb-2 p-3 rounded-xl border border-accent-red text-xs space-y-1">
            <p className="flex items-center gap-2 font-medium text-accent-red"><AlertTriangle size={14} /> No se pudo sincronizar con Home Assistant</p>
            {errors.map((e, i) => <p key={i} className="break-words text-text-primary">{e}</p>)}
          </div>
        )}

        <div className="px-5 py-4 border-t border-border-main flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSlots((ss) => [...ss, newSlot()])}
            className={`h-11 flex items-center gap-2 px-4 rounded-xl bg-bg-tertiary text-text-primary text-sm font-medium transition active:scale-95 ${focusRing}`}
          >
            <Plus size={16} /> Agregar horario
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className={`h-11 px-4 rounded-xl text-text-secondary text-sm font-medium hover:text-text-primary hover:bg-bg-tertiary transition active:scale-95 ${focusRing}`}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || toggling || conflicts.size > 0}
            className="h-11 px-4 rounded-xl border border-transparent bg-accent-blue text-white text-sm font-medium hover:bg-accent-blue/90 focus-visible:outline-none focus-visible:border-white disabled:opacity-40 transition enabled:active:scale-95"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
