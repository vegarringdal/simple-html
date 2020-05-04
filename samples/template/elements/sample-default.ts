import { customElement } from '@simple-html/core';
import { html } from 'lit-html';

@customElement('sample-default')
export default class extends HTMLElement {
    render() {
        return html` sample default `;
    }
}
