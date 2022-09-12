/* eslint-disable @typescript-eslint/no-use-before-define */
import { GridInterface } from '../gridInterface';
import { SimpleHtmlGrid } from './simple-html-grid';
import { CellConfig, FilterArgument } from '../types';
import { filterDialogGroupTemplate } from './filterDialogGroupTemplate';
import { defineElement } from './defineElement';

export class SimpleHtmlGridFilterDialog extends HTMLElement {
    connector: GridInterface;
    cell: CellConfig;
    ref: SimpleHtmlGrid;
    width: number;
    filterAttributes: CellConfig[];
    filter: FilterArgument;

    connectedCallback() {
        this.style.top = '0';
        this.style.left = '0';
        const defaultStartFilter: FilterArgument = {
            type: 'GROUP',
            logicalOperator: 'AND',
            filterArguments: []
        };

        this.filter = this.connector.getCurrentFilter() || defaultStartFilter;

        // if array we need to reset it
        if (Array.isArray(this.filter)) {
            this.filter = defaultStartFilter;
        }

        this.classList.add('simple-html-grid-menu-full');
        this.filterAttributes = this.connector.config.groups.flatMap((y) => y.rows);

        if (Array.isArray(this.connector.config.optionalCells)) {
            this.filterAttributes = this.filterAttributes.concat(
                this.connector.config.optionalCells
            );
        }

        this.generate();
    }

    handleEvent(e: Event) {
        if (e.target !== this) {
            this.removeSelf();
        }
    }

    removeSelf() {
        document.body.removeChild(this);
    }

    generate() {
        // this isnt very optimized... it should be handled smarter
        this.innerHTML = '';

        /**
         * container
         */
        const outerDiv = document.createElement('div');
        outerDiv.style.width = '650px';
        outerDiv.classList.add('simple-html-grid', 'simple-html-filter-dialog');

        /**
         * top row
         */
        const topRow = document.createElement('div');
        topRow.classList.add('dialog-row', 'main-group', 'filter-dialog-top-row');
        const header = document.createElement('span');
        header.appendChild(document.createTextNode('Filter Editor'));

        topRow.appendChild(header);
        outerDiv.appendChild(topRow);

        /**
         * query part
         */
        outerDiv.appendChild(filterDialogGroupTemplate(this.filter, this, 0));

        this.appendChild(outerDiv);

        /**
         * bottom row of query editor
         */

        const bottomRow = document.createElement('div');
        bottomRow.classList.add('dialog-row', 'main-group', 'filter-dialog-bottom-row');
        outerDiv.appendChild(bottomRow);
        /**
         * close button
         */
        const closeBtn = document.createElement('button');
        closeBtn.classList.add('dialog-item-buttombuttons');
        closeBtn.onclick = () => {
            this.removeSelf();
        };
        closeBtn.appendChild(document.createTextNode('Cancel'));
        bottomRow.appendChild(closeBtn);

        outerDiv.appendChild(bottomRow);

        /**
         * filter button
         */
        const queryBtn = document.createElement('button');
        queryBtn.classList.add('dialog-item-buttombuttons');
        queryBtn.onclick = () => {
            const columns = this.connector.config.groups.flatMap((x) => x.rows);
            columns.forEach((col) => {
                const f = col.filterable;
                if (f) {
                    f.currentValue = null;
                }
            });
            this.connector.setCurrentFilter(this.filter);
            this.connector.reRunFilter();
        };
        queryBtn.appendChild(document.createTextNode('Apply'));
        bottomRow.appendChild(queryBtn);

        /**
         * filter & close button
         */
        const queryCloseBtn = document.createElement('button');
        queryCloseBtn.classList.add('dialog-item-buttombuttons');
        queryCloseBtn.onclick = () => {
            const columns = this.connector.config.groups.flatMap((x) => x.rows);
            columns.forEach((col) => {
                const f = col.filterable;
                if (f) {
                    f.currentValue = null;
                }
            });
            this.connector.setCurrentFilter(this.filter);
            this.connector.reRunFilter();
            this.removeSelf();
        };
        queryCloseBtn.appendChild(document.createTextNode('OK'));
        bottomRow.appendChild(queryCloseBtn);
    }
}
defineElement(SimpleHtmlGridFilterDialog, 'simple-html-grid-filter-dialog');
