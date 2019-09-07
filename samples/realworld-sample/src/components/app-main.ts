import { html } from 'lit-html';
import './footer-section';
import './header-section';
import { customElement } from '@simple-html/core';

@customElement('app-main')
export default class extends HTMLElement {
    public render() {
        return html`
            <header-section></header-section>
            <free-router name="main"></free-router>
            <footer-section></footer-section>
        `;
    }
}
