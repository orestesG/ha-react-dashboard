import './index.css';
import { createElement } from 'react';
import App from './App';
import { MiDashboardPanel } from './panel-element';

MiDashboardPanel.view = () => createElement(App, { panelMode: true });
customElements.define('mi-dashboard', MiDashboardPanel);
