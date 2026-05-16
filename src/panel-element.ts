import { createRoot, type Root } from 'react-dom/client';
import { createElement, StrictMode } from 'react';
import { useHAStore } from './store/ha-store';
import App from './App';
import type { Connection } from 'home-assistant-js-websocket';

interface HassObject {
  connection: Connection;
  themes: { darkMode: boolean };
}

export class MiDashboardPanel extends HTMLElement {
  private _root: Root | null = null;
  private _hass: HassObject | null = null;
  private _hasMounted = false;

  connectedCallback(): void {
    this._root = createRoot(this);
    this._root.render(
      createElement(StrictMode, null, createElement(App, { panelMode: true }))
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
  }

  private _applyDarkMode(dark: boolean): void {
    document.documentElement.classList.toggle('dark', dark);
  }
}
