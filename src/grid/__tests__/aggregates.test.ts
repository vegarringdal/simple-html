// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatasourceOptions } from '../../datasource/datasourceOptions';
import { isGroupRow } from '../../datasource/entity';
import { where } from '../../datasource/filterExpression';
import type { GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import { GridInterface } from '../gridInterface';
import { mountGrid, shownRowElements, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { menuEntry, openLabelMenu, openRowMenu } from './interactionTestHelpers';

/**
 * Aggregates in the grid (ColumnConfig.aggregate): a cell per aggregate in the place of its field in
 * every group row (GridConfig.groupAggregates, on by default) and in the totals row under the rows
 * (GridConfig.totalsRow). The values are the datasource's, aggregate.test.ts there tests them - here:
 * where the cells are, what they show, that they follow edits, filters and the horizontal scroll, and
 * that a wrong config throws.
 *
 * happy-dom does no layout: the places are the styles the grid writes. The real browser check lines the
 * cells up with the header columns.
 */

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

const rows = () => [
    { id: 1, name: 'Ann', country: 'Norway', city: 'Oslo', age: 30, balance: 10.5, score: 3, email: 'a@x.no' },
    { id: 2, name: 'Bob', country: 'Norway', city: 'Bergen', age: 40, balance: 2, score: 8, email: null },
    { id: 3, name: 'Cid', country: 'Sweden', city: 'Lund', age: 50, balance: -4, score: 5, email: 'c@x.se' },
    { id: 4, name: 'Dan', country: 'Sweden', city: 'Malmo', age: 21, balance: null, score: 1, email: 'd@x.se' }
];

// balance with a comma: the cells show the field's formatter
const fields = (): DatasourceOptions => ({
    key: 'id',
    fields: { id: 'number', age: 'number', balance: { type: 'number', formatter: 'numberComma' }, score: 'number' }
});

/**
 * a pinned column on each side, a column of two fields in the middle: name | country, city+age,
 * balance, email | score
 */
const config = (options: Partial<GridConfig> = {}): GridConfig => ({
    readonly: false,
    columns: {
        age: { aggregate: 'avg' },
        balance: { aggregate: 'sum' },
        email: { aggregate: 'count' },
        score: { aggregate: 'max' }
    },
    layout: {
        left: [{ fields: ['name'], width: 120 }],
        center: [
            { fields: ['country'], width: 100 },
            { fields: ['city', 'age'], width: 90 },
            { fields: ['balance'], width: 110 },
            { fields: ['email'], width: 150 }
        ],
        right: [{ fields: ['score'], width: 80 }]
    },
    ...options
});

const mount = (options: Partial<GridConfig> = {}, data = rows()) => mountGrid(config(options), data, fields());

/** waits for the grid's animation frame: the rows-changed microtask asks for it first */
const frame = async () => {
    await Promise.resolve();
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
};

/** the row elements of the group section that show a group row, in the order of the rows */
const groupRowElements = (element: GridElement) => shownRowElements(element, 'group');

/** the aggregate cell of a function and field in an element: `sum:balance` */
const aggregateCell = (parent: Element, key: string) => parent.querySelector(`[data-aggregate="${key}"]`) as HTMLElement;

/** what an aggregate cell shows, the label and the value */
const textOf = (cell: Element | null) => cell?.textContent?.replace(/\s+/g, ' ').trim();

/** the group row element of a group, by the start of its name */
function groupRow(element: GridElement, name: string) {
    return groupRowElements(element).find((row) =>
        row.querySelector('.simple-html-grid-group-name')?.textContent?.includes(name)
    ) as HTMLElement;
}

const totalsRow = (element: GridElement) => element.querySelector('.simple-html-grid-totals') as HTMLElement;

describe('aggregates - group rows', () => {
    it('expect each aggregate in its group row, formatted with the field formatter, and the name still shown', async () => {
        const { element, datasource } = await mount();
        datasource.group([{ attribute: 'country', title: 'Country' }]);

        const norway = groupRow(element, 'Country: Norway');
        expect(textOf(norway.querySelector('.simple-html-grid-group-name'))).toContain('Country: Norway (2)');
        expect(textOf(aggregateCell(norway, 'sum:balance'))).toEqual('Sum 12,5');
        expect(textOf(aggregateCell(norway, 'avg:age'))).toEqual('Avg Age 35');
        expect(textOf(aggregateCell(norway, 'count:email'))).toEqual('Count 1');
        expect(textOf(aggregateCell(norway, 'max:score'))).toEqual('Max 8');

        const sweden = groupRow(element, 'Country: Sweden');
        expect(textOf(aggregateCell(sweden, 'sum:balance'))).toEqual('Sum -4');
        expect(textOf(aggregateCell(sweden, 'avg:age'))).toEqual('Avg Age 35.5');
        expect(textOf(aggregateCell(sweden, 'count:email'))).toEqual('Count 2');
    });

    it('expect the cells at the left and with the width of their columns, in their sections', async () => {
        const { element, datasource } = await mount();
        datasource.group([{ attribute: 'country', title: 'Country' }]);
        const norway = groupRow(element, 'Country: Norway');

        const place = (key: string) => {
            const cell = aggregateCell(norway, key);
            return { section: cell.parentElement?.parentElement?.className, left: cell.style.left, width: cell.style.width };
        };
        // the middle's cells are in an element that is moved by the horizontal scroll
        expect(place('sum:balance')).toEqual({ section: 'simple-html-grid-aggregates-middle', left: '190px', width: '110px' });
        expect(place('avg:age')).toEqual({ section: 'simple-html-grid-aggregates-middle', left: '100px', width: '90px' });
        expect(place('count:email')).toEqual({ section: 'simple-html-grid-aggregates-middle', left: '300px', width: '150px' });
        const score = aggregateCell(norway, 'max:score');
        expect(score.parentElement?.className).toEqual('simple-html-grid-aggregates-right');
        expect([score.style.left, score.style.width]).toEqual(['0px', '80px']);

        // the sections have the places of the body's: the left one is the left pinned columns and the
        // grouping column (15px a level), the right one the right pinned columns
        const left = norway.querySelector('.simple-html-grid-aggregates-left') as HTMLElement;
        const middle = norway.querySelector('.simple-html-grid-aggregates-middle') as HTMLElement;
        const right = norway.querySelector('.simple-html-grid-aggregates-right') as HTMLElement;
        expect(left.style.width).toEqual('135px');
        expect([middle.style.left, middle.style.right]).toEqual(['135px', '80px']);
        expect(right.style.width).toEqual('80px');
    });

    it('expect an aggregate in the left pinned section after the grouping column', async () => {
        const { element, datasource } = await mount({ columns: { ...config().columns, name: { aggregate: 'count' } } });
        datasource.group([
            { attribute: 'country', title: 'Country' },
            { attribute: 'city', title: 'City' }
        ]);
        const norway = groupRow(element, 'Country: Norway');

        const name = aggregateCell(norway, 'count:name');
        expect(name.parentElement?.className).toEqual('simple-html-grid-aggregates-left');
        // two grouping levels: the left pinned columns start at 30px
        expect([name.style.left, name.style.width]).toEqual(['30px', '120px']);
        expect(textOf(name)).toEqual('Count 2');
    });

    it('expect the name on a line of its own and the aggregates under it: the group rows 1 + n lines high', async () => {
        const { element, datasource, gridInterface } = await mount();
        datasource.group([{ attribute: 'country', title: 'Country' }]);
        datasource.expandGroup();

        // every column has one function: the name's line and one line of aggregates, as high as the
        // data rows (city+age stacks two fields)
        const norway = groupRow(element, 'Country: Norway');
        const name = norway.querySelector('.simple-html-grid-group-name') as HTMLElement;
        expect(name.style.height).toEqual('22px');
        expect(aggregateCell(norway, 'avg:age').style.top).toEqual('22px');
        expect(aggregateCell(norway, 'sum:balance').style.top).toEqual('22px');
        expect(gridInterface.__getScrollState().scrollHeights).toEqual([44, 44, 44, 44, 44, 44]);
        expect(norway.style.height).toEqual('44px');

        // sum and avg of balance: three lines, the functions one under the other
        gridInterface.updateConfig({ columns: { ...config().columns, balance: { aggregate: ['avg', 'sum'] } } });
        const again = groupRow(element, 'Country: Norway');
        expect(aggregateCell(again, 'sum:balance').style.top).toEqual('22px');
        expect(aggregateCell(again, 'avg:balance').style.top).toEqual('44px');
        expect(gridInterface.__getScrollState().scrollHeights).toEqual([66, 44, 44, 66, 44, 44]);

        // without aggregates one line again
        gridInterface.updateConfig({ columns: {} });
        expect(gridInterface.__getScrollState().scrollHeights).toEqual([22, 44, 44, 22, 44, 44]);
    });

    it('expect each line the label at the left and the value at the right, a field label in a stacked column', async () => {
        const { element, datasource } = await mount();
        datasource.group([{ attribute: 'country', title: 'Country' }]);
        const norway = groupRow(element, 'Country: Norway');

        const balance = aggregateCell(norway, 'sum:balance');
        const spans = Array.from(balance.querySelectorAll('span')).map((span) => [span.className, span.textContent?.trim()]);
        expect(spans).toEqual([
            ['simple-html-grid-aggregate-label', 'Sum'],
            ['simple-html-grid-aggregate-value', '12,5']
        ]);
        // age shares its column with city: its label says which field it is
        expect(textOf(aggregateCell(norway, 'avg:age'))).toEqual('Avg Age 35');
    });

    it('expect one gridcell per field for a screen reader, named with all its lines', async () => {
        const { element, datasource, gridInterface } = await mount();
        gridInterface.updateConfig({ columns: { ...config().columns, balance: { aggregate: ['sum', 'max'] } } });
        datasource.group([{ attribute: 'country', title: 'Country' }]);
        const norway = groupRow(element, 'Country: Norway');

        const sum = aggregateCell(norway, 'sum:balance');
        const max = aggregateCell(norway, 'max:balance');
        expect([sum.getAttribute('role'), sum.getAttribute('aria-label')]).toEqual(['gridcell', 'Sum 12,5, Max 10,5']);
        expect([max.getAttribute('role'), max.getAttribute('aria-hidden')]).toEqual(['none', 'true']);
    });

    it('expect a group row over all its rows: its sub groups, collapsed ones included', async () => {
        const { element, datasource } = await mount();
        datasource.group([
            { attribute: 'country', title: 'Country' },
            { attribute: 'city', title: 'City' }
        ]);
        // collapsed: only the country groups are shown
        expect(datasource.getRows().every(isGroupRow)).toBe(true);
        expect(textOf(aggregateCell(groupRow(element, 'Country: Sweden'), 'max:score'))).toEqual('Max 5');

        datasource.expandGroup('Sweden-Lund');
        expect(textOf(aggregateCell(groupRow(element, 'City: Lund'), 'sum:balance'))).toEqual('Sum -4');
    });

    it('expect a sum of 0 for a group without numbers, an empty cell for its average', async () => {
        const { element, datasource, gridInterface } = await mount();
        datasource.group([{ attribute: 'city', title: 'City' }]);

        // Malmo's one balance is blank
        expect(textOf(aggregateCell(groupRow(element, 'City: Malmo'), 'sum:balance'))).toEqual('Sum 0');

        gridInterface.updateConfig({ columns: { ...config().columns, balance: { aggregate: 'avg' } } });
        const cell = aggregateCell(groupRow(element, 'City: Malmo'), 'avg:balance');
        expect(textOf(cell)).toEqual('');
        // still the cell of its column, for a screen reader
        expect(cell.getAttribute('role')).toEqual('gridcell');
    });

    it('expect groupAggregates: false to show the name only, one cell over the columns as without aggregates', async () => {
        const { element, datasource } = await mount({ groupAggregates: false });
        datasource.group([{ attribute: 'country', title: 'Country' }]);

        const norway = groupRowElements(element)[0];
        expect(norway.querySelector('.simple-html-grid-aggregate')).toBeNull();
        const cell = norway.querySelector('[role="gridcell"]') as HTMLElement;
        // the 7 fields of the layout
        expect(cell.getAttribute('aria-colspan')).toEqual('7');
        expect(textOf(cell)).toEqual('Country: Norway (2)');
    });

    it('expect the group rows to follow an edit from code in the next frame', async () => {
        const { element, datasource } = await mount();
        datasource.group([{ attribute: 'country', title: 'Country' }]);
        const norway = () => groupRow(element, 'Country: Norway');

        datasource.getAllData()[0].balance = 100;
        // not before the frame: the grid renders changes once per frame
        expect(textOf(aggregateCell(norway(), 'sum:balance'))).toEqual('Sum 12,5');
        await frame();
        expect(textOf(aggregateCell(norway(), 'sum:balance'))).toEqual('Sum 102');

        datasource.undo();
        await frame();
        expect(textOf(aggregateCell(norway(), 'sum:balance'))).toEqual('Sum 12,5');

        datasource.upsert([{ id: 2, score: 9 }]);
        await frame();
        expect(textOf(aggregateCell(norway(), 'max:score'))).toEqual('Max 9');
    });
});

describe('aggregates - the totals row', () => {
    it('expect no totals row by default', async () => {
        const { element } = await mount();

        expect(totalsRow(element).style.display).toEqual('none');
        expect(totalsRow(element).children.length).toBe(0);
    });

    it('expect "Total" and each aggregate over the rows the filter lets through, formatted', async () => {
        const { element } = await mount({ totalsRow: true });
        const totals = totalsRow(element);

        expect(totals.style.display).toEqual('block');
        expect(textOf(totals.querySelector('.simple-html-grid-totals-label'))).toEqual('Total');
        expect(textOf(aggregateCell(totals, 'sum:balance'))).toEqual('Sum 8,5');
        expect(textOf(aggregateCell(totals, 'avg:age'))).toEqual('Avg Age 35.25');
        expect(textOf(aggregateCell(totals, 'count:email'))).toEqual('Count 3');
        expect(textOf(aggregateCell(totals, 'max:score'))).toEqual('Max 8');
    });

    it('expect the cells in the places of their columns, the label as wide as the row numbers', async () => {
        const { element, gridInterface } = await mount({ totalsRow: true });
        const totals = totalsRow(element);
        const config = gridInterface.__getGridConfig();

        expect((totals.querySelector('.simple-html-grid-totals-label') as HTMLElement).style.width).toEqual(
            `${config.__selectSizeWidth}px`
        );
        expect((totals.querySelector('.simple-html-grid-totals-cells') as HTMLElement).style.left).toEqual(
            `${config.__selectSizeWidth}px`
        );
        // not grouped: no grouping column in the left section
        expect((totals.querySelector('.simple-html-grid-aggregates-left') as HTMLElement).style.width).toEqual('120px');
        expect(aggregateCell(totals, 'sum:balance').style.left).toEqual('190px');
        // the lines are the column's functions from the top: age's average is on the first line, and
        // says which field it is - its column stacks city and age
        expect(aggregateCell(totals, 'avg:age').style.top).toEqual('0px');
        expect(textOf(aggregateCell(totals, 'avg:age'))).toEqual('Avg Age 35.25');
    });

    it('expect the rows to end above it, the horizontal scrollbar between them', async () => {
        const { element } = await mount({ totalsRow: true, footerHeight: 40 });
        const style = (className: string) => (element.querySelector(`.${className}`) as HTMLElement).style;

        // one line (every column has one function) and the scrollbar band of 10px
        expect(style('simple-html-grid-totals').height).toEqual('32px');
        expect(style('simple-html-grid-totals').bottom).toEqual('40px');
        expect(style('simple-html-grid-body').bottom).toEqual('72px');
        expect(style('simple-html-grid-body-scroller').bottom).toEqual('72px');
        expect(style('simple-html-grid-middle-scroller').bottom).toEqual('62px');
        expect(style('simple-html-grid-footer').height).toEqual('40px');
    });

    it('expect the rows to fill the room again when it is turned off', async () => {
        const { element, gridInterface } = await mount({ totalsRow: true, footerHeight: 40 });
        gridInterface.updateConfig({ totalsRow: false });

        expect(totalsRow(element).style.display).toEqual('none');
        expect((element.querySelector('.simple-html-grid-body') as HTMLElement).style.bottom).toEqual('40px');
        expect((element.querySelector('.simple-html-grid-middle-scroller') as HTMLElement).style.bottom).toEqual('30px');
    });

    it('expect the totals to follow a filter, and not to change with a sort or a grouping', async () => {
        const { element, datasource } = await mount({ totalsRow: true });
        const sum = () => textOf(aggregateCell(totalsRow(element), 'sum:balance'));

        datasource.filter(where('country', 'EQUAL', 'Sweden'));
        expect(sum()).toEqual('Sum -4');

        datasource.sort({ attribute: 'balance', ascending: false });
        expect(sum()).toEqual('Sum -4');

        // grouped and collapsed: every row the filter lets through
        datasource.group([{ attribute: 'city', title: 'City' }]);
        datasource.collapseGroup();
        expect(sum()).toEqual('Sum -4');

        datasource.filter(null);
        expect(sum()).toEqual('Sum 8,5');
    });

    it('expect the totals to follow an edit from code, undo and an upsert in the next frame', async () => {
        const { element, datasource } = await mount({ totalsRow: true });
        const sum = () => textOf(aggregateCell(totalsRow(element), 'sum:balance'));

        datasource.getAllData()[3].balance = 1.5;
        await frame();
        expect(sum()).toEqual('Sum 10');

        datasource.undo();
        await frame();
        expect(sum()).toEqual('Sum 8,5');

        datasource.upsert([{ id: 1, balance: 0.5 }]);
        await frame();
        expect(sum()).toEqual('Sum -1,5');
    });

    it('expect the totals to follow a value set in the frame that renders every row: the focus left a cell', async () => {
        const { element, datasource } = await mount({ totalsRow: true });
        const sum = () => textOf(aggregateCell(totalsRow(element), 'sum:balance'));
        // the balance of the first row: Ann's 10.5
        const input = element.querySelector('.cellpos-middle-pinned-0-2-0') as HTMLInputElement;

        input.focus();
        input.value = '20.';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await frame();
        expect(sum()).toEqual('Sum 18');

        // the focus leaves the cell typed in: the next frame renders every row on screen. A value set
        // from code before it is rendered in that frame, the totals with it
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.blur();
        datasource.getAllData()[1].balance = 12;
        await frame();
        expect(sum()).toEqual('Sum 28');
    });

    it('expect the totals of a new row and a removed one', async () => {
        const { element, datasource } = await mount({ totalsRow: true });
        const count = () => textOf(aggregateCell(totalsRow(element), 'count:email'));

        datasource.addNewEmpty({ email: 'e@x.no' }, { scrollTo: false });
        expect(count()).toEqual('Count 4');

        datasource.removeData(datasource.getAllData()[0]);
        expect(count()).toEqual('Count 3');
    });

    it('expect an empty cell for the average of no numbers', async () => {
        const { element, datasource } = await mount({ totalsRow: true });
        datasource.filter(where('country', 'EQUAL', 'nowhere'));

        expect(textOf(aggregateCell(totalsRow(element), 'avg:age'))).toEqual('');
        expect(textOf(aggregateCell(totalsRow(element), 'sum:balance'))).toEqual('Sum 0');
    });
});

describe('aggregates - the horizontal scroll', () => {
    /** 20 columns of 100px in the middle, the stub viewport is 1000px: the middle scrolls */
    const wide = (): Partial<GridConfig> => ({
        columns: { f15: { aggregate: 'count' } },
        layout: { center: Array.from({ length: 20 }, (_, i) => ({ fields: [`f${i}`], width: 100 })) },
        totalsRow: true
    });
    const wideData = () =>
        Array.from({ length: 4 }, (_, row) => ({
            id: row + 1,
            g: row % 2 ? 'a' : 'b',
            ...Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`f${i}`, `r${row}c${i}`]))
        }));

    it('expect the middle cells of the group rows and the totals row to move with the middle columns', async () => {
        const { element, datasource } = await mountGrid({ ...config(), ...wide() }, wideData(), { key: 'id' });
        datasource.group([{ attribute: 'g', title: 'G' }]);
        const scroller = element.querySelector('.simple-html-grid-middle-scroller') as HTMLElement;
        const groupView = element.querySelector('.simple-html-grid-body-view-group') as HTMLElement;
        const moved = (container: HTMLElement) =>
            (aggregateCell(container, 'count:f15').parentElement as HTMLElement).style.transform;

        // moved by the variable the scroll sets
        expect(moved(groupRowElements(element)[0])).toEqual('translateX(var(--simple-html-grid-scroll-left, 0px))');
        expect(moved(totalsRow(element))).toEqual('translateX(var(--simple-html-grid-scroll-left, 0px))');
        expect(aggregateCell(totalsRow(element), 'count:f15').style.left).toEqual('1500px');

        scroller.scrollLeft = 700;
        scroller.dispatchEvent(new Event('scroll'));

        expect(groupView.style.getPropertyValue('--simple-html-grid-scroll-left')).toEqual('-700px');
        expect(totalsRow(element).style.getPropertyValue('--simple-html-grid-scroll-left')).toEqual('-700px');

        // a group row rendered after the scroll is in the same element: it is moved too
        datasource.expandGroup();
        expect(groupView.style.getPropertyValue('--simple-html-grid-scroll-left')).toEqual('-700px');
        expect(textOf(aggregateCell(totalsRow(element), 'count:f15'))).toEqual('Count 4');
    });

    it('expect them to stop where the columns end, as the middle view of the rows does', async () => {
        const { element } = await mountGrid({ ...config(), ...wide() }, wideData(), { key: 'id' });
        const scroller = element.querySelector('.simple-html-grid-middle-scroller') as HTMLElement;

        // 2000px of columns in a view of 1000px (the stub): it scrolls 1000px at most. The scroller can
        // go further in a browser, its vertical scrollbar makes it narrower than the view
        scroller.scrollLeft = 1010;
        scroller.dispatchEvent(new Event('scroll'));

        expect(totalsRow(element).style.getPropertyValue('--simple-html-grid-scroll-left')).toEqual('-1000px');
    });
});

