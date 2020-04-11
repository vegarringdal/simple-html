import { customElement } from '@simple-html/core';
import { html } from 'lit-html';

@customElement('nav-buttons')
export default class extends HTMLElement {
    callback: Function;
    btnClass: string;

    render() {
        return html` <button
                class=${this.btnClass}
                @click=${() => {
                    this.callback('first');
                }}
            >
                first
            </button>
            <button
                class=${this.btnClass}
                @click=${() => {
                    this.callback('prev');
                }}
            >
                prev
            </button>
            <button
                class=${this.btnClass}
                @click=${() => {
                    this.callback('next');
                }}
            >
                next
            </button>
            <button
                class=${this.btnClass}
                @click=${() => {
                    this.callback('last');
                }}
            >
                last
            </button>`;
    }
}
