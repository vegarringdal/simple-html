import { html } from 'lit-html';
import { customElement } from '@simple-html/core';
import { navs } from '@simple-html/router';

@customElement('childrouter-route')
export default class extends HTMLElement {
    public render() {
        return html`
            <ul class="ani flex bg-indigo-500 p-6">
                ${navs('sub').map((route) => {
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
            </ul>
            <free-router name="sub"></free-router>
        `;
    }
}