describe('aggregates - the config', () => {
    const datasourceOf = async () => (await mount()).datasource;

    it('expect an aggregate that is no function to throw a TypeError', async () => {
        const datasource = await datasourceOf();

        expect(() => new GridInterface(config({ columns: { age: { aggregate: 'total' as any } } }), datasource)).toThrow(
            new TypeError(
                "GridConfig: columns.age.aggregate is \"total\", it is one of 'sum', 'avg', 'min', 'max', 'count' or a list of them"
            )
        );
    });

    it('expect sum, avg, min and max on a field that is not a number to throw a TypeError', async () => {
        const datasource = await datasourceOf();

        for (const fn of ['sum', 'avg', 'min', 'max'] as const) {
            expect(() => new GridInterface(config({ columns: { name: { aggregate: fn } } }), datasource)).toThrow(
                new TypeError(
                    `GridConfig: columns.name.aggregate '${fn}' is for a number field, 'name' is text: new Datasource({ fields: { name: 'number' } }), or 'count'`
                )
            );
        }
        // count is for any field
        expect(() => new GridInterface(config({ columns: { name: { aggregate: 'count' } } }), datasource)).not.toThrow();
    });

    it('expect updateConfig() to check the columns it is given, and change nothing when it throws', async () => {
        const { gridInterface, element, datasource } = await mount();
        datasource.group([{ attribute: 'country', title: 'Country' }]);

        expect(() => gridInterface.updateConfig({ columns: { country: { aggregate: 'sum' } } })).toThrow(TypeError);
        expect(textOf(aggregateCell(groupRowElements(element)[0], 'sum:balance'))).toEqual('Sum 12,5');

        gridInterface.updateConfig({ columns: { country: { aggregate: 'count' } } });
        expect(textOf(aggregateCell(groupRowElements(element)[0], 'count:country'))).toEqual('Count 2');
        expect(aggregateCell(groupRowElements(element)[0], 'sum:balance')).toBeNull();
    });

    it('expect the options in the parsed config with their defaults: group aggregates on, the totals row off', async () => {
        const { gridInterface } = await mount();
        const parsed = gridInterface.__getGridConfig();

        expect([parsed.groupAggregates, parsed.totalsRow]).toEqual([true, false]);
        expect(parsed.__totalsRowHeight).toBe(0);
        expect(parsed.__groupRowHeight).toBe(44);
    });
});

