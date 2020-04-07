import { html } from 'lit-html';
import { customElement } from '@simple-html/core';

@customElement('login-route')
export default class extends HTMLElement {
    public click() {}

    public render() {
        return html`
            <section>
                <h1>Login</h1>
                <button
                    class="m-3 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                    @click=${this.click}
                >
                    toggle login
                </button>
            </section>
        `;
    }
}
