import { customElement } from '@simple-html/core';

// hack to get it to update
@customElement('simple-html-grid-input', { extends: 'input' })
export default class extends HTMLInputElement {
    static get observedAttributes() {
        return ['triggerme'];
    }

    attributeChangedCallback() {
        // mini hack...
        setTimeout(() => {
            this.value = this.getAttribute('setvalue');
        }, 10);
    }
}