describe('aggregates - the state', () => {
    it('expect getState() to have the aggregates of the config and whether the totals row is shown', async () => {
        const { gridInterface } = await mount({ totalsRow: true });

        const state = gridInterface.getState();

        expect(state.aggregates).toEqual({ age: ['avg'], balance: ['sum'], email: ['count'], score: ['max'] });
        expect(state.totalsRow).toBe(true);
    });

    it('expect setState() to apply them: the functions listed, the other fields none', async () => {
        const { element, datasource, gridInterface } = await mount();
        datasource.group([{ attribute: 'country', title: 'Country' }]);

        gridInterface.setState({ aggregates: { balance: ['sum', 'min'] }, totalsRow: true });

        const norway = groupRow(element, 'Country: Norway');
        expect(aggregateCell(norway, 'min:balance')).not.toBeNull();
        expect(aggregateCell(norway, 'avg:age')).toBeNull();
        expect(gridInterface.__getGridConfig().__totalsRowHeight).toEqual(44);
        expect(gridInterface.getState().aggregates).toEqual({ balance: ['sum', 'min'] });
    });

    it('expect resetState() to go back to the config, and a state to round-trip as JSON', async () => {
        const { gridInterface } = await mount();
        const saved = JSON.parse(JSON.stringify(gridInterface.getState()));
        gridInterface.setState({ aggregates: {}, totalsRow: true });

        gridInterface.resetState();
        expect(gridInterface.getState().aggregates).toEqual(saved.aggregates);
        expect(gridInterface.getState().totalsRow).toBe(false);

        gridInterface.setState({ aggregates: { score: ['count'] } });
        gridInterface.setState(saved);
        expect(gridInterface.getState()).toEqual(saved);
    });

    it('expect a wrong function in the state to throw a TypeError and change nothing', async () => {
        const { gridInterface } = await mount();

        expect(() => gridInterface.setState({ aggregates: { email: ['sum'] } })).toThrow(
            new TypeError(
                "setState: aggregates.email 'sum' is for a number field, 'email' is text: new Datasource({ fields: { email: 'number' } }), or 'count'"
            )
        );
        expect(gridInterface.getState().aggregates.email).toEqual(['count']);
    });

    it('expect the totals row the user turned on to stay through an updateConfig() without totalsRow', async () => {
        const { gridInterface } = await mount();
        gridInterface.setState({ totalsRow: true });

        gridInterface.updateConfig({ readonly: true });
        expect(gridInterface.getState().totalsRow).toBe(true);

        gridInterface.updateConfig({ totalsRow: false });
        expect(gridInterface.getState().totalsRow).toBe(false);
    });
});

