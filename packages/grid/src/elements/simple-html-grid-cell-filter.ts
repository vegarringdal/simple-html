import { customElement } from '@simple-html/core';
import { GridInterface, SimpleHtmlGrid } from '..';
import { GridGroupConfig } from '../types';
import { html } from 'lit-html';
import { generateMenuWithComponentName } from './generateMenuWithComponentName';

@customElement('simple-html-grid-cell-filter')
export default class extends HTMLElement {
    connector: GridInterface;
    cellPosition: number;
    ref: SimpleHtmlGrid;
    currentHeight: number;
    group: GridGroupConfig;
    label: string;
    attribute: string;

    connectedCallback() {
        this.classList.add('simple-html-grid-cell-filter');
        const config = this.connector.config;
        this.style.height = config.cellHeight + 'px';
        this.style.width = this.group.width + 'px';
        this.style.top = this.cellPosition * config.cellHeight + 'px';
        this.attribute = this.group.rows[this.cellPosition].attribute;
        this.ref.addEventListener('column-resize', this);
        this.ref.addEventListener('reRender', this);
    }

    handleEvent(e: Event) {
        if (e.type === 'column-resize') {
            this.style.width = this.group.width + 'px';
        }
        if (e.type === 'reRender') {
            this.render();
        }
    }

    disconnectedCallback() {
        this.ref.removeEventListener('column-resize', this);
        this.ref.removeEventListener('reRender', this);
    }

    render() {
        const cell = this.group.rows[this.cellPosition];
        const connector = this.connector;
        const ref = this.ref;

        const coltype = cell.type === 'boolean' ? 'checkbox' : cell.type;

        const value = cell.filterable.currentValue || null;
        const placeholder = cell.filterable.placeholder || '';

        const filterCallback = (e: any) => {
            // if boolean column we to to overide how it behaves
            if (cell.type === 'boolean') {
                const t: any = e.target;
                switch (t.state) {
                    case 0:
                        t.state = 2;
                        t.style.opacity = '1';
                        t.checked = true;
                        t.indeterminate = false;
                        break;
                    case 2:
                        t.state = 3;
                        t.style.opacity = '1';
                        t.indeterminate = false;
                        break;
                    default:
                        t.checked = false;
                        t.state = 0;
                        t.style.opacity = '0.3';
                        t.indeterminate = true;
                }
            }
            this.connector.gridCallbacks.beforeFilterCallbackFn &&
                this.connector.gridCallbacks.beforeFilterCallbackFn(e, cell, this.connector);
            if (cell.filterable.auto !== false) {
                this.connector.filterCallback(e, cell);
            }
        };

        const enterKeyDown = (e: KeyboardEvent) => {
            const keycode = e.keyCode ? e.keyCode : e.which;
            if (keycode === 13) {
                filterCallback(e as any);
            }
        };

        let boolstyle = null;
        let indeterminate = false;
        let setState = 0;
        if (cell.type === 'boolean' && cell.filterable) {
            // if no value is set then its "blank state, nothing filtered
            if (cell.filterable.currentValue !== false && cell.filterable.currentValue !== true) {
                boolstyle = 'opacity:0.3';
                indeterminate = true;
                setState = 0;
            } else {
                setState = cell.filterable.currentValue ? 2 : 3;
            }
        }

        let classname = 'simple-html-grid-row-input';
        if (cell.type === 'boolean') {
            classname = 'simple-html-grid-row-checkbox';
        }

        const change = cell.editEventType !== 'input' ? filterCallback : null;
        const input = cell.editEventType === 'input' ? filterCallback : null;

        const contentMenu = function (e: any) {
            if ((e as any).button !== 0) {
                generateMenuWithComponentName(
                    'simple-html-grid-menu-filter',
                    e,
                    connector,
                    ref,
                    cell
                );
            }
        };

        if (this.connector.gridCallbacks.renderFilterCallBackFn) {
            return this.connector.gridCallbacks.renderFilterCallBackFn(
                cell,
                this.connector,
                filterCallback
            );
        }

        if (coltype === 'empty') {
            return html`<div style=${boolstyle} class="${classname} hideme"></div>`;
        }

        if (coltype === 'date') {
            return html`
                <input
                    type=${coltype}
                    style=${boolstyle}
                    class=${classname}
                    @input=${input}
                    @keydown=${enterKeyDown}
                    @contextmenu=${(e: any) => {
                        e.preventDefault();
                        contentMenu(e);
                        return false;
                    }}
                    .valueAsDate=${value}
                    placeholder=${placeholder}
                />
            `;
        } else {
            return html`
                <input
                    type=${coltype || 'text'}
                    style=${boolstyle}
                    .indeterminate=${indeterminate}
                    .state=${setState}
                    class=${classname}
                    @change=${change}
                    @contextmenu=${(e: any) => {
                        e.preventDefault();
                        contentMenu(e);
                        return false;
                    }}
                    @input=${input}
                    @keydown=${enterKeyDown}
                    .value=${value}
                    placeholder=${placeholder}
                />
            `;
        }
    }
}
