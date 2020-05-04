import { html } from 'lit-html';
import { customElement } from '@simple-html/core';
import { navs, routerConfig } from './routerConfig';
import { subscribeHashEvent, unSubscribeHashEvent, gotoURL } from '@simple-html/router';
import { routeMatchAsync } from '@simple-html/router';

@customElement('app-root')
export default class extends HTMLElement {
    connectedCallback() {
        subscribeHashEvent(this, () => {
            this.render();
        });
    }
    disconnectedCallback() {
        unSubscribeHashEvent(this);
    }

    public render() {
        return html`
            <ul class="flex bg-teal-500 p-6">
                ${navs('main').map((route: any) => {
                    if (route.isNav) {
                        return html`
                            <li class="mr-6">
                                <a class="text-teal-200 hover:text-white" href="${route.href}"
                                    >${route.title}</a
                                >
                            </li>
                        `;
                    }
                    return '';
                })}

                <li style="margin-left: auto;" class="mr-6">
                    <span
                        class="text-teal-200 hover:text-white"
                        @click=${() => {
                            gotoURL('#:path', { path: 'settings' });
                        }}
                    >
                        ${this ? 'Logout' : 'Login'}
                    </span>
                </li>
            </ul>

            <!--  if you want you could show more then 1 -->
            ${routeMatchAsync(
                routerConfig.home.path,
                routerConfig.home.load,
                routerConfig.home.html
            )}
            ${routeMatchAsync(
                routerConfig.settings.path,
                routerConfig.settings.load,
                routerConfig.settings.html
            )}

            <!--  if you want you could show more then 1 -->
            ${routeMatchAsync(
                '#child/*' /**use * in the end since there will be sub modules  */,
                () => import('./routes/childrouter'),
                html` <childrouter-route></childrouter-route> `
            )}
        `;
    }
}
