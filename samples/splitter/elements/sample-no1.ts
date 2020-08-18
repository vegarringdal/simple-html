import { customElement } from '@simple-html/core';
import { html } from 'lit-html';

@customElement('sample-no1')
export default class extends HTMLElement {
    render() {
        return html`<!-- html-->

            <simple-split-horz .stateName=${'101'} class="bg-indigo-500">
                <simple-split-part class="bg-indigo-200 block flex">
                    <div class="bg-yellow-200 flex-1"></div>
                    <div class="bg-yellow-300 flex-1"></div>
                    <div class="bg-yellow-400 flex-1"></div>
                </simple-split-part>

                <simple-split-handle class="bg-indigo-300 block"></simple-split-handle>

                <simple-split-part class="bg-indigo-400 block flex flex-col">
                    <div class="bg-yellow-200 flex-1"></div>
                    <div class="bg-yellow-300 flex-1"></div>
                    <div class="bg-yellow-400 flex-1"></div>
                </simple-split-part>
            </simple-split-horz> `;
    }
}
