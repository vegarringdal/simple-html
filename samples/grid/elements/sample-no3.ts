import { customElement } from '@simple-html/core';
import { html } from 'lit-html';
import { GridInterface, Datasource } from '@simple-html/grid';
import { setup } from '../gridSetup/setup';
import { WordDatasource03, set, add } from '../data/datasources';

@customElement('sample-no3')
export default class extends HTMLElement {
    connector1: GridInterface;
    connector2: GridInterface;
    ds1: Datasource;
    ds2: Datasource;
    connectedCallback() {
        this.connector1 = new GridInterface(setup(1, 10), WordDatasource03);
        this.connector1.reloadDatasource();
        this.connector2 = new GridInterface(setup(1, 10), WordDatasource03);
        this.connector2.reloadDatasource();
        this.ds1 = this.connector1.getDatasource();
        this.ds2 = this.connector2.getDatasource();
    }

    render() {
        return html`
            <div class="flex flex-row flex-grow h-full">
                <div class="flex flex-row flex-grow h-full">
                    <div class="flex-grow">
                        <data-buttons
                            class="flex flex-col"
                            .btnClass=${'p-2 m-2 bg-green-400'}
                            .type=${'add'}
                            .callback=${(x: number) => {
                                add(this.ds1, x);
                            }}
                        ></data-buttons>

                        <data-buttons
                            class="flex flex-col"
                            .btnClass=${'p-2 m-2 bg-yellow-400'}
                            .type=${'set'}
                            .callback=${(x: number) => {
                                set(this.ds1, x);
                            }}
                        ></data-buttons>

                        <nav-buttons
                            class="flex flex-col"
                            .btnClass=${'p-2 m-2 bg-indigo-400'}
                            .callback=${(action: 'first' | 'next' | 'prev' | 'last') => {
                                this.ds1[action]();
                            }}
                        ></nav-buttons>
                    </div>

                    <simple-html-grid
                        style="width:100%"
                        class="simple-html-grid w-full flex-grow"
                        .interface=${this.connector1}
                    >
                    </simple-html-grid>
                </div>

                <div class="flex flex-row flex-grow h-full">
                    <div class="flex-grow">
                        <data-buttons
                            class="flex flex-col"
                            .btnClass=${'p-2 m-2 bg-green-400'}
                            .type=${'add'}
                            .callback=${(x: number) => {
                                add(this.ds2, x);
                            }}
                        ></data-buttons>

                        <data-buttons
                            class="flex flex-col"
                            .btnClass=${'p-2 m-2 bg-yellow-400'}
                            .type=${'set'}
                            .callback=${(x: number) => {
                                set(this.ds2, x);
                            }}
                        ></data-buttons>

                        <nav-buttons
                            class="flex flex-col"
                            .btnClass=${'p-2 m-2 bg-indigo-400'}
                            .callback=${(
                                action: 'selectFirst' | 'selectPrev' | 'selectNext' | 'selectLast'
                            ) => {
                                this.ds2[action]();
                            }}
                        ></nav-buttons>
                    </div>

                    <simple-html-grid
                        style="width:100%"
                        class="simple-html-grid w-full flex-grow"
                        .interface=${this.connector2}
                    >
                    </simple-html-grid>
                </div>
            </div>
        `;
    }
}
