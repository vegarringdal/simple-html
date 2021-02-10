import { defineElement } from './defineElement';

export class SimpleHtmlGridMenuCustom extends HTMLElement {
    rows: any[];

    connectedCallback() {
        this.classList.add('simple-html-grid', 'simple-html-grid-menu');

        setTimeout(() => {
            document.addEventListener('click', this);
            document.addEventListener('contextmenu', this);
        }, 50);
        this.renderx();
    }

    disconnectedCallback() {
        document.removeEventListener('click', this);
        document.removeEventListener('contextmenu', this);
    }

    handleEvent(e: Event) {
        if (e.target !== this) {
            this.removeSelf();
        }
    }

    removeSelf() {
        document.body.removeChild(this);
    }

    renderx() {
        this.rows.forEach((row) => {
            const el = document.createElement('p');
            el.classList.add('simple-html-grid-menu-item');
            el.onclick = () => row.callback(row);
            el.appendChild(document.createTextNode(row.title));
            this.appendChild(el);
        });
    }
}

defineElement(SimpleHtmlGridMenuCustom, 'simple-html-grid-menu-custom');
