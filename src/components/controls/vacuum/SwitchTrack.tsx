/** Visual on/off switch (no shadows: the knob contrasts by color, the track by its border) */
export function SwitchTrack({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex items-center w-12 h-6 px-1 shrink-0 rounded-full border transition-colors ${
        on ? "bg-accent-blue border-accent-blue" : "bg-bg-tertiary border-border-main"
      }`}
    >
      <span className={`w-4 h-4 rounded-full transition-transform ${on ? "translate-x-[22px] bg-white" : "bg-text-secondary"}`} />
    </span>
  );
}
