import './free-grid-body';
import './free-grid-cell-row';
import './free-grid-cell-filter';
import './free-grid-cell-label';
import './free-grid-group-filter';
import './free-grid-group-label';
import './free-grid-group-row';
import './free-grid-header';
import './free-grid-footer';
import './free-grid-panel';
import './free-grid-row';
import './free-grid-row-group';
import { scrollEvent } from '../scrollEvent';
import { GridInterface } from '../gridInterface';
import { rowCache } from '../interfaces';
import { html } from 'lit-html';
import { FreeGrid } from '../';

export function generate(connector: GridInterface, rowPositionCache: rowCache[], ref: FreeGrid) {
    const scroll = scrollEvent(connector, rowPositionCache, ref);

    return html`
        <free-grid-panel .connector=${connector} .ref=${ref}></free-grid-panel>
        <free-grid-header .connector=${connector} .ref=${ref}></free-grid-header>
        <free-grid-body
            .connector=${connector}
            .rowPositionCache=${rowPositionCache}
            @scroll=${scroll}
            .ref=${ref}
        ></free-grid-body>
        <free-grid-footer .connector=${connector} .ref=${ref}></free-grid-footer>
    `;
}
