import { html } from 'lit-html';
import { customElement, property } from '@simple-html/core';

@customElement('protected-route')
export default class extends HTMLElement {
    @property() cool = 1;

    public render() {
        return html` <section><h1>Welcome to the inner circle :-)</h1></section> `;
    }
}