describe('aggregates - the header menu', () => {
    // in the aggregate submenu, opened on the way
    const entry = (id: string) => menuEntry(id) as HTMLElement | null;
    const isChecked = (id: string) => !!entry(id)?.classList.contains('simple-html-grid-menu-item-selected');

    it('expect a toggle for each function on a number column, the ones on checked', async () => {
        const { element } = await mount();
        openLabelMenu(element, 'balance');

        expect(['sum', 'avg', 'min', 'max', 'count'].map((fn) => !!entry(`header.aggregate.${fn}`))).toEqual([
            true,
            true,
            true,
            true,
            true
        ]);
        expect(isChecked('header.aggregate.sum')).toBe(true);
        expect(isChecked('header.aggregate.avg')).toBe(false);
    });

    it('expect count only on a column that is not a number', async () => {
        const { element } = await mount();
        openLabelMenu(element, 'email');

        expect(['sum', 'avg', 'min', 'max'].map((fn) => entry(`header.aggregate.${fn}`))).toEqual([null, null, null, null]);
        expect(isChecked('header.aggregate.count')).toBe(true);
    });

    it('expect a click to turn a function on and off, in the state, the group rows growing a line', async () => {
        const { element, datasource, gridInterface } = await mount();
        datasource.group([{ attribute: 'country', title: 'Country' }]);

        openLabelMenu(element, 'balance');
        entry('header.aggregate.avg')?.click();
        expect(gridInterface.getState().aggregates.balance).toEqual(['sum', 'avg']);
        expect(gridInterface.__getGridConfig().__groupRowHeight).toEqual(66);
        expect(aggregateCell(groupRow(element, 'Country: Norway'), 'avg:balance')).not.toBeNull();

        openLabelMenu(element, 'balance');
        entry('header.aggregate.sum')?.click();
        expect(gridInterface.getState().aggregates.balance).toEqual(['avg']);
    });

    it('expect the totals row toggle', async () => {
        const { element, gridInterface } = await mount();

        openLabelMenu(element, 'balance');
        expect(isChecked('header.aggregate.totalsRow')).toBe(false);
        entry('header.aggregate.totalsRow')?.click();

        expect(gridInterface.getState().totalsRow).toBe(true);
        expect(textOf(totalsRow(element).querySelector('.simple-html-grid-totals-label'))).toEqual('Total');
    });
});

