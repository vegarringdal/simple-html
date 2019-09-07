import { html } from 'lit-html';
import { FreeGrid } from '..';
import { resizeColumnElement } from './resizeColumnElement';
import { headerColumContent } from './headerColumContent';
import { columnDragDrop } from '../dragEvent';
import { eventIF } from '../eventIF';

export function headerColumnElements(freeGrid: FreeGrid) {
    /** current left of column, so they stack nicely */
    const grouping = freeGrid.config.groupingSet && freeGrid.config.groupingSet.length;
    let curleft = grouping ? grouping * 15 : 0;

    return freeGrid.config.columns.map((col, i) => {
        if (!col.hide) {
            const style = `width:${col.width || 100}px;left:${curleft}px`;
            const mousedown = columnDragDrop('dragstart', col, i, freeGrid);
            const mouseenter = columnDragDrop('enter', col, i, freeGrid);

            const template = html`
                ${html`
                    <free-grid-col
                        class="free-grid-col free-grid-grouping-row"
                        style="width:${grouping ? grouping * 15 : 0}px;left:0"
                    >
                    </free-grid-col>
                `}
                <free-grid-header-col
                    style=${style}
                    class="free-grid-col ${!col.disableDragDrop ? 'free-grid-dragHandle' : ''}"
                    config-column=${i}
                    @custom-1=${eventIF(!col.disableDragDrop, 'mousedown', mousedown)}
                    @custom-2=${eventIF(!col.disableDragDrop, 'mouseenter', mouseenter)}
                >
                    ${headerColumContent(freeGrid, col)} ${resizeColumnElement(freeGrid, col)}
                </free-grid-header-col>
            `;

            curleft = curleft + (col.width || 100);

            return template;
        } else {
            return html``;
        }
    });
}
