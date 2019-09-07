import { html } from 'lit-html';

import { customElement } from '@simple-html/core';
import { href } from '@simple-html/router';

@customElement('footer-section')
export default class extends HTMLElement {
    public render() {
        return html`
            <footer>
                <div class="container">
                    <a href=${href('Home')} class="logo-font">conduit</a>

                    <span class="attribution">
                        An interactive learning project from
                        <a href="https://thinkster.io">Thinkster</a>. Code &amp; design licensed
                        under MIT.
                    </span>
                </div>
            </footer>
        `;
    }
}
