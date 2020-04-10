import { customElement } from '@simple-html/core';
import { html } from 'lit-html';
import { connectViewState } from '../state/viewState';

@customElement('app-root')
export class AppRoot extends HTMLElement {
    connectedCallback() {
        connectViewState(this, this.render);
    }

    render() {
        return html`<section>app root</section>`;
    }
}
