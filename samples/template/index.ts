import './hmr';
import { html } from 'lit-html';
import { customElement } from '@simple-html/core';
import './index.css';

@customElement('app-root')
export default class extends HTMLElement {
    public render() {
        return html` hello world - edit me`;
    }
}
