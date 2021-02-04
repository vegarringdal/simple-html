import { html } from 'lit-html';
import { customElement } from '@simple-html/core';
import { gotoURL } from '@simple-html/router';

let loggedin = false;
export function isAuthenticted() {
    return loggedin;
}

export function logout() {
    loggedin = false;
    gotoURL(''); // goto home is a good place
}

@customElement('login-route')
export default class extends HTMLElement {
    public click() {
        loggedin = loggedin ? false : true;
        gotoURL('#child/protected'); //or somewhere else..
    }

    public render() {
        return html`
            <section>
                <h1>Auth component</h1>
                <button
                    class="m-3 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                    @click=${this.click}
                >
                    ${isAuthenticted() ? 'logout' : 'login'}
                </button>
            </section>
        `;
    }
}
