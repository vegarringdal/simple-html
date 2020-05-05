import { customElement } from '@simple-html/core';

/**
 * this will handle usage as normal datepicker when used with input
 * do we also want to add as normal htmlElement too ?
 */
@customElement('simple-html-date-input', { extends: 'input' })
export class SimpleHtmlDateExtended extends HTMLInputElement {
    connectedCallback() {
        if (this.isConnected) {
            if (this.getAttribute('type') !== 'text') {
                this.setAttribute('type', 'text');
            }
        }
        this.value = 'test';
    }

    render() {
        /**nothing */
    }
}
