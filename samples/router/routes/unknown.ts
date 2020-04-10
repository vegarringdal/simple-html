import { html } from 'lit-html';
import { customElement } from '@simple-html/core';

@customElement('unknown-route')
export default class extends HTMLElement {
    public render() {
        return html` <section><h1>Are you lost ?</h1></section> `;
    }
}
