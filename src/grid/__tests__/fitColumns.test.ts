// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Datasource } from '../../datasource/dataSource';
import { where } from '../../datasource/filterExpression';
import type { GridConfig } from '../gridConfig';
import { longestTexts } from '../gridFunctions/fitColumns';
import { GridInterface } from '../gridInterface';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { gridOf, menuItemsExact, openLabelMenu, openRowMenu, pointerEvent, resizeHandle } from './interactionTestHelpers';

/**
 * Column widths fitted to their content, like Excel's AutoFit: `fitColumns()` (and the deprecated
 * `autoResizeColumns()`), `resetColumnWidths()`, the header menu's "Size:" entries, the row menu's
 * "Fit column to this cell" and a double click on a resize handle.
 *
 * happy-dom has no canvas: stubCanvas measures a text as 7px per character. So a column fitted to a
 * text of n characters is 7n + 12 (the room of the input), to a label of n characters 7n + 50 (the
 * label is centered, the sort icon at its right) - see fitColumns.ts.
 */

/** the width of a column fitted to a cell's text of `characters` characters */
const cellWidth = (characters: number) => characters * 7 + 12;
/** ... to a multiline text whose widest line has `characters` characters: the marker's room too */
const multilineWidth = (characters: number) => characters * 7 + 12 + 13;
/** ... to a header label of `characters` characters */
const labelWidth = (characters: number) => characters * 7 + 50;

const data = () => [
    {
        name: 'Al',
        company: 'Bartholomew Industries',
        notes: 'short\na much longer second line',
        age: 7,
        born: new Date(2001, 4, 17),
        active: true
    },
    { name: 'Christopher', company: 'Globex', notes: 'one line', age: 1234, born: null, active: false },
    { name: 'Cy', company: 'X', notes: '', age: null, born: new Date(1999, 0, 1), active: true }
];

const fields = () => ({
    key: 'name',
    fields: { age: 'number' as const, born: 'date' as const, active: 'boolean' as const, notes: { multiline: true } }
});

// short labels, so the content decides - unless a test is about the label
const config = (more: Partial<GridConfig> = {}): GridConfig => ({
    columns: {
        name: { label: 'N' },
        company: { label: 'C' },
        notes: { label: 'No' },
        age: { label: 'A' },
        born: { label: 'B' },
        active: { label: 'Ac' }
    },
    layout: {
        left: [{ fields: ['name'], width: 100 }],
        center: [
            { fields: ['company'], width: 100 },
            { fields: ['notes'], width: 100 },
            { fields: ['age', 'born'], width: 100 }
        ],
        right: [{ fields: ['active'], width: 100 }]
    },
    ...more
});

