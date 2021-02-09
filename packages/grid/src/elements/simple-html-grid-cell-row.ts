import { SimpleHtmlGrid, GridInterface } from '..';
import { CellConfig } from '../types';
import { defineElement } from './defineElement';
import { generateMenuWithComponentName } from './generateMenuWithComponentName';

export class SimpleHtmlGridCellRow extends HTMLElement {
    connector: GridInterface;
    cellPosition: number;
    ref: SimpleHtmlGrid;
    currentHeight: number;
    rowNo: number;
    group: number;
    cell: CellConfig;
    innerEle: HTMLInputElement;

    public connectedCallback() {
        this.classList.add('simple-html-grid-cell-row');
        const config = this.connector.config;
        this.style.display = 'block';
        this.style.height = config.cellHeight + 'px';
        this.style.width = config.groups[this.group].width + 'px';
        this.style.top = this.cellPosition * config.cellHeight + 'px';
        this.cell = config.groups[this.group].rows[this.cellPosition];
        this.innerEle = document.createElement('input');
        this.innerEle.classList.add('simple-html-grid-row-input');
        this.appendChild(this.innerEle);
        this.setSettings();
    }

    public updateWidth() {
        this.style.width = this.connector.config.groups[this.group].width + 'px';
    }

    private updateCallback(e: any) {
        const data = this.connector.displayedDataset[this.rowNo];
        const cell = this.cell;
        this.style.width = this.connector.config.groups[this.group].width + 'px';

        if (cell.readonly) {
            if (this.cell.type === 'date') {
                // date picker with alt key overides input somehow..
                e.target.valueAsDate = data[cell.attribute] || null;
            }

            return;
        }

        this.connector.gridCallbacks.beforeEditCallbackFn &&
            this.connector.gridCallbacks.beforeEditCallbackFn(
                e,
                cell,
                this.rowNo,
                data,
                this.connector
            );
        // filter out based on type so we know what type to use
        if (cell.autoUpdateData !== false) {
            switch (this.cell.type) {
                case 'boolean':
                    data[cell.attribute] = e.target.checked;
                    break;
                case 'image':
                    // rowData[col.attribute] = e.target.checked;
                    // we need this ever ?
                    break;
                case 'date':
                    data[cell.attribute] = e.target.valueAsDate;
                    break;
                case 'number':
                    data[cell.attribute] = e.target.valueAsNumber;
                    break;
                default:
                    data[cell.attribute] = e.target.value;
            }
            this.connector.publishEvent('attribute-change');
        }
        this.connector.gridCallbacks.afterEditCallbackFn &&
            this.connector.gridCallbacks.afterEditCallbackFn(
                e,
                cell,
                this.rowNo,
                data,
                this.connector
            );
    }

    setSettings() {
        const connector = this.connector;

        const ref = this.ref;
        const change =
            this.cell.editEventType !== 'input'
                ? (e: any) => {
                      this.updateCallback(e);
                  }
                : null;
        const input =
            this.cell.editEventType !== 'input'
                ? (e: any) => {
                      this.updateCallback(e);
                  }
                : null;

        const contentMenu = (e: any) => {
            if ((e as any).button !== 0) {
                generateMenuWithComponentName(
                    'simple-html-grid-menu-row',
                    e,
                    connector,
                    ref,
                    () => this.cell,
                    () => this.rowNo,
                    () => this.connector.displayedDataset[this.rowNo]
                );
            }
        };

        this.innerEle.readOnly = this.cell.readonly || connector.config.readonly;
        this.innerEle.disabled = this.cell.disabled;
        this.innerEle.onchange = change;
        this.innerEle.oninput = input;
        this.innerEle.setAttribute('type', this.cell.type || 'text');
        this.innerEle.oncontextmenu = (e: any) => {
            e.preventDefault();
            contentMenu(e);
            return false;
        };

        this.updateInput();
    }

    updateInput() {
        const data = this.connector.displayedDataset[this.rowNo];
        if (!data || data.__group) {
            (this.parentNode as HTMLElement).style.display = 'none';
            return;
        } else {
            (this.parentNode as HTMLElement).style.display = 'block';
        }

        if (data) {
            const cell = this.cell;
            this.style.width = this.connector.config.groups[this.group].width + 'px';
            this.innerEle.setAttribute(
                'type',
                cell.type === 'boolean' ? 'checkbox' : cell.type || 'text'
            );
            const newVal = data[cell.attribute] || null;
            if (newVal !== this.lastVal) {
                switch (cell.type) {
                    case 'boolean':
                        this.innerEle.checked = newVal;
                        this.innerEle.classList.remove('simple-html-grid-row-input');
                        this.innerEle.classList.add('simple-html-grid-row-checkbox');
                        break;
                    case 'image':
                        console.log('no-image');
                        break;
                    case 'empty':
                        console.log('no-.empty');
                        break;
                    case 'date':
                        this.innerEle.valueAsDate = newVal;
                        break;
                    case 'number':
                        this.innerEle.valueAsNumber = newVal;
                        break;
                    default:
                        this.innerEle.value = newVal;
                }
            }

            this.lastVal = newVal;
        }
    }
}
defineElement(SimpleHtmlGridCellRow, 'simple-html-grid-cell-row');
