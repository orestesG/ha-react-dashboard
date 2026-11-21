// Entry of the "Plano 3D" HA panel (dist/plano.js). It is a separate bundle so three.js, the
// textures and the renders never load with the main dashboard.
import './index.css';
import { createElement } from 'react';
import PlanoApp from './PlanoApp';
import { definePanel } from './panel-element';

definePanel('mi-plano', () => createElement(PlanoApp, { panelMode: true }));
