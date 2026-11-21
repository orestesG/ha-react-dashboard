import './index.css';
import { createElement } from 'react';
import App from './App';
import { definePanel } from './panel-element';

definePanel('mi-dashboard', ({ showMenuButton }) => createElement(App, { panelMode: true, showMenuButton }));
