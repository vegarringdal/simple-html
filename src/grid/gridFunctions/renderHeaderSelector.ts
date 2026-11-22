import { html, render } from 'lit-html';
import type { Entity, GroupRow } from '../../datasource/entity';
import type { Grid } from '../grid';
import { ariaColIndex, setAria } from './ariaGrid';
import { sectionColumns } from './cellRowKeyNavigationCellRowHandler';
import type { ColType } from './colType';
import { columnNumber } from './columnSelection';
import type { HTMLCellElement } from './HTMLCellElement';

/**
 * A column number, in the row of numbers under the header filters: the number of the column (1
 * based, across the pinned left, center and pinned right columns), with the selected look
 * (`simple-html-label-odd`) when the column is selected. Its clicks and keys are in columnNumbers.ts.
 *
 * For a screen reader the cell is a `gridcell` of the header row of numbers (ariaGrid.ts): at the
 * `aria-colindex` of the column's first field, spanning its fields (`aria-colspan`), `aria-selected`
 * true or false - as the rows say whether they are selected.
 */
export function renderHeaderSelector(
    ctx: Grid,
    cell: HTMLCellElement,
    _row: number,
    column: number,
    _celno: number,
    colType: ColType,
    _cellType: string,
    _attribute: string | null,
    // the first displayed row, not the header's: a group row when grouped, undefined when there are no rows
    _rowData: Entity | GroupRow | undefined
) {
    const config = ctx.gridInterface.__getGridConfig();
    const colNo = columnNumber(config, colType, column);
    const selected = ctx.gridInterface.__isColumnSelected(colNo);
    const fields = sectionColumns(config, colType)[column]?.fields.length ?? 1;

    setAria(cell, 'aria-colindex', String(ariaColIndex(config, colType, column, 0)));
    setAria(cell, 'aria-colspan', fields > 1 ? String(fields) : null);
    setAria(cell, 'aria-selected', String(selected));

    const className = selected
        ? 'simple-html-absolute-fill simple-html-label simple-html-label-odd'
        : 'simple-html-absolute-fill simple-html-label';

    render(
        html`<div class=${className}>
            <span class="simple-html-selector-text">${colNo}</span>
        </div>`,
        cell as any
    );
}
