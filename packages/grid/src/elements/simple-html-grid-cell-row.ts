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
    lastVal: any;
    innerBtn: HTMLButtonElement;

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



        this.ref.addEventListener('update-cell-data-currentEnity', this);
        this.ref.addEventListener('update-cell-data', this);
        this.updateInput();
    }

    disconnectedCallback() {
        this.ref.removeEventListener('update-cell-data-currentEnity', this);
        this.ref.removeEventListener('update-cell-data', this);
    }

    handleEvent(e: Event) {
        if (e.type === 'column-resize') {
            this.style.width = this.connector.config.groups[this.group].width + 'px';
        }

        if (e.type === 'update-cell-data') {
            this.updateInput();
        }

        if (e.type === 'update-cell-data-currentEnity') {
            const data = this.connector.displayedDataset[this.rowNo];
            const currentEnity = this.connector.getDatasource().currentEntity
            if (data === currentEnity) {
                this.updateInput();
            }

        }
    }

    // callback for change
    private updateCallback(e: any) {
        const data = this.connector.displayedDataset[this.rowNo];
        const cell = this.cell;
        this.style.width = this.connector.config.groups[this.group].width + 'px';

        if (cell.readonly || this.connector.config.readonly) {
            if (this.cell.type === 'date') {
                // date picker with alt key overides input somehow..
                e.target.value = this.connector.dateFormater.fromDate(data[cell.attribute] || null);
                return;
            }

            if (this.cell.type === 'number') {
                // date picker with alt key overides input somehow..
                e.target.value = this.connector.numberFormater.fromNumber(
                    data[cell.attribute] || null
                );
                return;
            }

            if (this.cell.type === 'boolean') {
                // date picker with alt key overides input somehow..
                e.target.checked = data[cell.attribute]
                return;
            }


            e.target.value = data[cell.attribute]


        }

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
                    data[cell.attribute] = this.connector.dateFormater.toDate(e.target.value);
                    break;
                case 'number':
                    data[cell.attribute] = this.connector.numberFormater.toNumber(e.target.value);
                    break;
                default:
                    data[cell.attribute] = e.target.value;
            }
            this.connector.publishEvent('attribute-change', this);
        }
    }

    public updateWidth() {
        this.style.width = this.connector.config.groups[this.group].width + 'px';
    }

    updateInput() {
        const data = this.connector.displayedDataset[this.rowNo];
        const ref = this.ref;
        const connector = this.connector; //ref in callback

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
        const change =
            this.cell.editEventType !== 'input'
                ? (e: any) => {
                    this.lastVal = undefined;
                    this.updateCallback(e);
                    // if not input change, we can update it
                    this.updateInput();
                }
                : null;
        const input =
            this.cell.editEventType === 'input'
                ? (e: any) => {
                    this.lastVal = undefined;
                    this.updateCallback(e);
                }
                : null;
        this.innerEle.readOnly = this.cell.readonly || connector.config.readonly;
        this.innerEle.disabled = this.cell.disabled;
        this.innerEle.onchange = change;
        if (this.cell.type === 'date') {
            this.innerEle.oninput = null;
        } else {
            this.innerEle.oninput = input;
        }

        this.innerEle.oncontextmenu = (e: any) => {
            e.preventDefault();
            contentMenu(e);
            return false;
        };

        if (!data || data.__group) {
            (this.parentNode as HTMLElement).style.display = 'none';
            return;
        } else {
            (this.parentNode as HTMLElement).style.display = 'block';
        }

        // set celltype
        let celltype = this.cell.type === 'boolean' ? 'checkbox' : this.cell.type || 'text';
        if (celltype !== 'text' && celltype !== 'checkbox') {
            celltype = 'text';
        }

        if (this.innerEle.type !== celltype) {
            this.innerEle.type = celltype;
        }

        this.innerEle.onfocus = () => {
            if (this.innerBtn) {
                this.innerBtn.classList.remove('simple-html-grid-iconhidden')
            }
        }

        this.innerEle.onblur = () => {
            if (this.innerBtn) {
                setTimeout(() => {
                    this.innerBtn.classList.add('simple-html-grid-iconhidden')
                }, 200);

            }
        }

        // fix class if checkbox/input
        if (celltype === 'checkbox') {
            if (this.innerEle.classList.contains('simple-html-grid-row-input')) {
                this.innerEle.classList.remove('simple-html-grid-row-input');
            }
            if (!this.innerEle.classList.contains('simple-html-grid-row-checkbox')) {
                this.innerEle.classList.add('simple-html-grid-row-checkbox');
            }
        } else {
            if (this.innerEle.classList.contains('simple-html-grid-row-checkbox')) {
                this.innerEle.classList.remove('simple-html-grid-row-checkbox');
            }
            if (!this.innerEle.classList.contains('simple-html-grid-row-input')) {
                this.innerEle.classList.add('simple-html-grid-row-input');
            }
        }




        // so I can attach external dropdown etc 
        if (celltype !== 'checkbox' && this.cell.focusButton) {

            let show = true;
            const gridReadonly = this.connector.config.readonly;
            const cellReadonly = this.cell.readonly;

            if (gridReadonly && this.cell.focusButtonIfGridReadonly === false) {
                show = false;
            }

            if (cellReadonly && this.cell.focusButtonIfCellReadonly === false) {
                show = false;
            }

            if (show) {
                if (!this.innerBtn) {
                    this.innerBtn = document.createElement('button')
                    this.innerBtn.classList.add('simple-html-grid-row-input-button', 'simple-html-grid-iconhidden')
                    this.innerBtn.appendChild(document.createTextNode('...'))
                    this.appendChild(this.innerBtn)
                }
                this.innerBtn.onclick = () => {
                    this.connector.publishEvent('focus-button', this);
                }
            } else {
                if (this.innerBtn && this.innerBtn.parentNode) {
                    this.innerBtn.parentNode.removeChild(this.innerBtn)
                }
            }
        } else {
            if (this.innerBtn && this.innerBtn.parentNode) {
                this.innerBtn.parentNode.removeChild(this.innerBtn)
            }
        }

        this.style.width = this.connector.config.groups[this.group].width + 'px';
        this.innerEle.placeholder = ''; // reset

        if (data) {
            const cell = this.cell;

            if (cell.type === 'date') {
                this.innerEle.placeholder = this.connector.dateFormater.getPlaceHolderDate();
            }

            const newVal = data[cell.attribute] || null;

            if (newVal !== this.lastVal) {
                switch (cell.type) {
                    case 'boolean':
                        this.innerEle.checked = newVal;
                        break;
                    case 'image':
                        console.log('no-image');
                        break;
                    case 'empty':
                        console.log('no-.empty');
                        break;
                    case 'date':
                        this.innerEle.value = this.connector.dateFormater.fromDate(newVal);
                        break;
                    case 'number':
                        this.innerEle.value = this.connector.numberFormater.fromNumber(
                            newVal
                        ) as string;
                        break;
                    default:
                        this.innerEle.value = newVal;
                }
            }

            this.lastVal = newVal;
        } else {
            if (this.innerEle.value) {
                this.innerEle.value = '';
            }
        }
    }
}
defineElement(SimpleHtmlGridCellRow, 'simple-html-grid-cell-row');
