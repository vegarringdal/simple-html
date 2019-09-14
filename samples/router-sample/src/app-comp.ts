import { html } from 'lit-html';
import { navs, href } from '@simple-html/router';
import { customElement, instance, subscribe } from '@simple-html/core';
import { AppState } from './app-state';

@customElement('app-comp')
export default class extends HTMLElement {
    private appState: AppState;

    connectedCallback() {
        this.appState = instance(AppState);
        subscribe('autentication-changed', this, this.render.bind(this));
        // if this was a component that would be removed you would need to unsubscribe too
    }

    public render() {
        return html`
            <ul class="flex bg-teal-500 p-6">
                ${navs('main').map((route) => {
                    if (route.isNav) {
                        return html`
                            <li class="mr-6">
                                <a
                                    class="text-teal-200 hover:text-white"
                                    href="${route.href}"
                                    >${route.name}</a
                                >
                            </li>
                        `;
                    } else {
                        return '';
                    }
                })}

                <li style="margin-left: auto;" class="mr-6">
                    <a
                        class="text-teal-200 hover:text-white"
                        href=${href('Login')}
                    >
                        ${this.appState.isAutenticated ? 'Logout' : 'Login'}</a
                    >
                </li>
            </ul>

            <free-router name="main"></free-router>
        `;
    }
}
