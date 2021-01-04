import { customElement } from '@simple-html/core';
import { html } from 'lit-html';
import { viewState } from '../state/viewState';
import { formState } from '../state/formState';
import { country_list } from './listofcountries';

@customElement('sample-no1')
export default class extends HTMLElement {
    render() {
        // get our state containers
        const view = viewState.getValue();
        const [form, setForm] = formState.getState();

        return html`
            <span class="text-xl">${view.toUpperCase()}</span>

            <p class="mt-2 mb-2">Simple state management that works with hmr</p>
            <p class="mt-2 mb-2">Edit and go to sample 2</p>

            <div class="m-auto flex flex-col">
                <label>
                    Find Country 1:
                    <input
                        class="p-2 m-5"
                        is="simple-html-autocomplete"
                        .value=${form.defaultVal1 || ''}
                        placeholder="type in country"
                        listClasses="p-1 bg-gray-100"
                        .callback=${(input: string, regex: RegExp) => {
                            return country_list
                                .filter((val, i) => {
                                    if (!input) {
                                        if (i < 10) {
                                            return true;
                                        }
                                        return false;
                                    }
                                    return regex.test(val);
                                })
                                .map((e) => {
                                    return html`
                                        <div
                                            class="hover:bg-gray-200 focus:bg-gray-200""
                                            @mousedown=${() => {
                                                setForm({ defaultVal1: e });
                                                this.render();
                                            }}
                                            @highlight=${(e: any) => {
                                                e.target.classList.add('bg-gray-200');
                                            }}
                                            @dehighlight=${(e: any) => {
                                                e.target.classList.remove('bg-gray-200');
                                            }}
                                        >
                                            <b>${input.length ? e.slice(0, input.length) : ''}</b
                                            ><span>${input.length ? e.split(regex)[1] : e}</span>
                                        </div>
                                    `;
                                });
                        }}
                    />
                </label>
                <label>
                    Find Country 2:
                    <input
                        class="p-2 m-5"
                        is="simple-html-autocomplete"
                        .value=${form.defaultVal2 || ''}
                        placeholder="type in country"
                        listClasses="p-1 bg-gray-100"
                        .callback=${(input: string, regex: RegExp) => {
                            return country_list
                                .filter((val) => {
                                    return regex.test(val);
                                })
                                .map((e) => {
                                    return html`
                                        <div
                                            class="hover:bg-gray-200"
                                            @mousedown=${() => {
                                                setForm({ defaultVal2: e });
                                                this.render();
                                            }}
                                        >
                                            <b>${e.slice(0, input.length)}</b
                                            ><span>${e.split(regex)[1]}</span>
                                        </div>
                                    `;
                                });
                        }}
                    />
                </label>
            </div>
        `;
    }
}
