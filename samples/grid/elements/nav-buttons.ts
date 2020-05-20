import { customElement } from '@simple-html/core';
import { html } from 'lit-html';

@customElement('nav-buttons')
export default class extends HTMLElement {
    callback: (action: 'selectFirst' | 'selectPrev' | 'selectNext' | 'selectLast') => void;
    btnClass: string;

    render() {
        return html` <button
                class=${this.btnClass}
                @click=${() => {
                    this.callback('selectFirst');
                }}
            >
                first
            </button>
            <button
                class=${this.btnClass}
                @click=${() => {
                    this.callback('selectPrev');
                }}
            >
                prev
            </button>
            <button
                class=${this.btnClass}
                @click=${() => {
                    this.callback('selectNext');
                }}
            >
                next
            </button>
            <button
                class=${this.btnClass}
                @click=${() => {
                    this.callback('selectLast');
                }}
            >
                last
            </button>`;
    }
}
