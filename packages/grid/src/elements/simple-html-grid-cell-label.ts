import { GridInterface, SimpleHtmlGrid } from '..';
import { GridGroupConfig } from '../types';
import { resizeColumnElement } from './resizeColumnElement';
import { columnDragDrop, dropzone } from './dragEvent';
import { generateMenuWithComponentName } from './generateMenuWithComponentName';
import { defineElement } from './defineElement';

export class SimpleHtmlGridCellLabel extends HTMLElement {
    connector: GridInterface;
    cellPosition: number;
    ref: SimpleHtmlGrid;
    currentHeight: number;
    group: GridGroupConfig;
    label: string;
    labelEl: HTMLSpanElement;
    textEl: any;
    sortIcon: any;

    connectedCallback() {
        this.classList.add('simple-html-grid-cell-label');
        const config = this.connector.config;
        this.style.display = 'block';
        this.style.height = config.cellHeight + 'px';
        this.style.width = this.group.width + 'px';
        this.style.top = this.cellPosition * config.cellHeight + 'px';
        this.ref.addEventListener('column-resize', this);
        this.generateGui();
    }

    handleEvent(e: Event) {
        if (e.type === 'column-resize') {
            this.style.width = this.group.width + 'px';
        }
    }

    disconnectedCallback() {
        this.ref.removeEventListener('column-resize', this);
    }

    capalize(text: string) {
        if (text) {
            return text[0].toUpperCase() + text.substring(1, text.length);
        } else {
            return text;
        }
    }

    update() {
        const cell = this.group.rows[this.cellPosition];
        (this.labelEl as any).cell = cell;
        this.style.display = 'block';
        const config = this.connector.config;
        this.style.height = config.cellHeight + 'px';
        this.style.width = this.group.width + 'px';
        this.style.top = this.cellPosition * config.cellHeight + 'px';
        this.labelEl.innerText = this.capalize(this.group.rows[this.cellPosition].header || '');
        this.setSortIcon();
    }

    setSortIcon() {
        const xmlns = 'http://www.w3.org/2000/svg';
        const ascTemplate = document.createElementNS(xmlns, 'svg');

        ascTemplate.setAttributeNS(null, 'viewBox', '0 0 16 16');
        ascTemplate.setAttributeNS(null, 'class', 'simple-html-grid-icon');
        const ascTemplatePath = document.createElementNS(xmlns, 'path');
        ascTemplatePath.setAttributeNS(null, 'd', 'M7.4 6L3 10h1.5L8 7l3.4 3H13L8.5 6h-1z');
        ascTemplate.appendChild(ascTemplatePath);

        const descTemplate = document.createElementNS(xmlns, 'svg');
        descTemplate.setAttributeNS(null, 'viewBox', '0 0 16 16');
        descTemplate.setAttributeNS(null, 'class', 'simple-html-grid-icon');

        const descTemplatePath = document.createElementNS(xmlns, 'path');
        descTemplatePath.setAttributeNS(null, 'd', 'M7.4 10L3 6h1.5L8 9.2 11.3 6H13l-4.5 4h-1z');
        descTemplate.appendChild(descTemplatePath);

        if (this.sortIcon) {
            this.sortIcon.parentNode?.removeChild(this.sortIcon);
            this.sortIcon = null;
        }
        const cell = this.group.rows[this.cellPosition];
        if (cell.sortable && cell.sortable.sortNo) {
            this.sortIcon = document.createElement('i');
            this.sortIcon.appendChild(cell.sortable.sortAscending ? ascTemplate : descTemplate);
            this.labelEl.appendChild(this.sortIcon);
            this.sortIcon.classList.add('simple-html-grid-fa-sort-number');
            this.sortIcon.setAttribute('data-vgridsort', cell.sortable.sortNo);
        }
    }

    generateGui() {
        const sortCallback = (e: any) => {
            const mouseup = (e: MouseEvent) => {
                const cell = this.group.rows[this.cellPosition];
                const connector = this.connector;
                connector.gridCallbacks.beforeSortCallbackFn &&
                    connector.gridCallbacks.beforeSortCallbackFn(e as any, cell, connector);
                if (cell.sortable.auto !== false) {
                    connector.sortCallback(e as any, cell);
                }
            };

            if ((e as any).button === 0) {
                e.target.addEventListener('mouseup', mouseup);
                setTimeout(() => {
                    e.target.removeEventListener('mouseup', mouseup);
                }, 500);
            } else {
                // do not do anything, we use context event here
                //console.log('open menu');
            }
        };

        const mousedown = columnDragDrop(
            'dragstart',
            () => this.group.rows[this.cellPosition],
            this.connector,
            () => this.group
        );
        const mouseenter = columnDragDrop(
            'enter',
            () => this.group.rows[this.cellPosition],
            this.connector,
            () => this.group
        );
        const mouseleave = columnDragDrop(
            'leave',
            () => this.group.rows[this.cellPosition],
            this.connector,
            () => this.group
        );

        const contentMenu = (e: any) => {
            if ((e as any).button !== 0) {
                generateMenuWithComponentName(
                    'simple-html-grid-menu-label',
                    e,
                    connector,
                    ref,
                    () => this.group.rows[this.cellPosition]
                );
            }
        };

        const cell = this.group.rows[this.cellPosition];
        const connector = this.connector;
        const ref = this.ref;
        const config = connector.config;
        this.style.display = 'block';
        this.style.height = config.cellHeight + 'px';
        this.style.width = this.group.width + 'px';
        this.style.top = this.cellPosition * config.cellHeight + 'px';

        this.labelEl = document.createElement('span');
        this.labelEl.classList.add('simple-html-grid-label');

        this.labelEl.onmouseenter = !cell.disableDragDrop && mouseenter;
        this.labelEl.onmouseleave = !cell.disableDragDrop && mouseleave;
        this.labelEl.onmousedown = (e) => {
            const cell = this.group.rows[this.cellPosition];
            cell.sortable && sortCallback(e);
            !cell.disableDragDrop && mousedown(e);
        };
        this.labelEl.oncontextmenu = (e: any) => {
            e.preventDefault();
            contentMenu(e);
            return false;
        };

        this.appendChild(this.labelEl);
        this.appendChild(resizeColumnElement(this.ref, () => this.group));
        this.appendChild(
            dropzone(
                connector,
                () => this.group,
                () => this.group.rows[this.cellPosition],
                'left'
            )
        );
        this.appendChild(
            dropzone(
                connector,
                () => this.group,
                () => this.group.rows[this.cellPosition],
                'right'
            )
        );
        this.appendChild(
            dropzone(
                connector,
                () => this.group,
                () => this.group.rows[this.cellPosition],
                'top'
            )
        );

        this.appendChild(
            dropzone(
                connector,
                () => this.group,
                () => this.group.rows[this.cellPosition],
                'bottom'
            )
        );

        this.labelEl.innerText = this.capalize(this.group.rows[this.cellPosition].header || '');
        this.setSortIcon();
    }
}

defineElement(SimpleHtmlGridCellLabel, 'simple-html-grid-cell-label');
