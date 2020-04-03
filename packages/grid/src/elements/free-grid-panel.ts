import { customElement } from '@simple-html/core';
import { GridInterface } from '../gridInterface';
import { html } from 'lit-html';

@customElement('free-grid-panel')
export default class extends HTMLElement {
    classList: any = 'free-grid-panel';
    connector: GridInterface;

    connectedCallback() {
        const config = this.connector.config;
        this.style.height = config.panelHeight + 'px';
    }

    render() {
        return html`
            panel
        `;
    }
}