describe('aggregates - the row menu summary', () => {
    /** the summary of a number column over the selected rows, its entries by id */
    async function summary(values: (number | null)[]) {
        const data = values.map((value, i) => ({ id: i + 1, name: `n${i}`, value }));
        const { element, datasource } = await mountGrid(
            {
                layout: {
                    center: [
                        { fields: ['name'], width: 100 },
                        { fields: ['value'], width: 100 }
                    ]
                }
            },
            data,
            { key: 'id', fields: { value: 'number' } }
        );
        datasource.selectAll();
        openRowMenu(element, 'value', 0);
        // in the summary submenu, opened on the way
        const label = (id: string) => textOf(menuEntry(`row.summary.${id}`));
        return { count: label('count'), sum: label('sum'), max: label('max'), min: label('min'), avg: label('avg') };
    }

    it('expect the largest of negative numbers to be negative, not 0', async () => {
        expect((await summary([-5, -3])).max).toEqual('Max: -3');
    });

    it('expect 0 to be the smallest value, not skipped', async () => {
        expect((await summary([0, 5])).min).toEqual('Min: 0');
    });

    it('expect the average not rounded to a whole number', async () => {
        expect((await summary([1, 2])).avg).toEqual('Avg: 1.5');
    });

    it('expect the average of the numbers only: a blank is not counted', async () => {
        expect((await summary([1, 2, null])).avg).toEqual('Avg: 1.5');
    });

    it('expect the rest as before: the count of the selected rows, the values with two decimals at most', async () => {
        const shown = await summary([1.5, 2.25, null]);

        expect({ count: shown.count, sum: shown.sum, max: shown.max, min: shown.min }).toEqual({
            count: 'Count: 3',
            sum: 'Sum: 3.75',
            max: 'Max: 2.25',
            min: 'Min: 1.5'
        });
        // 1.875, the average of the two numbers
        expect(shown.avg).toEqual('Avg: 1.88');
    });

    it('expect a click on an entry to copy its value', async () => {
        const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
        await summary([-5, -3]);

        const max = menuEntry('row.summary.max');
        expect(textOf(max)).toEqual('Max: -3');
        max.click();
        expect(writeText).toHaveBeenCalledWith('-3');
    });
});
