import { customElement } from '@simple-html/core';
import { html } from 'lit-html';

@customElement('sample-no2')
export default class extends HTMLElement {
    render() {
        return html` sample02 `;
    }
}
