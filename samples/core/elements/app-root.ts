import { customElement } from '@simple-html/core';
import { html } from 'lit-html';
import { viewState } from '../state/viewState';
import { getElementMarkup } from './getElementMarkup';

@customElement('app-root')
export default class extends HTMLElement {
    elements = ['sample-default', 'sample-no1', 'sample-no2', 'sample-no3', 'sample-no4'];

    connectedCallback() {
        viewState.connect(this, this.render);
    }

    render() {
        const [view, setView] = viewState.get('element-default');
        return html`<section class="flex flex-row flex-grow h-full">
            <div class="bg-gray-200 flex flex-col">
                ${this.elements.map((element) => {
                    return html`<button
                        class="p-2 m-2 bg-indigo-300"
                        @click=${() => setView(element)}
                    >
                        ${element}
                    </button>`;
                })}
            </div>
            <div class="bg-gray-300 flex-grow h-full p-2">${getElementMarkup(view)}</div>
        </section>`;
    }
}
