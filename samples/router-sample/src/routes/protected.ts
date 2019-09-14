import { html } from 'lit-html';
import { customElement } from '@simple-html/core';

@customElement('protected-route')
export default class extends HTMLElement {
    public render() {
        return html`
            <section><h1>Welcome to the inner circle :-)</h1></section>
        `;
    }
}
