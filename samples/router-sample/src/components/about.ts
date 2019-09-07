import { html } from 'lit-html';
import { customElement, property } from '@simple-html/core';

@customElement('about-component')
export default class extends HTMLElement {
    @property() cool = 5;

    public click() {
        this.cool++;
        this.cool++;
        this.cool++;
    }

    public render() {
        return html`
            <button @click=${this.click}>click</button>
            about: ${this.cool}
        `;
    }
}
