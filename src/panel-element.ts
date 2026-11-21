import { createRoot, type Root } from 'react-dom/client';
import { createElement, StrictMode, Component, type ReactNode } from 'react';
import { useHAStore } from './store/ha-store';
import type { Connection } from 'home-assistant-js-websocket';

interface HassObject {
  connection: Connection;
  themes: { darkMode: boolean };
}

const STYLE_ID = 'mi-dash-styles';

/** Each bundle's CSS, keyed by panel tag (set by vite.config.ts's injectCode) */
type CssWindow = Window & { __miDashCss?: Record<string, string> };

// Prevents a single component crash from blanking the whole panel
class PanelErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return createElement('div', {
        style: { padding: '24px', fontFamily: 'sans-serif', color: '#f87171' }
      }, `Dashboard error: ${this.state.error.message}`);
    }
    return this.props.children;
  }
}

export class MiDashboardPanel extends HTMLElement {
  /** What the panel renders. Each entry point (panel-main, plano-main) sets it, so each bundle only carries its own app */
  static view: () => ReactNode = () => null;

  private _root: Root | null = null;
  private _hass: HassObject | null = null;
  private _hasMounted = false;

  connectedCallback(): void {
    // HA renders us inside ha-panel-custom's shadow DOM — styles in document.head
    // don't cross that boundary, so inject them into the containing shadow root.
    // HA reuses that shadow root when switching between our panels: swap in this panel's CSS.
    const hostRoot = this.getRootNode();
    if (hostRoot instanceof ShadowRoot) {
      let style = hostRoot.getElementById(STYLE_ID) as HTMLStyleElement | null;
      if (!style) {
        style = document.createElement('style');
        style.id = STYLE_ID;
        hostRoot.appendChild(style);
      }
      if (style.dataset.panel !== this.localName) {
        style.dataset.panel = this.localName;
        style.textContent = (window as CssWindow).__miDashCss?.[this.localName] ?? '';
      }
    }

    this._root = createRoot(this);
    this._root.render(
      createElement(StrictMode, null,
        createElement(PanelErrorBoundary, null,
          (this.constructor as typeof MiDashboardPanel).view()
        )
      )
    );
    this._hasMounted = true;
    if (this._hass) this._applyHass(this._hass);
  }

  disconnectedCallback(): void {
    this._root?.unmount();
    this._root = null;
    this._hasMounted = false;
  }

  set hass(value: HassObject) {
    this._hass = value;
    this._applyDarkMode(value.themes.darkMode);
    // Only inject the connection once; subsequent hass updates just sync dark mode
    if (!useHAStore.getState().isConnected && this._hasMounted) {
      this._applyHass(value);
    }
  }

  private _applyHass(hass: HassObject): void {
    this._applyDarkMode(hass.themes.darkMode);
    useHAStore.getState().injectConnection(hass.connection);
    // syncFromHA is triggered by App.tsx via useEffect on connection change
  }

  private _applyDarkMode(dark: boolean): void {
    document.documentElement.classList.toggle('dark', dark);
  }
}

const RELOAD_KEY = 'mi-dash-reloaded:';
const RELOAD_GUARD_MS = 30_000;

/**
 * Registers this bundle's panel. After a deploy HA restarts and the app reconnects without
 * reloading the page, so the previous build still holds the tag and can't be replaced:
 * reload once to drop it (the guard avoids a loop if the tag is still taken after reloading).
 */
export function definePanel(tag: string, view: () => ReactNode): void {
  if (!customElements.get(tag)) {
    MiDashboardPanel.view = view;
    customElements.define(tag, MiDashboardPanel);
    return;
  }
  let reloadedRecently = false;
  try {
    reloadedRecently = Date.now() - Number(sessionStorage.getItem(RELOAD_KEY + tag) ?? 0) < RELOAD_GUARD_MS;
    sessionStorage.setItem(RELOAD_KEY + tag, String(Date.now()));
  } catch { /* storage blocked: reload anyway */ }
  if (reloadedRecently) {
    console.warn(`${tag}: an older build is still registered; reload the page to update it`);
    return;
  }
  location.reload();
}
