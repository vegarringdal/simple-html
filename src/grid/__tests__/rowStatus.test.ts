// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DatasourceOptions } from '../../datasource/datasourceOptions';
import { where } from '../../datasource/filterExpression';
import type { GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import { dropDownFilterData } from '../gridFunctions/dropDownFilterData';
import { ROW_STATUS_WIDTH } from '../gridFunctions/rowStatus';
import { footerText, type MountedGrid, mountGrid, selectorRowOf, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { gridOf, menuEntry, menuItem, openFilterMenu, openRowMenu, sleep, typeInHeaderFilter } from './interactionTestHelpers';

/**
 * The row's state on its row number (GridConfig.rowStatus): an icon, the state as the tooltip's
 * first line and as text for a screen reader, a deleted row struck through. The marker of an edited
 * cell (GridConfig.editedMarker): its tooltip has the original value, a click reverts the cell.
 * "Changed rows only" in the grid: the row menu entry, the footer, the footer's Clear.
 */

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    document.body.innerHTML = '';
});

const config = (options: Partial<GridConfig> = {}): GridConfig => ({
    readonly: false,
    columns: { name: { label: 'Name' }, age: { label: 'Age' } },
    layout: {
        center: [
            { fields: ['name'], width: 100 },
            { fields: ['age'], width: 100 },
            { fields: ['born'], width: 100 }
        ]
    },
    ...options
});

const data = () => [
    { id: 1, name: 'Ann', age: 36, born: new Date(1990, 4, 17) },
    { id: 2, name: null, age: 20, born: null },
    { id: 3, name: 'Cid', age: 52, born: new Date(1974, 8, 30) },
    { id: 4, name: 'Dan', age: 40, born: null }
];

const fields = (): DatasourceOptions => ({
    key: 'id',
    fields: { age: { type: 'number', validate: [{ id: 'min', value: 18 }] }, born: 'date' }
});

const mount = (options: Partial<GridConfig> = {}) => mountGrid(config(options), data(), fields());

/** the input of a body cell: its field and its row in the displayed rows, 0 based */
function cellInput(element: GridElement, field: string, row: number): HTMLInputElement {
    return Array.from(element.querySelectorAll<HTMLInputElement>(`input[data-attribute="${field}"]`)).find(
        (input) => (input.closest('.simple-html-grid-col-cell') as any)?.$row === row
    ) as HTMLInputElement;
}

/** the cell element of a body cell, where the classes and the marker go */
const cellOf = (element: GridElement, field: string, row: number) =>
    cellInput(element, field, row).closest('.simple-html-grid-col-cell') as HTMLElement;

/** the markers of a cell element: one at most */
const markersOf = (cell: HTMLElement) => cell.querySelectorAll('.simple-html-cell-edited-marker');

/** the marker of a cell, null when it has none */
const markerOf = (element: GridElement, field: string, row: number) =>
    cellOf(element, field, row).querySelector<HTMLElement>('.simple-html-cell-edited-marker');

/** the row number cell (the gridcell) of a displayed row */
const numberCell = (element: GridElement, row: number) => selectorRowOf(element, row)?.firstElementChild as HTMLElement;

/** what the row number shows of the state: the icon, the tooltip, the screen reader's text */
function status(element: GridElement, row: number) {
    const cell = numberCell(element, row);
    const icon = cell.querySelector('.simple-html-row-status-icon');
    return {
        icon: icon ? (icon.getAttribute('class') ?? '').replace('simple-html-row-status-icon simple-html-row-status-', '') : null,
        tooltip: cell.getAttribute('data-tooltip'),
        screenReader: cell.querySelector('.simple-html-visually-hidden')?.textContent ?? null,
        classes: cell.querySelector('.simple-html-selector-text')?.parentElement?.className ?? ''
    };
}

