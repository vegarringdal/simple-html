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
import './simple-html-grid-row-group';
import { scrollEvent } from './scrollEvent';
import { GridInterface } from '../gridInterface';
import { rowCache } from '../interfaces';
import { html } from 'lit-html';
import { SimpleHtmlGrid } from '../';
import { columnDragDropPanel } from './dragEvent';

export function generate(
    connector: GridInterface,
    rowPositionCache: rowCache[],
    ref: SimpleHtmlGrid
) {
    const scroll = scrollEvent(connector, rowPositionCache, ref);
    const enter = columnDragDropPanel('enter', connector);
    const leave = columnDragDropPanel('leave', connector);

    return html`
        <simple-html-grid-panel
            .connector=${connector}
            .ref=${ref}
            @mouseleave=${leave}
            @mouseenter=${enter}
        ></simple-html-grid-panel>
        <simple-html-grid-header .connector=${connector} .ref=${ref}></simple-html-grid-header>
        <simple-html-grid-body
            .connector=${connector}
            .rowPositionCache=${rowPositionCache}
            @scroll=${scroll}
            .ref=${ref}
        ></simple-html-grid-body>
        <simple-html-grid-footer .connector=${connector} .ref=${ref}></simple-html-grid-footer>
    `;
}
