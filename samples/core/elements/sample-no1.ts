import { customElement } from '@simple-html/core';
import { html } from 'lit-html';
import { viewState } from '../state/viewState';
import { formState } from '../state/formState';

@customElement('sample-no1')
export default class extends HTMLElement {
    render() {
        // get our state containers
        const view = viewState.getStateOnly();
        const [form, setForm] = formState.getObject();

        return html`
            <span class="text-xl">${view.toUpperCase()}</span>

            <p class="mt-2 mb-2">Simple state management that works with hmr</p>
            <p class="mt-2 mb-2">Edit and go to sample 2</p>

            <div class="m-auto flex flex-col">
                <label>
                    FirstName:
                    <input
                        class="p-2 m-1"
                        .value=${form.firstName || ''}
                        @input=${(e: any) => setForm({ firstName: e.target.value })}
                    />
                </label>
                <label>
                    LastName:
                    <input
                        class="p-2 m-1"
                        .value=${form.lastName || ''}
                        @input=${(e: any) => setForm({ lastName: e.target.value })}
                    />
                </label>
            </div>
        `;
    }
}
