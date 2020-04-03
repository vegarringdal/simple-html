import { customElement } from '@simple-html/core';
import { html } from 'lit-html';
import { GridInterface } from '../gridInterface';

@customElement('free-grid-header')
export default class extends HTMLElement {
    classList: any = 'free-grid-header';

    connector: GridInterface;

    connectedCallback() {
        const config = this.connector.config;
        this.style.top = config.panelHeight + 'px';
        this.style.height = config.__rowHeight * 2 + 'px';
    }

    render() {
        return html`header`;
    }
}
