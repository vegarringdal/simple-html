import { customElement, property } from '@simple-html/core';
import { html } from 'lit-html';
import { GridInterface, Datasource } from '@simple-html/grid/src';
import { WordDatasource01, add, set } from '../data/datasources';
import { setup } from '../gridSetup/setup';

let x = setup(1, 10, 100000);

@customElement('sample-no4')
export default class extends HTMLElement {
    connector: GridInterface;
    ds: Datasource;
    @property() query: string;
    savedConfig: any;

    connectedCallback() {
        this.connector = new GridInterface(x, WordDatasource01);
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

                    <button
                        class="p-2 m-2 bg-yellow-400"
                        @click=${() => {
                            this.savedConfig = this.connector.saveSettings();
                        }}
                    >
                        save settings
                    </button>
                    <button
                        class="p-2 m-2 bg-yellow-400"
                        @click=${() => {
                            this.savedConfig && this.connector.loadSettings(this.savedConfig);
                        }}
                    >
                        load settings
                    </button>
                    <button
                        class="p-2 m-2 bg-yellow-400"
                        @click=${() => {
                            this.savedConfig && this.connector.useInitSettings();
                        }}
                    >
                        init settings
                    </button>

                    <nav-buttons
                        class="flex flex-col"
                        .btnClass=${'p-2 m-2 bg-indigo-400'}
                        .callback=${(
                            action: 'selectFirst' | 'selectPrev' | 'selectNext' | 'selectLast'
                        ) => {
                            this.ds[action]();
                        }}
                    ></nav-buttons>
                </div>
                <span>${this.query}</span>
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
