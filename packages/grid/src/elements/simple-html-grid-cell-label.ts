import { customElement } from '@simple-html/core';
import { GridInterface, SimpleHtmlGrid } from '..';
import { GridGroupConfig } from '../types';
import { html } from 'lit-html';
import { resizeColumnElement } from './resizeColumnElement';
import { sorticonElement } from './sorticonElement';
import { columnDragDrop } from './dragEvent';
import { generateMenuWithComponentName } from './generateMenuWithComponentName';

@customElement('simple-html-grid-cell-label')
export default class extends HTMLElement {
    connector: GridInterface;
    cellPosition: number;
    ref: SimpleHtmlGrid;
    currentHeight: number;
    group: GridGroupConfig;
    label: string;

    connectedCallback() {
        this.classList.add('simple-html-grid-cell-label');
        const config = this.connector.config;
        this.style.display = 'block';
        this.style.height = config.cellHeight + 'px';
        this.style.width = this.group.width + 'px';
        this.style.top = this.cellPosition * config.cellHeight + 'px';
        this.ref.addEventListener('column-resize', this);
        this.ref.addEventListener('reRender', this);
    }

    handleEvent(e: Event) {
        if (e.type === 'column-resize') {
            this.render();
        }
        if (e.type === 'reRender') {
            this.render();
        }
    }

    disconnectedCallback() {
        this.ref.removeEventListener('column-resize', this);
        this.ref.removeEventListener('reRender', this);
    }

    capalize(text: string) {
        if (text) {
            return text[0].toUpperCase() + text.substring(1, text.length);
        } else {
            return text;
        }
    }

    render() {
        const cell = this.group.rows[this.cellPosition];
        const connector = this.connector;
        const ref = this.ref;
        const label = this.capalize(this.group.rows[this.cellPosition].header || '');

        const sortCallback = (e: any) => {
            const mouseup = (e: MouseEvent) => {
                cell.sortable.beforeSortCallbackFn &&
                    cell.sortable.beforeSortCallbackFn(e as any, cell, connector);
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

        const mousedown = columnDragDrop('dragstart', cell, connector);
        const mouseenter = columnDragDrop('enter', cell, connector);
        const mouseleave = columnDragDrop('leave', cell, connector);

        const contentMenu = function (e: any) {
            if ((e as any).button !== 0) {
                generateMenuWithComponentName(
                    'simple-html-grid-menu-label',
                    e,
                    connector,
                    ref,
                    cell
                );
            }
        };

        this.style.width = this.group.width + 'px';

        if (this.connector.config.renderLabelCallBackFn) {
            return this.connector.config.renderLabelCallBackFn(
                cell,
                this.connector,
                sorticonElement,
                resizeColumnElement,
                mousedown,
                mouseenter,
                mouseleave
            );
        }

        if (cell.type === 'empty') {
            return html`
                <style>
                    .simple-html-grid .hideme {
                        background-color: ${getComputedStyle(this.ref).getPropertyValue(
                            '--SimpleHtmlGrid-main-bg-color'
                        )};
                    }
                </style>
                <span
                    .cell=${cell}
                    class="simple-html-grid-label hideme"
                    @mouseenter=${!cell.disableDragDrop && mouseenter}
                    @mouseleave=${!cell.disableDragDrop && mouseleave}
                    @contextmenu=${(e: any) => {
                        e.preventDefault();
                        contentMenu(e);
                        return false;
                    }}
                >
                </span>
                ${resizeColumnElement(this.ref, this.group)}
            `;
        } else {
            return html`
                <span
                    .cell=${cell}
                    class="simple-html-grid-label"
                    @mousedown=${(e: any) => {
                        cell.sortable && sortCallback(e);
                        !cell.disableDragDrop && mousedown(e);
                    }}
                    @contextmenu=${(e: any) => {
                        e.preventDefault();
                        contentMenu(e);
                        return false;
                    }}
                    @mouseenter=${!cell.disableDragDrop && mouseenter}
                    @mouseleave=${!cell.disableDragDrop && mouseleave}
                    >${label} ${sorticonElement(this.connector, cell)}</span
                >
                ${resizeColumnElement(this.ref, this.group)}
            `;
        }
    }
}
