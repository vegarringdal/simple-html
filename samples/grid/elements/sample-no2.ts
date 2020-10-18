import { customElement } from '@simple-html/core';
import { html } from 'lit-html';
import { GridInterface, Datasource } from '@simple-html/grid';
import { setup } from '../gridSetup/setup';
import { WordDatasource02, set, add } from '../data/datasources';

@customElement('sample-no2')
export default class extends HTMLElement {
    connector: GridInterface;
    ds: Datasource;

    connectedCallback() {
        this.connector = new GridInterface(setup(4, 20), WordDatasource02);
        this.connector.reloadDatasource();
        this.ds = this.connector.getDatasource();
    }

    render() {
        return html`
            <div class="flex flex-row flex-grow h-full">
                <div class="flex-grow">
                    <data-buttons
                        class="flex flex-col"
                        .btnClass=${'p-2 m-2 bg-green-400'}
                        .type=${'add'}
                        .callback=${(x: number) => {
                            add(this.ds, x);
                        }}
                    ></data-buttons>

                    <data-buttons
                        class="flex flex-col"
                        .btnClass=${'p-2 m-2 bg-yellow-400'}
                        .type=${'set'}
                        .callback=${(x: number) => {
                            set(this.ds, x);
                        }}
                    ></data-buttons>

                    <nav-buttons
                        class="flex flex-col"
                        .btnClass=${'p-2 m-2 bg-indigo-400'}
                        .callback=${(
                            action:
                                | 'selectFirst'
                                | 'selectPrev'
                                | 'selectNext'
                                | 'selectLast'
                                | 'addNewEmpty'
                        ) => {
                            this.ds[action]();
                        }}
                    ></nav-buttons>
                </div>

                <simple-html-grid
                    style="width:100%"
                    class="simple-html-grid w-full flex-grow"
                    .interface=${this.connector}
                >
                </simple-html-grid>
            </div>
        `;
    }
}
