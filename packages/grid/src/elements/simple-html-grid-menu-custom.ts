import { customElement } from '@simple-html/core';

import { html } from 'lit-html';
import { log } from './log';

@customElement('simple-html-grid-menu-custom')
export default class extends HTMLElement {
    rows: any[];

    connectedCallback() {
        this.classList.add('simple-html-grid', 'simple-html-grid-menu');

        setTimeout(() => {
            document.addEventListener('click', this);
            document.addEventListener('contextmenu', this);
        }, 50);
    }

    disconnectedCallback() {
        document.removeEventListener('click', this);
        document.removeEventListener('contextmenu', this);
    }

    handleEvent(e: Event) {
        log(this, e);

        if (e.target !== this) {
            this.removeSelf();
        }
    }

    removeSelf() {
        document.body.removeChild(this);
    }

    render() {
        return this.rows.map((row) => {
            return html`
                <p class="simple-html-grid-menu-item" @click=${() => row.callback(row)}>
                    ${row.title}
                </p>
            `;
        });
    }
}
