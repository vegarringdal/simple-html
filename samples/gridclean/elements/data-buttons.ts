import { customElement } from '@simple-html/core';
import { html } from 'lit-html';

@customElement('data-buttons')
export default class extends HTMLElement {
    callback: (num: any) => void;
    type: string;
    btnClass: string;

    render() {
        return html` <button
                class=${this.btnClass}
                @click=${() => {
                    this.callback(0);
                }}
            >
                ${this.type} 0</button
            ><button
                class=${this.btnClass}
                @click=${() => {
                    this.callback(1);
                }}
            >
                ${this.type} 1
            </button>
            <button
                class=${this.btnClass}
                @click=${() => {
                    this.callback(10);
                }}
            >
                ${this.type} 10
            </button>
            <button
                class=${this.btnClass}
                @click=${() => {
                    this.callback(100);
                }}
            >
                ${this.type} 100
            </button>
            <button
                class=${this.btnClass}
                @click=${() => {
                    this.callback(1000);
                }}
            >
                ${this.type} 1000
            </button>`;
    }
}