/** the width of each column of the layout now, by its first field */
const widths = (gridInterface: GridInterface<any>) => {
    const { left = [], center, right = [] } = gridInterface.getState().layout;
    return Object.fromEntries([...left, ...center, ...right].map((column) => [column.fields[0], column.width]));
};

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    document.body.innerHTML = '';
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('fitColumns', () => {
    it('expect every column as wide as its widest text, the label when that is wider', async () => {
        const { gridInterface } = await mountGrid(config(), data(), fields());

        gridInterface.fitColumns();

        expect(widths(gridInterface)).toEqual({
            name: cellWidth('Christopher'.length),
            company: cellWidth('Bartholomew Industries'.length),
            // the widest line, and the room of the marker at the right of a cell of several lines
            notes: multilineWidth('a much longer second line'.length),
            // stacked: the widest of its fields - the date as the cell shows it, 2001-05-17
            age: cellWidth('2001-05-17'.length),
            // a checkbox has no text: the label is wider than the checkbox
            active: labelWidth(2)
        });
    });

    it('expect the label when it is wider than the values', async () => {
        const { gridInterface } = await mountGrid(
            config({ columns: { company: { label: 'A label much longer than the values' } } }),
            data(),
            fields()
        );

        gridInterface.fitColumns(['company']);

        expect(widths(gridInterface).company).toEqual(labelWidth('A label much longer than the values'.length));
    });

    it('expect only the columns of the fields given, a column of stacked fields by any of them', async () => {
        const { gridInterface } = await mountGrid(config(), data(), fields());

        gridInterface.fitColumns(['name', 'born']);

        expect(widths(gridInterface)).toEqual({
            name: cellWidth(11),
            company: 100,
            notes: 100,
            age: cellWidth(10),
            active: 100
        });
    });

    it('expect the rows the filter lets through, not the rows it hides', async () => {
        // before v6 autoResizeColumns() measured every row: a value no one sees made the column wide
        const { gridInterface, datasource } = await mountGrid(config(), data(), fields());
        datasource.filter(where('name', 'NOT_EQUAL_TO', 'Al'));

        gridInterface.fitColumns(['company']);

        // Globex and X are left: the label "C" is wider than Globex
        expect(widths(gridInterface).company).toEqual(Math.max(cellWidth('Globex'.length), labelWidth(1)));
        expect(widths(gridInterface).company).toBeLessThan(cellWidth('Bartholomew Industries'.length));
    });

    it('expect the text as the cell shows it: formatted, with numberOverride', async () => {
        // before v6 the stored values were measured: a Date not at all, a number as its digits
        const rows = [
            { name: 'a', age: 0, born: new Date(2001, 4, 17) },
            { name: 'b', age: 0, born: null }
        ];
        const { gridInterface } = await mountGrid(
            {
                columns: { age: { label: 'A', numberOverride: 'ZERO_TO_BLANK' }, born: { label: 'B' } },
                layout: {
                    center: [
                        { fields: ['age'], width: 100 },
                        { fields: ['born'], width: 100 }
                    ]
                }
            },
            rows,
            fields()
        );

        gridInterface.fitColumns();

        // every age shows blank: nothing to measure but the label
        expect(widths(gridInterface)).toEqual({ age: labelWidth(1), born: cellWidth(10) });
    });

    it('expect a multiline text by its widest line: before v6 the whole text was one long line', async () => {
        const rows = [{ name: 'a', notes: 'first line\nsecond\nthe third and widest line\n' }];
        const { gridInterface } = await mountGrid(config(), rows, fields());

        gridInterface.fitColumns(['notes']);

        expect(widths(gridInterface).notes).toEqual(multilineWidth('the third and widest line'.length));
    });

    it('expect a column at least 25px and at most 750px wide', async () => {
        const rows = [{ name: 'x'.repeat(200), company: 'y' }];
        const { gridInterface } = await mountGrid(
            { columns: { name: { label: 'N' }, company: { label: 'C' } }, layout: config().layout },
            rows,
            fields()
        );

        gridInterface.fitColumns(['name']);
        gridInterface.fitColumns(['company'], { rows: [gridInterface.getDatasource().getDataRows()[0]] });

        expect(widths(gridInterface).name).toEqual(750);
        expect(widths(gridInterface).company).toEqual(25);
    });

    it('expect options.rows to fit to the cells of those rows, without the label', async () => {
        const { gridInterface, datasource } = await mountGrid(
            config({ columns: { company: { label: 'A label much longer than the values' } } }),
            data(),
            fields()
        );
        const globex = datasource.getDataRows()[1];

        gridInterface.fitColumns(['company'], { rows: [globex] });

        expect(widths(gridInterface).company).toEqual(cellWidth('Globex'.length));
    });

    it('expect a column with nothing to measure to keep its width', async () => {
        const { gridInterface, datasource } = await mountGrid(config(), data(), fields());
        const cy = datasource.getDataRows()[2];

        // the notes of Cy are empty
        gridInterface.fitColumns(['notes'], { rows: [cy] });

        expect(widths(gridInterface).notes).toEqual(100);
    });

    it('expect a field in two columns (pinned as a copy) to fit both', async () => {
        const layout = config().layout;
        const { gridInterface } = await mountGrid(
            config({ layout: { ...layout, right: [{ fields: ['company'], width: 60 }] } }),
            data(),
            fields()
        );

        gridInterface.fitColumns(['company']);

        const { center, right = [] } = gridInterface.getState().layout;
        expect(center[0].width).toEqual(cellWidth(22));
        expect(right[0].width).toEqual(cellWidth(22));
    });

    it('expect a field that is not in the layout to be skipped, and a TypeError for what is no list of fields', async () => {
        const { gridInterface } = await mountGrid(config(), data(), fields());

        gridInterface.fitColumns(['phone']);
        expect(widths(gridInterface).company).toEqual(100);

        // a field name on its own would be a list of its letters
        expect(() => gridInterface.fitColumns('company' as any)).toThrow(TypeError);
        expect(() => gridInterface.fitColumns([1] as any)).toThrow(/fields is an array of field names/);
        expect(() => gridInterface.fitColumns(['company'], { rows: {} } as any)).toThrow(/options.rows is an array/);
        expect(() => gridInterface.fitColumns(['company'], true as any)).toThrow(/options object/);
    });

    it('expect it to rebuild the grid once', async () => {
        const { element, gridInterface } = await mountGrid(config(), data(), fields());
        const rebuild = vi.spyOn(gridOf(element), 'rebuild');

        gridInterface.fitColumns();

        expect(rebuild).toHaveBeenCalledTimes(1);
        const header = element.querySelector('.simple-html-grid-header-row-container-pinned-middle > .simple-html-grid-col');
        expect((header as HTMLElement).style.width).toEqual(`${cellWidth(22)}px`);
    });

    it('expect nothing before the interface is connected to an element', () => {
        const datasource = new Datasource(fields());
        datasource.setData(data());
        const gridInterface = new GridInterface(config(), datasource);

        gridInterface.fitColumns();

        expect(widths(gridInterface).company).toEqual(100);
    });

    it('expect autoResizeColumns() to be fitColumns()', async () => {
        const { gridInterface } = await mountGrid(config(), data(), fields());

        gridInterface.autoResizeColumns();

        expect(widths(gridInterface).company).toEqual(cellWidth(22));
        expect(widths(gridInterface).notes).toEqual(multilineWidth(25));
    });

    it('expect the longest texts, each once, longest first: the ones measured', () => {
        const longest = longestTexts(3);
        for (const text of ['bb', '', 'a', 'dddd', 'bb', 'ccc', 'eeeee', 'ff', 'dddd']) {
            longest.add(text);
        }
        expect(longest.texts).toEqual(['eeeee', 'dddd', 'ccc']);
    });
});