/** types into a body cell as the user does: the value, an input event, no rendering in between */
function typeInCell(input: HTMLInputElement, value: string) {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('edited cell marker', () => {
    it('expect a marker and the class on an edited cell, none on the others', async () => {
        const { element, datasource, gridInterface } = await mount();
        datasource.getDataRows()[0].name = 'Anna';
        gridInterface.refresh();

        const cell = cellOf(element, 'name', 0);
        expect(cell.classList.contains('simple-html-cell-edited')).toBe(true);
        expect(markersOf(cell)).toHaveLength(1);
        // not for a screen reader, not a stop of Tab
        const marker = markersOf(cell)[0] as HTMLElement;
        expect(marker.getAttribute('aria-hidden')).toEqual('true');
        expect(marker.tabIndex).toBe(-1);

        for (const [field, row] of [
            ['age', 0],
            ['name', 1],
            ['born', 2]
        ] as const) {
            expect(cellOf(element, field, row).classList.contains('simple-html-cell-edited'), `${field} ${row}`).toBe(false);
            expect(markersOf(cellOf(element, field, row)), `${field} ${row}`).toHaveLength(0);
        }
    });

    it('expect the marker while the user types, without rendering the input again, and gone when typed back', async () => {
        const { element } = await mount();
        const input = cellInput(element, 'name', 0);
        input.dispatchEvent(new FocusEvent('focus'));

        typeInCell(input, 'Ann.');
        expect(markersOf(cellOf(element, 'name', 0))).toHaveLength(1);
        // the row number follows the edit too
        expect(status(element, 0).icon).toEqual('edited');
        expect(input.value).toEqual('Ann.');

        typeInCell(input, 'Ann');
        expect(markersOf(cellOf(element, 'name', 0))).toHaveLength(0);
        expect(cellOf(element, 'name', 0).classList.contains('simple-html-cell-edited')).toBe(false);
        expect(status(element, 0).icon).toBeNull();
    });

    it('expect one marker after rendering again, and none on a cell element that shows an unedited row now', async () => {
        const { element, datasource, gridInterface } = await mount();
        datasource.getDataRows()[0].name = 'Anna';
        gridInterface.refresh();
        gridInterface.refresh();
        gridInterface.rebuild();
        expect(markersOf(cellOf(element, 'name', 0))).toHaveLength(1);

        // sorted: the cell element of the first row shows another row
        datasource.sort({ attribute: 'age', ascending: true });
        expect(datasource.getRows()[0].name).toBeNull();
        expect(markersOf(cellOf(element, 'name', 0))).toHaveLength(0);
        // Anna is the second row now
        expect(cellInput(element, 'name', 1).value).toEqual('Anna');
        expect(markersOf(cellOf(element, 'name', 1))).toHaveLength(1);
    });

    it('expect the marker to go with undo, resetField(), resetRows() and acceptChanges()', async () => {
        const { element, datasource, gridInterface } = await mount();
        const row = datasource.getDataRows()[0];
        const edit = () => {
            row.name = 'Anna';
            gridInterface.refresh();
            expect(markerOf(element, 'name', 0)).not.toBeNull();
        };

        edit();
        await sleep(0);
        datasource.undo();
        expect(markerOf(element, 'name', 0)).toBeNull();

        edit();
        datasource.resetField(row, 'name');
        gridInterface.refresh();
        expect(markerOf(element, 'name', 0)).toBeNull();

        edit();
        datasource.resetRows(row);
        gridInterface.refresh();
        expect(markerOf(element, 'name', 0)).toBeNull();

        edit();
        datasource.acceptChanges();
        expect(markerOf(element, 'name', 0)).toBeNull();
        expect(cellInput(element, 'name', 0).value).toEqual('Anna');
    });

    it('expect no marker on a new row: all of it is new', async () => {
        const { element, datasource, gridInterface } = await mount();
        datasource.addNewEmpty({ name: 'New' }, { scrollTo: false });
        const row = datasource.getDataRows()[4];
        row.name = 'Newer';
        row.age = 30;
        gridInterface.refresh();

        expect(cellInput(element, 'name', 4).value).toEqual('Newer');
        expect(markerOf(element, 'name', 4)).toBeNull();
        expect(markerOf(element, 'age', 4)).toBeNull();
        expect(cellOf(element, 'name', 4).classList.contains('simple-html-cell-edited')).toBe(false);
    });

    it('expect the tooltip to have the original value formatted, and the click hint', async () => {
        const { element, datasource, gridInterface } = await mount();
        const [ann] = datasource.getDataRows();
        ann.born = new Date(2001, 0, 2);
        ann.age = 37;
        gridInterface.refresh();

        expect(markerOf(element, 'born', 0)?.getAttribute('data-tooltip')).toEqual('Original value: 1990-05-17\nClick to revert');
        expect(markerOf(element, 'age', 0)?.getAttribute('data-tooltip')).toEqual('Original value: 36\nClick to revert');
    });

    it('expect a blank original value to be shown as (blank)', async () => {
        const { element, datasource, gridInterface } = await mount();
        const row = datasource.getDataRows()[1];
        row.name = 'Bob';
        row.born = new Date(2000, 0, 1);
        gridInterface.refresh();

        expect(markerOf(element, 'name', 1)?.getAttribute('data-tooltip')).toEqual('Original value: (blank)\nClick to revert');
        expect(markerOf(element, 'born', 1)?.getAttribute('data-tooltip')).toEqual('Original value: (blank)\nClick to revert');
    });

    it('expect a cell with an error and an edit to show both, the tooltip the errors first', async () => {
        const { element, datasource, gridInterface } = await mount();
        datasource.getDataRows()[0].age = 5;
        gridInterface.refresh();

        const cell = cellOf(element, 'age', 0);
        expect(cell.classList.contains('simple-html-cell-error')).toBe(true);
        expect(cell.classList.contains('simple-html-cell-edited')).toBe(true);
        // the cell's own tooltip stays the errors
        expect(cell.getAttribute('data-tooltip')).toEqual('Must be at least 18');
        expect(markerOf(element, 'age', 0)?.getAttribute('data-tooltip')).toEqual(
            'Must be at least 18\nOriginal value: 36\nClick to revert'
        );
    });

    it('expect a click on the marker to revert the cell, one step of the undo history', async () => {
        const { element, datasource } = await mount();
        const input = cellInput(element, 'name', 0);
        input.dispatchEvent(new FocusEvent('focus'));
        typeInCell(input, 'Anna');
        input.dispatchEvent(new FocusEvent('blur'));
        await sleep(0);

        const marker = markerOf(element, 'name', 0) as HTMLElement;
        // the focus stays where it is: the mousedown is canceled
        const mousedown = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
        marker.dispatchEvent(mousedown);
        expect(mousedown.defaultPrevented).toBe(true);
        marker.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(datasource.getDataRows()[0].name).toEqual('Ann');
        expect(cellInput(element, 'name', 0).value).toEqual('Ann');
        expect(markerOf(element, 'name', 0)).toBeNull();
        expect(status(element, 0).icon).toBeNull();

        // one step: the revert. The typing is the step before it
        await sleep(0);
        datasource.undo();
        expect(datasource.getDataRows()[0].name).toEqual('Anna');
        expect(markerOf(element, 'name', 0)).not.toBeNull();
        datasource.undo();
        expect(datasource.getDataRows()[0].name).toEqual('Ann');
    });

    it('expect the click to revert the row the cell element shows at the time of the click', async () => {
        const { element, datasource, gridInterface } = await mount();
        const [ann, , cid] = datasource.getDataRows();
        ann.name = 'Anna';
        cid.name = 'Cidney';
        gridInterface.refresh();
        const marker = markerOf(element, 'name', 0) as HTMLElement;

        // scrolled: the cell element shows another row, renderCell sets its $row - the marker element
        // is the same
        (cellOf(element, 'name', 0) as unknown as { $row: number }).$row = 2;
        marker.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(cid.name).toEqual('Cid');
        expect(ann.name).toEqual('Anna');
    });

    it('expect the marker in a readonly grid, a click doing nothing and no click hint', async () => {
        const { element, datasource, gridInterface } = await mount({ readonly: true });
        datasource.getDataRows()[0].name = 'Anna';
        gridInterface.refresh();

        const marker = markerOf(element, 'name', 0) as HTMLElement;
        expect(marker.getAttribute('data-tooltip')).toEqual('Original value: Ann');
        expect(marker.classList.contains('simple-html-cell-edited-marker-revert')).toBe(false);
        marker.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(datasource.getDataRows()[0].name).toEqual('Anna');

        // editable again: the hand and the hint
        gridInterface.updateConfig({ readonly: false });
        const editable = markerOf(element, 'name', 0) as HTMLElement;
        expect(editable.classList.contains('simple-html-cell-edited-marker-revert')).toBe(true);
        expect(editable.getAttribute('data-tooltip')).toEqual('Original value: Ann\nClick to revert');
    });

    it('expect editedMarker: false to show no marker, the class stays for a look of your own', async () => {
        const { element, datasource, gridInterface } = await mount({ editedMarker: false });
        datasource.getDataRows()[0].name = 'Anna';
        gridInterface.refresh();

        expect(markerOf(element, 'name', 0)).toBeNull();
        expect(cellOf(element, 'name', 0).classList.contains('simple-html-cell-edited')).toBe(true);

        gridInterface.updateConfig({ editedMarker: undefined });
        expect(markerOf(element, 'name', 0)).not.toBeNull();
    });

    it("expect the marker's texts from the grid's texts", async () => {
        const { element, datasource, gridInterface } = await mount({
            texts: {
                'cell.editedMarker.tooltip': 'Opprinnelig: {value}',
                'cell.editedMarker.blank': '(tom)',
                'cell.editedMarker.revert': 'Klikk for å angre'
            }
        });
        const rows = datasource.getDataRows();
        rows[0].name = 'Anna';
        rows[1].name = 'Bob';
        gridInterface.refresh();

        expect(markerOf(element, 'name', 0)?.getAttribute('data-tooltip')).toEqual('Opprinnelig: Ann\nKlikk for å angre');
        expect(markerOf(element, 'name', 1)?.getAttribute('data-tooltip')).toEqual('Opprinnelig: (tom)\nKlikk for å angre');
    });
});

describe('row status', () => {
    it('expect a row as it was to show the number only', async () => {
        const { element } = await mount();

        expect(status(element, 0)).toEqual({ icon: null, tooltip: null, screenReader: null, classes: ' simple-html-row-status' });
        expect(numberCell(element, 0).textContent?.trim()).toEqual('1');
    });

    it('expect an edited row: the pencil, "Edited"', async () => {
        const { element, datasource, gridInterface } = await mount();
        datasource.getDataRows()[0].name = 'Anna';
        gridInterface.refresh();

        expect(status(element, 0)).toEqual({
            icon: 'edited',
            tooltip: 'Edited',
            screenReader: 'Edited',
            classes: 'row-is-modified simple-html-row-status'
        });
    });

    it('expect a new row: the plus, "New row", also when edited', async () => {
        const { element, datasource, gridInterface } = await mount();
        datasource.addNewEmpty({ name: 'New' }, { scrollTo: false });
        datasource.getDataRows()[4].age = 30;
        gridInterface.refresh();

        expect(status(element, 4)).toEqual({
            icon: 'new',
            tooltip: 'New row',
            screenReader: 'New row',
            classes: 'row-is-new simple-html-row-status'
        });
    });

    it('expect a row marked for deletion: the trash can, "Marked for deletion", its cells struck through', async () => {
        const { element, datasource } = await mount();
        datasource.markForDeletion(datasource.getDataRows()[2]);

        expect(status(element, 2)).toEqual({
            icon: 'deleted',
            tooltip: 'Marked for deletion',
            screenReader: 'Marked for deletion',
            classes: 'row-is-deleted simple-html-row-status'
        });
        expect(cellOf(element, 'name', 2).classList.contains('simple-html-cell-deleted')).toBe(true);
        expect(cellOf(element, 'name', 1).classList.contains('simple-html-cell-deleted')).toBe(false);

        datasource.unmarkForDeletion(datasource.getDataRows()[2]);
        expect(status(element, 2).icon).toBeNull();
        expect(cellOf(element, 'name', 2).classList.contains('simple-html-cell-deleted')).toBe(false);
    });

    it('expect a row with an error: the !, the state then the errors in the tooltip, both for a screen reader', async () => {
        const { element, datasource, gridInterface } = await mount();
        datasource.getDataRows()[0].age = 5;
        gridInterface.refresh();

        expect(numberCell(element, 0).classList.contains('simple-html-row-error')).toBe(true);
        expect(status(element, 0)).toEqual({
            icon: 'error',
            tooltip: 'Edited\nAge: Must be at least 18',
            screenReader: 'Edited, Error: Age: Must be at least 18',
            classes: 'row-is-modified simple-html-row-status'
        });
    });

    it('expect a server error on a row as it was: the !, the error only. On a new row: the ! wins over the +', async () => {
        const { element, datasource, gridInterface } = await mount();
        datasource.addNewEmpty({ name: 'New' }, { scrollTo: false });
        const newKey = String(datasource.getDataRows()[4].id);
        datasource.getDataContainer().setErrors(
            new Map([
                ['2', 'The server said no'],
                [newKey, 'Taken']
            ])
        );
        gridInterface.refresh();

        expect(status(element, 1)).toMatchObject({
            icon: 'error',
            tooltip: 'The server said no',
            screenReader: 'Error: The server said no'
        });
        expect(status(element, 4)).toMatchObject({
            icon: 'error',
            tooltip: 'New row\nTaken',
            screenReader: 'New row, Error: Taken'
        });
    });

    it('expect deleted to win over an error: the trash can, the server error kept in the tooltip', async () => {
        const { element, datasource, gridInterface } = await mount();
        const row = datasource.getDataRows()[0];
        row.age = 5;
        datasource.getDataContainer().setErrors(new Map([['1', 'Can not delete']]));
        datasource.markForDeletion(row);
        gridInterface.refresh();

        // a row marked for deletion has no validation errors, the server's stays
        expect(status(element, 0)).toEqual({
            icon: 'deleted',
            tooltip: 'Marked for deletion\nCan not delete',
            screenReader: 'Marked for deletion, Error: Can not delete',
            classes: 'row-is-deleted simple-html-row-status'
        });
        expect(numberCell(element, 0).classList.contains('simple-html-row-error')).toBe(true);
    });

    it('expect undo to take the state back', async () => {
        const { element, datasource, gridInterface } = await mount();
        datasource.getDataRows()[0].name = 'Anna';
        gridInterface.refresh();
        await sleep(0);
        datasource.markForDeletion(datasource.getDataRows()[0]);
        expect(status(element, 0).icon).toEqual('deleted');

        datasource.undo();
        expect(status(element, 0).icon).toEqual('edited');
        expect(cellOf(element, 'name', 0).classList.contains('simple-html-cell-deleted')).toBe(false);
        datasource.undo();
        expect(status(element, 0).icon).toBeNull();
    });

    it('expect no state on a group row', async () => {
        const { element, datasource } = await mount();
        datasource.getDataRows()[0].name = 'Anna';
        datasource.group([{ attribute: 'name', title: 'Name' }]);

        expect(isGroupRowShown(datasource.getRows()[0])).toBe(true);
        expect(status(element, 0).icon).toBeNull();
        expect(status(element, 0).screenReader).toBeNull();
    });

    it('expect the row numbers to be wider for the icon, the width they had with rowStatus: false', async () => {
        const withStatus = await mount();
        const plain = await mount({ rowStatus: false });

        const width = (mounted: MountedGrid) => mounted.gridInterface.__getGridConfig().__selectSizeWidth;
        expect(width(withStatus) - width(plain)).toEqual(ROW_STATUS_WIDTH);
        expect(width(plain)).toEqual(25);
    });

    it('expect rowStatus: false to show the plain row number: the classes and the error bar, no icon, no state', async () => {
        const { element, datasource, gridInterface } = await mount({ rowStatus: false });
        const rows = datasource.getDataRows();
        rows[0].age = 5;
        datasource.markForDeletion(rows[2]);
        gridInterface.refresh();

        expect(status(element, 0)).toEqual({
            icon: null,
            tooltip: 'Age: Must be at least 18',
            screenReader: null,
            classes: 'row-is-modified'
        });
        expect(numberCell(element, 0).classList.contains('simple-html-row-error')).toBe(true);
        expect(status(element, 2)).toEqual({ icon: null, tooltip: null, screenReader: null, classes: 'row-is-deleted' });
        expect(cellOf(element, 'name', 2).classList.contains('simple-html-cell-deleted')).toBe(false);

        // and on again
        gridInterface.updateConfig({ rowStatus: true });
        expect(status(element, 2).icon).toEqual('deleted');
    });

    it("expect the state's texts from the grid's texts", async () => {
        const { element, datasource, gridInterface } = await mount({
            texts: {
                'rowStatus.new': 'Ny',
                'rowStatus.edited': 'Endret',
                'rowStatus.deleted': 'Slettet',
                'rowStatus.error': 'Feil: {errors}'
            }
        });
        const rows = datasource.getDataRows();
        rows[0].age = 5;
        datasource.markForDeletion(rows[2]);
        datasource.addNewEmpty({ name: 'New' }, { scrollTo: false });
        gridInterface.refresh();

        expect(status(element, 0)).toMatchObject({
            tooltip: 'Endret\nAge: Must be at least 18',
            screenReader: 'Endret, Feil: Age: Must be at least 18'
        });
        expect(status(element, 2)).toMatchObject({ tooltip: 'Slettet', screenReader: 'Slettet' });
        expect(status(element, 4)).toMatchObject({ tooltip: 'Ny', screenReader: 'Ny' });
    });
});

/** a group row is shown first when grouped */
function isGroupRowShown(row: unknown) {
    return typeof row === 'object' && row !== null && '__group' in row && (row as { __group: boolean }).__group === true;
}

describe('changed rows only in the grid', () => {
    /** the menu entry, in the view submenu */
    const changedOnlyEntry = () => menuEntry('row.view.changedOnly');

    it('expect the row menu entry to turn it on and off, with a ✓ while on', async () => {
        const { element, datasource } = await mount();
        datasource.getDataRows()[0].name = 'Anna';

        openRowMenu(element, 'name', 0);
        expect(changedOnlyEntry().textContent?.trim()).toEqual('Changed rows only');
        // the ✓ is the css of a checked item
        expect(changedOnlyEntry().getAttribute('aria-checked')).toEqual('false');
        changedOnlyEntry().click();
        expect(datasource.isChangedOnly()).toBe(true);
        expect(datasource.getRows()).toHaveLength(1);

        openRowMenu(element, 'name', 0);
        expect(changedOnlyEntry().getAttribute('aria-checked')).toEqual('true');
        expect(changedOnlyEntry().classList).toContain('simple-html-grid-menu-item-selected');
        changedOnlyEntry().click();
        expect(datasource.isChangedOnly()).toBe(false);
        expect(datasource.getRows()).toHaveLength(4);
    });

    it('expect the row menu entry in a readonly grid too', async () => {
        const { element } = await mount({ readonly: true });
        openRowMenu(element, 'name', 0);
        expect(changedOnlyEntry()).not.toBeNull();
    });

    it('expect a chip in the footer, AND a header filter: the header filter keeps it on', async () => {
        const { element, datasource } = await mount();
        const rows = datasource.getDataRows();
        rows[0].name = 'Anna';
        rows[2].name = 'Cidney';
        datasource.filterChangedOnly(true);

        expect(footerText(element).replace(/\s+/g, ' ')).toEqual('2/4 ✕ Clear Changed rows only');

        typeInHeaderFilter(element, 'age', '50');
        expect(datasource.isChangedOnly()).toBe(true);
        expect(datasource.getRows().map((row) => row.id)).toEqual([3]);
        expect(footerText(element).replace(/\s+/g, ' ')).toEqual('1/4 ✕ Clear Changed rows only AND Age ≥ 50');
    });

    it("expect the footer's Clear to turn it off with the filter", async () => {
        const { element, datasource } = await mount();
        datasource.getDataRows()[0].name = 'Anna';
        datasource.filter(where('age', 'GREATER_THAN', 10));
        datasource.filterChangedOnly(true);

        (element.querySelector('.footer-filter-clear') as HTMLElement).click();

        expect(datasource.isChangedOnly()).toBe(false);
        expect(datasource.getFilter()).toBeNull();
        expect(datasource.getRows()).toHaveLength(4);
        expect(footerText(element)).toEqual('4/4');
    });

    it("expect the filter menu's Clear All Filters to turn it off too", async () => {
        const { element, datasource } = await mount();
        datasource.getDataRows()[0].name = 'Anna';
        datasource.filterChangedOnly(true);

        openFilterMenu(element, 'name');
        menuItem('Clear All Filters').click();

        expect(datasource.isChangedOnly()).toBe(false);
        expect(datasource.getRows()).toHaveLength(4);
    });

    it('expect the value list of the filter menu to list the values of the changed rows when "Filter Available"', async () => {
        const { element, datasource } = await mount();
        datasource.getDataRows()[0].name = 'Anna';
        datasource.filterChangedOnly(true);

        const available = dropDownFilterData(gridOf(element), 'name', true, null);
        const all = dropDownFilterData(gridOf(element), 'name', false, null);

        const texts = (list: typeof all) => list?.entries.map((entry) => (entry.blank ? 'Blank' : entry.text));
        expect(texts(available)).toEqual(['Anna']);
        expect(texts(all)).toEqual(['Blank', 'Anna', 'Cid', 'Dan']);
    });
});
