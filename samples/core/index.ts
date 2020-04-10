import './hmr';
import './index.css';

import { customElement } from '@simple-html/core';
import { html } from 'lit-html';

@customElement('app-root')
export class AppRoot extends HTMLElement {
    render() {
        html`app root`;
    }
}