describe('resetColumnWidths', () => {
    it('expect the widths of the config back, of the columns given or of every column', async () => {
        const { gridInterface } = await mountGrid(config(), data(), fields());
        gridInterface.fitColumns();

        gridInterface.resetColumnWidths(['notes']);
        expect(widths(gridInterface).notes).toEqual(100);
        expect(widths(gridInterface).company).toEqual(cellWidth(22));

        gridInterface.resetColumnWidths();
        expect(widths(gridInterface)).toEqual({ name: 100, company: 100, notes: 100, age: 100, active: 100 });
    });

    it('expect the widths of initialState.layout when the config has one', async () => {
        const start = { left: [], center: [{ fields: ['company', 'notes'], width: 333 }], right: [] };
        const { gridInterface } = await mountGrid(config({ initialState: { layout: start } }), data(), fields());
        gridInterface.fitColumns();

        gridInterface.resetColumnWidths();

        expect(widths(gridInterface)).toEqual({ company: 333 });
    });

    it('expect a moved column to stay where it is, and a column added later to get 100px', async () => {
        const { gridInterface } = await mountGrid(config(), data(), fields());
        const state = gridInterface.getState();
        // notes first, and the phone column the user added from the column chooser
        state.layout.center = [
            { fields: ['notes'], width: 300 },
            { fields: ['company'], width: 50 },
            { fields: ['phone'], width: 250 }
        ];
        gridInterface.setState({ layout: state.layout });

        gridInterface.resetColumnWidths();

        expect(gridInterface.getState().layout.center).toEqual([
            { fields: ['notes'], width: 100 },
            { fields: ['company'], width: 100 },
            { fields: ['phone'], width: 100 }
        ]);
    });

    it('expect a TypeError for what is no list of fields', async () => {
        const { gridInterface } = await mountGrid(config(), data(), fields());
        expect(() => gridInterface.resetColumnWidths('notes' as any)).toThrow(TypeError);
    });
});

describe('the resize handle', () => {
    it('expect a double click on it to fit its column: middle, pinned left and pinned right', async () => {
        const { element, gridInterface } = await mountGrid(config(), data(), fields());

        resizeHandle(element, 0).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        resizeHandle(element, 0, 'left').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        resizeHandle(element, 0, 'right').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

        expect(widths(gridInterface)).toEqual({
            name: cellWidth(11),
            company: cellWidth(22),
            notes: 100,
            age: 100,
            active: labelWidth(2)
        });
    });

    it('expect a press that does not resize to keep the header: the second click of a double click is on the same handle', async () => {
        const { element, gridInterface } = await mountGrid(config(), data(), fields());
        const rebuild = vi.spyOn(gridOf(element), 'rebuild');
        const handle = resizeHandle(element, 0);

        handle.dispatchEvent(pointerEvent('pointerdown', { clientX: 100 }));
        handle.dispatchEvent(pointerEvent('pointerup', { clientX: 100 }));

        expect(rebuild).not.toHaveBeenCalled();
        expect(resizeHandle(element, 0)).toBe(handle);
        expect(widths(gridInterface).company).toEqual(100);
    });
});

describe('the menus', () => {
    it('expect the header menu to fit the column, every column, and reset them', async () => {
        const { element, gridInterface } = await mountGrid(config(), data(), fields());

        openLabelMenu(element, 'company');
        menuItemsExact('Fit column width')[0].click();
        expect(widths(gridInterface)).toEqual({ name: 100, company: cellWidth(22), notes: 100, age: 100, active: 100 });

        openLabelMenu(element, 'company');
        menuItemsExact('Fit all columns')[0].click();
        expect(widths(gridInterface).notes).toEqual(multilineWidth(25));

        openLabelMenu(element, 'company');
        menuItemsExact('Reset column width')[0].click();
        expect(widths(gridInterface).company).toEqual(100);
        expect(widths(gridInterface).notes).toEqual(multilineWidth(25));

        openLabelMenu(element, 'company');
        menuItemsExact('Reset all column widths')[0].click();
        expect(widths(gridInterface)).toEqual({ name: 100, company: 100, notes: 100, age: 100, active: 100 });
    });

    it('expect the row menu to fit the column to the cell right clicked', async () => {
        const { element, gridInterface } = await mountGrid(
            config({ columns: { company: { label: 'A label much longer than the values' } } }),
            data(),
            fields()
        );

        // the second row: Globex
        openRowMenu(element, 'company', 1);
        menuItemsExact('Fit column to this cell')[0].click();

        expect(widths(gridInterface).company).toEqual(cellWidth('Globex'.length));
    });
});
