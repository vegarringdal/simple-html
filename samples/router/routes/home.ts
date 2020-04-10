import { html } from 'lit-html';
import { customElement } from '@simple-html/core';

@customElement('home-route')
export default class extends HTMLElement {
    public render() {
        return html` <section><h1>home</h1></section> `;
    }
}
