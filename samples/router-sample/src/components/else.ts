import { html } from 'lit-html';
import { navs } from '@simple-html/router';
import { customElement } from '@simple-html/core';

@customElement('else-component')
export default class extends HTMLElement {
    routes: any[];
    router: any;

    public render() {
        return html`
            else
            <div class="nav">
                ${navs('sub').map(route => {
                    if (route.isNav) {
                        return html`
                            <a href=${route.href} class="navitem">${route.name}</a>
                        `;
                    } else {
                        return '';
                    }
                })}
            </div>
            <section>
                <free-router name="sub"></free-router>
            </section>
        `;
    }
}
