import { customElement } from '@simple-html/core';
import { html } from 'lit-html';

// extra
import './data-buttons';
import './nav-buttons';
import { WordDatasource01, set, add } from '../data/datasources';

// add our grid
import '@simple-html/grid';
import '../../../packages/grid/src/grid.css';
import { GridInterface } from '@simple-html/grid';
import { generateGridConfig } from '../gridSetup/setup';
import { gridDarkModeStyles } from './gridTheme';

// dummy data
const x = generateGridConfig(1, 300, 300);

@customElement('app-root')
export default class extends HTMLElement {
    connector: any;
    ds: any;
    query: unknown;
    dark: boolean;
    connectedCallback() {
        this.connector = new GridInterface(x, WordDatasource01);
        this.connector.reloadDatasource();
        this.ds = this.connector.getDatasource();
    }

    render() {
        return html`<section class="flex flex-row">
            ${this.dark ? gridDarkModeStyles() : ''}
            <div class="flex flex-row">
                <div class="">
                    <button
                        class="p-2 m-2"
                        @click=${() => {
                            this.dark = this.dark ? false : true;
                            this.render();
                        }}
                    >
                        toggle theme
                    </button>
                    <data-buttons
                        class="flex flex-col mt-10"
                        .btnClass=${'p-2 m-2'}
                        .type=${'add'}
                        .callback=${(x: number) => {
                            add(this.ds, x);
                        }}
                    ></data-buttons>

                    <data-buttons
                        class="flex flex-col mt-10"
                        .btnClass=${'p-2 m-2'}
                        .type=${'set'}
                        .callback=${(x: number) => {
                            set(this.ds, x);
                        }}
                    ></data-buttons>

                    <nav-buttons
                        class="flex flex-col mt-10"
                        .btnClass=${'p-2 m-2'}
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
                    style="width:600px;height:600px"
                    class="simple-html-grid"
                    .interface=${this.connector}
                >
                </simple-html-grid>
            </div>
        </section>`;
    }
}
