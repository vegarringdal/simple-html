import './hmr';
import { html } from 'lit-html';
import { customElement } from '@simple-html/core';

@customElement('app-component')
export default class extends HTMLElement {
    public render() {
        return html` hello world `;
    }
}
