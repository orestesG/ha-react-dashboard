import { createRoot, type Root } from 'react-dom/client';
import { createElement, StrictMode, Component, type ReactNode } from 'react';
import { useHAStore } from './store/ha-store';
import App from './App';
import type { Connection } from 'home-assistant-js-websocket';

interface HassObject {
  connection: Connection;
  themes: { darkMode: boolean };
}

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
  private _root: Root | null = null;
  private _hass: HassObject | null = null;
  private _hasMounted = false;

  connectedCallback(): void {
    // HA renders us inside ha-panel-custom's shadow DOM — styles in document.head
    // don't cross that boundary, so inject them into the containing shadow root.
    const hostRoot = this.getRootNode();
    if (hostRoot instanceof ShadowRoot && !hostRoot.getElementById('mi-dash-styles')) {
      const style = document.createElement('style');
      style.id = 'mi-dash-styles';
      style.textContent = (window as unknown as Record<string, string>).__dashCss ?? '';
      hostRoot.appendChild(style);
    }

    this._root = createRoot(this);
    this._root.render(
      createElement(StrictMode, null,
        createElement(PanelErrorBoundary, null,
          createElement(App, { panelMode: true })
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
