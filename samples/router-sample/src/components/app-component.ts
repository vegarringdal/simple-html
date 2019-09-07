import { html } from 'lit-html';
import { navs } from '@simple-html/router';
import { customElement } from '@simple-html/core';

@customElement('app-component')
export default class extends HTMLElement {
    public render() {
        return html`
            <div class="nav">
                ${navs('main').map(route => {
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
                <free-router name="main"></free-router>
            </section>
        `;
    }
}
