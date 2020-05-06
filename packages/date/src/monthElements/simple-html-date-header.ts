import { customElement } from '@simple-html/core';
import { html } from 'lit-html';
import { SimpleHtmlDate } from '../simple-html-date';

@customElement('simple-html-date-header')
export default class extends HTMLElement {
    ref: SimpleHtmlDate;

    render() {
        return html``;
    }
}
