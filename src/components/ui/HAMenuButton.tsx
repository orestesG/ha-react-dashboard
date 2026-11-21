import { Menu } from "lucide-react";

/**
 * Opens Home Assistant's sidebar. A custom panel has no HA toolbar, so on a phone (or with the
 * sidebar set to "always hidden") this is the only way out of it. HA's main view listens for the
 * same event its own menu button fires; it must cross the shadow roots, hence `composed`.
 */
export function HAMenuButton() {
  return (
    <button
      type="button"
      aria-label="Menú de Home Assistant"
      onClick={(e) => e.currentTarget.dispatchEvent(new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true }))}
      className="-ml-2 p-2 rounded-xl text-text-primary hover:bg-bg-tertiary transition-colors active:scale-95"
    >
      <Menu size={22} />
    </button>
  );
}
