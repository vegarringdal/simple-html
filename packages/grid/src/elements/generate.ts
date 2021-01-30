import './simple-html-grid-body';
import './simple-html-grid-cell-row';
import './simple-html-grid-cell-filter';
import './simple-html-grid-cell-label';
import './simple-html-grid-group-filter';
import './simple-html-grid-group-label';
import './simple-html-grid-group-row';
import './simple-html-grid-header';
import './simple-html-grid-footer';
import './simple-html-grid-panel';
import './simple-html-grid-row';
import './simple-html-grid-col';
import './simple-html-grid-menu-row';
import './simple-html-grid-menu-label';
import './simple-html-grid-menu-filter';
import './simple-html-grid-menu-panel';
import './simple-html-grid-filter-dialog';
import './simple-html-grid-column-chooser';
import './simple-html-grid-menu-custom';
import { scrollEvent } from './scrollEvent';
import { GridInterface } from '../gridInterface';
import { RowCache } from '../types';
import { html } from 'lit-html';
import { SimpleHtmlGrid } from '../';
import { columnDragDropPanel } from './dragEvent';

export function generate(
    connector: GridInterface,
    rowPositionCache: RowCache[],
    ref: SimpleHtmlGrid
) {
    console.log('generate');
    const scroll = scrollEvent(connector, rowPositionCache, ref);
    const enter = columnDragDropPanel('enter', connector);
    const leave = columnDragDropPanel('leave', connector);

    const panel = document.createElement('simple-html-grid-panel');
    panel.connector = connector;
    panel.ref = ref;
    panel.onmouseleave = leave;
    panel.onmouseenter = enter;
    ref.appendChild(panel);

    const header = document.createElement('simple-html-grid-header');
    header.connector = connector;
    header.ref = ref;
    ref.appendChild(header);

    const body = document.createElement('simple-html-grid-body');
    body.connector = connector;
    body.ref = ref;
    body.rowPositionCache = rowPositionCache;
    body.onscroll = scroll;
    ref.appendChild(body);

    const footer = document.createElement('simple-html-grid-footer');
    footer.connector = connector;
    footer.ref = ref;
    ref.appendChild(footer);
}
