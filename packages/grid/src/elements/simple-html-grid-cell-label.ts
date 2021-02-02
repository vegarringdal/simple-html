import { customElement } from '@simple-html/core';
import { GridInterface, SimpleHtmlGrid } from '..';
import { GridGroupConfig } from '../types';
import { resizeColumnElement } from './resizeColumnElement';
import { sorticonElement } from './sorticonElement';
import { columnDragDrop, dropzone } from './dragEvent';
import { generateMenuWithComponentName } from './generateMenuWithComponentName';

@customElement('simple-html-grid-cell-label')
export class SimpleHtmlGridCellLabel extends HTMLElement {
    connector: GridInterface;
    cellPosition: number;
    ref: SimpleHtmlGrid;
    currentHeight: number;
    group: GridGroupConfig;
    label: string;
    labelEl: HTMLSpanElement;
    textEl: any;

    connectedCallback() {
        this.classList.add('simple-html-grid-cell-label');
        const config = this.connector.config;
        this.style.display = 'block';
        this.style.height = config.cellHeight + 'px';
        this.style.width = this.group.width + 'px';
        this.style.top = this.cellPosition * config.cellHeight + 'px';
        this.ref.addEventListener('column-resize', this);
        this.xrender();
    }

    handleEvent(e: Event) {
        if (e.type === 'column-resize') {
            this.style.width = this.group.width + 'px';
        }
        /*  if (e.type === 'reRender') {
            this.render();
        } */
    }

    disconnectedCallback() {
        this.ref.removeEventListener('column-resize', this);
        /*  this.ref.removeEventListener('reRender', this); */
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
    }

    xrender() {
        const cell = this.group.rows[this.cellPosition];
        const connector = this.connector;
        const ref = this.ref;
        const config = connector.config;
        this.style.display = 'block';
        this.style.height = config.cellHeight + 'px';
        this.style.width = this.group.width + 'px';
        this.style.top = this.cellPosition * config.cellHeight + 'px';

        const sortCallback = (e: any) => {
            const mouseup = (e: MouseEvent) => {
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
            connector,
            () => this.group
        );
        const mouseenter = columnDragDrop(
            'enter',
            () => this.group.rows[this.cellPosition],
            connector,
            () => this.group
        );
        const mouseleave = columnDragDrop(
            'leave',
            () => this.group.rows[this.cellPosition],
            connector,
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

        if (this.connector.gridCallbacks.renderLabelCallBackFn) {
            return this.connector.gridCallbacks.renderLabelCallBackFn(
                () => this.group.rows[this.cellPosition],
                this.connector,
                sorticonElement,
                resizeColumnElement,
                mousedown,
                mouseenter,
                mouseleave
            );
        }

        this.labelEl = document.createElement('span');
        this.labelEl.classList.add('simple-html-grid-label');
        (this.labelEl as any).cell = cell;
        this.labelEl.onmousedown = function (e) {
            cell.sortable && sortCallback(e);
            !cell.disableDragDrop && mousedown(e);
        };
        this.labelEl.oncontextmenu = (e: any) => {
            e.preventDefault();
            contentMenu(e);
            return false;
        };
        this.labelEl.onmouseenter = !cell.disableDragDrop && mouseenter;
        this.labelEl.onmouseleave = !cell.disableDragDrop && mouseleave;

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

        //${label} ${sorticonElement(this.connector, cell)
    }
}
