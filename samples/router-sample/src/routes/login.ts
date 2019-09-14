import { html } from 'lit-html';
import { customElement, instance } from '@simple-html/core';
import { AppState } from '../app-state';
import { RoutesMain, RoutesSub } from '../routerConfig';
import { href, goto } from '@simple-html/router';

@customElement('login-route')
export default class extends HTMLElement {
    public click() {
        const appState = instance(AppState);
        if (!appState.isAutenticated) {
            appState.login();
            goto(href(RoutesSub.Protected));
        } else {
            appState.logout();
            goto(href(RoutesMain.Home));
        }
    }

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
