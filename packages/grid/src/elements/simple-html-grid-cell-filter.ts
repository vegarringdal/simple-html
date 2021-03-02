import { GridInterface, SimpleHtmlGrid } from '..';
import { GridGroupConfig } from '../types';
import { generateMenuWithComponentName } from './generateMenuWithComponentName';
import { defineElement } from './defineElement';

export class SimpleHtmlGridCellFilter extends HTMLElement {
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
        this.updateGui();
    }

    handleEvent(e: Event) {
        if (e.type === 'column-resize') {
            this.style.width = this.group.width + 'px';
        }
    }

    disconnectedCallback() {
        this.ref.removeEventListener('column-resize', this);
    }

    updateGui() {
        const cell = this.group.rows[this.cellPosition];
        const connector = this.connector;
        const ref = this.ref;
        const coltype = cell.type === 'boolean' ? 'checkbox' : cell.type;
        let value = cell.filterable.currentValue || null;
        const placeholder = cell.filterable.placeholder || '';
        const config = this.connector.config;

        // misc callbacks/listeners

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
                e.target.value = t.indeterminate ? null : t.checked;
            }

            if (cell.filterable.auto !== false) {
                this.connector.filterCallback(e.target.value, cell);
            }
        };

        const enterKeyDown = (e: KeyboardEvent) => {
            const keycode = e.keyCode ? e.keyCode : e.which;
            if (keycode === 13) {
                filterCallback(e as any);
            }
        };

        const change = cell.editEventType !== 'input' ? filterCallback : null;
        const input = cell.editEventType === 'input' ? filterCallback : null;

        const contentMenu = (e: any) => {
            if ((e as any).button !== 0) {
                generateMenuWithComponentName(
                    'simple-html-grid-menu-filter',
                    e,
                    connector,
                    ref,
                    () => this.group.rows[this.cellPosition] || null
                );
            }
        };

        // checkbox variables

        let boolstyle = null;
        let indeterminate = false;
        let setState = 0;
        if (cell.type === 'boolean' && cell.filterable) {
            // if no value is set then its "blank state, nothing filtered
            if (cell.filterable.currentValue !== false && cell.filterable.currentValue !== true) {
                boolstyle = true;
                indeterminate = true;
                setState = 0;
            } else {
                setState = cell.filterable.currentValue ? 2 : 3;
            }
        }

        // dynamic styles

        let classname = 'simple-html-grid-row-input';
        if (cell.type === 'boolean') {
            classname = 'simple-html-grid-row-checkbox';
        }
        this.style.height = config.cellHeight + 'px';
        this.style.width = this.group.width + 'px';
        this.style.top = this.cellPosition * config.cellHeight + 'px';
        this.attribute = this.group.rows[this.cellPosition].attribute;

        // create element or reuse if we allready have it
        
        let inputEl: HTMLInputElement;
        if (this.children.length) {
            inputEl = this.children[0] as HTMLInputElement;
        } else {
            inputEl = document.createElement('input');
        }

        inputEl.type = coltype;
        if (coltype !== 'text' && coltype !== 'checkbox') {
            inputEl.type = 'text';
        }

        inputEl.placeholder = placeholder;
        if (coltype === 'date') {
            inputEl.placeholder = this.connector.dateFormater.getPlaceHolderDate();
        }

        // add classes and state if checkbox
        
        inputEl.classList.add(classname);
        (inputEl as any).state = setState;
        inputEl.indeterminate = indeterminate;
        if (boolstyle) {
            // so it looks a little faded when indeterminate state
            inputEl.style.opacity = '0.3';
        }

        // add misc listeners
        
        inputEl.onchange = change;
        inputEl.oncontextmenu = (e: any) => {
            e.preventDefault();
            contentMenu(e);
            return false;
        };
        inputEl.oninput = input;
        inputEl.onkeydown = enterKeyDown;

        // set value based on type and prev value

        if (inputEl.value !== (value || '')) {
            switch (coltype) {
                case 'checkbox':
                    if (inputEl.checked !== value) {
                        inputEl.checked = value as any;
                    }
                    break;
                case 'number':
                    if (value === 'null') {
                        inputEl.value === 'null';
                    } else {
                        if (cell.filterable.currentValue === 0) {
                            inputEl.value === '0';
                        } else {
                            inputEl.value = this.connector.numberFormater.fromNumber(value) as any;
                        }
                    }

                    break;
                case 'date':
                    if (value === 'null') {
                        inputEl.value = 'null';
                    } else {
                        inputEl.value = this.connector.dateFormater.fromDate(value as any);
                    }

                    break;
                default:
                    inputEl.value = value as any;
            }
        }

        if (!this.children.length) {
            this.appendChild(inputEl);
        }
    }
}
defineElement(SimpleHtmlGridCellFilter, 'simple-html-grid-cell-filter');
