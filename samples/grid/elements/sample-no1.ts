import { customElement, property } from '@simple-html/core';
import { html } from 'lit-html';
import { GridInterface, Datasource } from '@simple-html/grid';
import { setup } from '../gridSetup/setup';
import { WordDatasource01, set, add } from '../data/datasources';

const x = setup(1, 300, 300);

@customElement('sample-no1')
export default class extends HTMLElement {
    connector: GridInterface;
    ds: Datasource;
    @property() query: string;

    connectedCallback() {
        this.connector = new GridInterface(x, WordDatasource01);
        this.connector.reloadDatasource();
        this.connector.addEventListener(this);
        this.ds = this.connector.getDatasource();
    }

    handleEvent(event: any) {
        console.log(event);
        return true;
    }

    render() {
        return html`
            <style>
                .simple-html-grid {
                    --simple-html-grid-main-bg-color: #374151 !important;
                    --simple-html-grid-sec-bg-color: #4b5563 !important;
                    --simple-html-grid-alt-bg-color: #4b5563 !important;
                    --simple-html-grid-main-bg-border: #374151 !important;
                    --simple-html-grid-sec-bg-border: #374151 !important;
                    --simple-html-grid-main-bg-selected: #1f2937 !important;
                    --simple-html-grid-main-font-color: #f9f7f7 !important;
                    --simple-html-grid-sec-font-color: #979494 !important;
                    --simple-html-grid-dropzone-color: #979494 !important;
                    --simple-html-grid-grouping-border: #374151 !important;
                    --simple-html-grid-boxshadow: #4b5563 !important;
                    --simple-html-grid-main-hr-border: #4b5563 !important;
                }
            </style>

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
                <span>${this.query}</span>
                <simple-html-grid
                    style="width:100%"
                    class="simple-html-grid w-full flex-grow testDark"
                    .interface=${this.connector}
                >
                </simple-html-grid>
            </div>
        `;
    }
}
