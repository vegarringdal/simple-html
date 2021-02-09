import { GridInterface } from '../gridInterface';
import { SimpleHtmlGrid } from './simple-html-grid';
import { CellConfig } from '../types';
import { generateMenuWithComponentName } from './generateMenuWithComponentName';
import { defineElement } from './defineElement';

export class SimpleHtmlGridMenuLabel extends HTMLElement {
    connector: GridInterface;
    cell: CellConfig;
    ref: SimpleHtmlGrid;

    connectedCallback() {
        this.classList.add('simple-html-grid', 'simple-html-grid-menu');
        document.addEventListener('click', this);
        setTimeout(() => {
            document.addEventListener('contextmenu', this);
        }, 50);
        this.buildHtml();
    }

    disconnectedCallback() {
        document.removeEventListener('click', this);
        document.removeEventListener('contextmenu', this);
    }

    handleEvent(e: Event) {
        if (e.target !== this) {
            this.removeSelf();
        }
    }

    select(_type: string, asc?: boolean, add?: boolean) {
        if (_type === 'sort') {
            if (this.cell.sortable) {
                this.cell.sortable.sortAscending = asc;
                this.cell.sortable.noToggle = true;
            } else {
                this.cell.sortable = { sortAscending: asc, noToggle: true };
            }
            this.connector.sortCallback({ shiftKey: add } as MouseEvent, this.cell);
        }
        if (_type === 'groupBy') {
            if (this.cell.allowGrouping) {
                this.connector.groupingCallback(null, this.cell, null);
            }
        }
        this.removeSelf();
    }

    removeSelf() {
        this?.parentNode.removeChild(this);
    }

    buildHtml() {
        const el = [1, 1, 1, 1, 1, 1, 1, 1].map(() => document.createElement('p'));
        el.forEach((e) => e.classList.add('simple-html-grid-menu-item'));

        el[0].onclick = () => this.select('sort', false, false);
        el[0].appendChild(document.createTextNode('Sort asc'));

        el[1].onclick = () => this.select('sort', true, false);
        el[1].appendChild(document.createTextNode('Sort desc'));

        el[2].onclick = () => this.select('sort', true, true);
        el[2].appendChild(document.createTextNode('Sort asc (add)'));

        el[3].onclick = () => this.select('sort', false, true);
        el[3].appendChild(document.createTextNode('Sort desc (add)'));

        el[4].onclick = () => this.connector.autoResizeColumns();
        el[4].appendChild(document.createTextNode('Auto resize columns'));

        el[5].onclick = () => this.select('groupBy');
        el[5].appendChild(document.createTextNode('Group by'));

        el[6].onclick = () => {
            const cell = this.cell;
            if (!this.connector.config.optionalCells) {
                this.connector.config.optionalCells = [];
            }
            this.connector.config.optionalCells.push(cell);
            let removeGroup = null;
            this.connector.config.groups.forEach((row, groupNo) => {
                const index = row.rows.indexOf(cell);
                if (index !== -1) {
                    row.rows.splice(index, 1);
                }
                if (row.rows.length === 0) {
                    removeGroup = groupNo;
                }
            });
            if (removeGroup !== null) {
                this.connector.config.groups.splice(removeGroup, 1);
            }
            this.connector.manualConfigChange(this.connector.config);
        };

        el[6].appendChild(document.createTextNode('Remove cell'));

        el[7].onclick = (e: any) =>
            generateMenuWithComponentName(
                'simple-html-grid-column-chooser',
                e,
                this.connector,
                this.ref,
                null,
                null,
                null
            );
        el[7].appendChild(document.createTextNode('Column Chooser'));

        el.forEach((e) => this.appendChild(e));
    }
}

defineElement(SimpleHtmlGridMenuLabel, 'simple-html-grid-menu-label');
