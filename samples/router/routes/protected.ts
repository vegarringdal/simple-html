import { html } from 'lit-html';
import { customElement, property } from '@simple-html/core';
import { isAuthenticted } from './login';
import { gotoURL } from '@simple-html/router';

@customElement('protected-route')
export default class extends HTMLElement {
    @property() cool = 1;

    connectedCallback() {
        if (!isAuthenticted()) {
            gotoURL('#login');
        }
    }

    public render() {
        return html` <section><h1>Welcome to the inner circle :-)</h1></section> `;
    }
}
