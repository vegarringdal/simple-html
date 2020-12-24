import { html } from 'lit-html';
import { customElement } from '@simple-html/core';
import { navs, routerConfig } from './routerConfig';
import { connectHashChanges, routeMatchAsync } from '@simple-html/router';

const childRoute = routerConfig.child.children;

@customElement('childrouter-route')
export default class extends HTMLElement {
    connectedCallback() {
        connectHashChanges(this, this.render);
    }

    public render() {
        return html`
            <ul class="ani flex bg-indigo-500 p-6">
                ${navs('sub').map((route) => {
                    if (route.isNav) {
                        return html`
                            <li class="mr-6">
                                <a class="text-green-200 hover:text-white" href="${route.href}"
                                    >${route.title}</a
                                >
                            </li>
                        `;
                    } else {
                        return '';
                    }
                })}
            </ul>

            ${routeMatchAsync(
                childRoute.subHome.path,
                () => import('./home'),
                html` <home-route></home-route> `
            )}
            ${routeMatchAsync(
                childRoute.subSettings.path,
                () => import('./settings'),
                html` <settings-route></settings-route> `
            )}
            ${routeMatchAsync(
                childRoute.protected.path,
                () => import('./protected'),
                html` <protected-route></protected-route> `
            )}
        `;
    }
}
