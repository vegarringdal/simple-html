// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { isGroupRow } from '../../datasource/entity';
import type { GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import { type MountedGrid, mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';

/**
 * The virtual rows and columns while scrolling: verticalScrollHandler and horizontalScrollHandler.
 *
 * The row and column elements are a pool reused while scrolling, so these tests read the grid the
 * way the user sees it - which row each shown row element is at, which column each shown column
 * element is at, and what its cells show - and compare it with what should be on screen, worked
 * out here from the sizes alone:
 *
 * - the rows: every row that starts inside the viewport, and the one before the first of them
 *   (partly on screen)
 * - the middle columns: every column that starts inside the viewport, and the one before the first
 *   of them. The left and right pinned columns are always all shown
 *
 * happy-dom lays nothing out: stubElementSizes makes every element 600px high and 1000px wide, the
 * viewports of the rows and of the middle columns included. And it does not clamp scrollTop /
 * scrollLeft to the content.
 */

const VIEWPORT_HEIGHT = 600;
const VIEWPORT_WIDTH = 1000;
// the default cellHeight
const CELL_HEIGHT = 22;

/** 40 center columns 60..150px wide (the lefts are no simple multiple), 2 pinned left, 1 pinned right */
const centerWidth = (column: number) => 60 + ((column * 7) % 10) * 10;
const CENTER = 40;

const wideConfig = (stacked = false): GridConfig => ({
    layout: {
        left: [
            { fields: ['id'], width: 80 },
            { fields: ['name'], width: 100 }
        ],
        center: Array.from({ length: CENTER }, (_, c) => ({
            // stacked: two fields in a column, a data row is two cells high and a group row one
            fields: stacked ? [`f${c}`, `g${c}`] : [`f${c}`],
            width: centerWidth(c)
        })),
        right: [{ fields: ['total'], width: 90 }]
    }
});

const wideData = (rows: number) =>
    Array.from({ length: rows }, (_, row) => {
        const data: Record<string, any> = { id: row, name: `n${row}`, total: `t${row}`, group: `group ${Math.floor(row / 10)}` };
        for (let c = 0; c < CENTER; c++) {
            data[`f${c}`] = `r${row}c${c}`;
            data[`g${c}`] = `r${row}g${c}`;
        }
        return data;
    });

const fields = { fields: { id: 'number' as const } };

/** where a column starts in its section, the left offset of the transform */
const lefts = (widths: number[]) => {
    const result: number[] = [];
    let left = 0;
    for (const width of widths) {
        result.push(left);
        left = left + width;
    }
    return result;
};

/** the x and y of a translate3d transform */
const translate = (element: HTMLElement) => {
    const match = /translate3d\(([-\d.]+)px, ([-\d.]+)px/.exec(element.style.transform);
    return match ? { x: Number(match[1]), y: Number(match[2]) } : { x: NaN, y: NaN };
};

const shown = (element: Element) => (element as HTMLElement).style.display !== 'none';

type ScreenColumn = { left: number; width: number; values: string[] };
type ScreenRow = { top: number; height: number; cells: Record<string, ScreenColumn[]> };

/**
 * What the user sees: per row on screen (by its top), the column elements shown in each pinned
 * section, with their left, width and the values of their cells. The row elements of all the
 * sections are read, every section must show the same rows
 */
function screen(element: GridElement) {
    const sections = ['pinned-left', 'pinned-middle', 'pinned-right'];
    const rows = new Map<number, ScreenRow>();
    const rowsPerSection: Record<string, number[]> = {};

    for (const section of ['selector', 'group', ...sections]) {
        const container = element.querySelector(`.simple-html-grid-body-row-container-${section}`) as HTMLElement;
        rowsPerSection[section] = [];
        for (const rowElement of Array.from(container.children) as HTMLElement[]) {
            if (!shown(rowElement)) {
                continue;
            }
            const top = translate(rowElement).y;
            rowsPerSection[section].push(top);
            if (!sections.includes(section)) {
                continue;
            }
            const row = rows.get(top) ?? { top, height: parseFloat(rowElement.style.height), cells: {} };
            rows.set(top, row);
            row.cells[section] = (Array.from(rowElement.querySelectorAll(':scope > .simple-html-grid-col')) as HTMLElement[])
                .filter(shown)
                .map((column) => ({
                    left: translate(column).x,
                    width: parseFloat(column.style.width),
                    values: Array.from(column.querySelectorAll('input[data-attribute]')).map(
                        (input) => (input as HTMLInputElement).value
                    )
                }))
                .sort((a, b) => a.left - b.left);
        }
        rowsPerSection[section].sort((a, b) => a - b);
    }

    // the middle header: left, width and the label of every column element shown
    const header = element.querySelector('.simple-html-grid-header-row-container-pinned-middle') as HTMLElement;
    const headerColumns = (Array.from(header.children) as HTMLElement[])
        .filter(shown)
        .map((column) => ({
            left: translate(column).x,
            width: parseFloat(column.style.width),
            label: column.querySelector('.simple-html-label')?.textContent?.trim()
        }))
        .sort((a, b) => a.left - b.left);

    return {
        rows: Array.from(rows.values()).sort((a, b) => a.top - b.top),
        rowsPerSection,
        headerColumns
    };
}

/**
 * What should be on screen, from the sizes alone
 * @param heights the height of every displayed row
 * @param valuesOf the values of the cells of a column, for a displayed row
 * @param isGroup is a displayed row a group row: only those show in the group section
 * @param groupingWidth grouped, the left pinned columns are moved right by 15px per grouping level
 */
function expectedScreen(
    heights: number[],
    scrollTop: number,
    scrollLeft: number,
    valuesOf: (row: number, field: string) => string[],
    isGroup: (row: number) => boolean,
    groupingWidth = 0
) {
    const tops = lefts(heights);
    // the rows that start inside the viewport, and the one before the first of them
    const inside = tops
        .map((top, row) => ({ top, row }))
        .filter(({ top }) => top >= scrollTop && top < scrollTop + VIEWPORT_HEIGHT);
    let first = inside.length ? inside[0].row - 1 : tops.findLastIndex((top) => top < scrollTop);
    first = Math.max(first, 0);
    const last = inside.length ? inside[inside.length - 1].row : first;

    const widths = Array.from({ length: CENTER }, (_, c) => centerWidth(c));
    const columnLefts = lefts(widths);
    const insideColumns = columnLefts
        .map((left, column) => ({ left, column }))
        .filter(({ left }) => left >= scrollLeft && left < scrollLeft + VIEWPORT_WIDTH);
    const firstColumn = Math.max(
        0,
        insideColumns.length ? insideColumns[0].column - 1 : columnLefts.findLastIndex((l) => l < scrollLeft)
    );
    const lastColumn = insideColumns.length ? insideColumns[insideColumns.length - 1].column : firstColumn;
    const middleColumns = Array.from({ length: lastColumn - firstColumn + 1 }, (_, i) => firstColumn + i);

    const rows: ScreenRow[] = [];
    for (let row = first; row <= last && row < heights.length; row++) {
        rows.push({
            top: tops[row],
            height: heights[row],
            // a group row shows no columns, its own row element (group section) shows it
            cells: isGroup(row)
                ? { 'pinned-left': [], 'pinned-middle': [], 'pinned-right': [] }
                : {
                      'pinned-left': [
                          { left: groupingWidth, width: 80, values: valuesOf(row, 'id') },
                          { left: groupingWidth + 80, width: 100, values: valuesOf(row, 'name') }
                      ],
                      'pinned-middle': middleColumns.map((column) => ({
                          left: columnLefts[column],
                          width: widths[column],
                          values: valuesOf(row, `${column}`)
                      })),
                      'pinned-right': [{ left: 0, width: 90, values: valuesOf(row, 'total') }]
                  }
        });
    }
    const rowTops = rows.map((row) => row.top);
    const groupTops = rowTops.filter((_, i) => isGroup(first + i));
    return {
        rows,
        rowsPerSection: {
            selector: rowTops,
            group: groupTops,
            'pinned-left': rowTops,
            'pinned-middle': rowTops,
            'pinned-right': rowTops
        },
        headerColumns: middleColumns.map((column) => ({ left: columnLefts[column], width: widths[column], label: `F${column}` }))
    };
}

const bodyScroller = (element: GridElement) => element.querySelector('.simple-html-grid-body-scroller') as HTMLElement;
const middleScroller = (element: GridElement) => element.querySelector('.simple-html-grid-middle-scroller') as HTMLElement;

/** a scroll like the user's: the position changes, then the scroller sends its scroll event */
function scrollTo(element: GridElement, to: { top?: number; left?: number }) {
    if (to.top !== undefined) {
        bodyScroller(element).scrollTop = to.top;
        bodyScroller(element).dispatchEvent(new Event('scroll'));
    }
    if (to.left !== undefined) {
        middleScroller(element).scrollLeft = to.left;
        middleScroller(element).dispatchEvent(new Event('scroll'));
    }
}

beforeAll(() => {
    stubCanvas();
    stubElementSizes(VIEWPORT_HEIGHT, VIEWPORT_WIDTH);
});

beforeEach(() => {
    document.body.innerHTML = '';
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('scrolling - rows and columns on screen, not grouped', () => {
    const ROWS = 500;
    const heights = Array.from({ length: ROWS }, () => CELL_HEIGHT);
    const data = wideData(ROWS);
    const valuesOf = (row: number, field: string) => {
        if (/^\d+$/.test(field)) {
            return [data[row][`f${field}`]];
        }
        return [String(data[row][field])];
    };
    const expected = (top: number, left: number) => expectedScreen(heights, top, left, valuesOf, () => false);

    let mounted: MountedGrid;
    beforeEach(async () => {
        mounted = await mountGrid(wideConfig(), wideData(ROWS), fields);
    });

    it('expect the first rows and columns at the start', () => {
        expect(screen(mounted.element)).toEqual(expected(0, 0));
    });

    it('expect the rows to follow small vertical steps, down and up again', () => {
        // steps of 500px or less: rendered on the scroll event
        for (const top of [5, 22, 30, 44, 300, 750, 1200, 1100, 1099, 600, 150, 0]) {
            scrollTo(mounted.element, { top });
            expect(screen(mounted.element), `scrollTop ${top}`).toEqual(expected(top, 0));
        }
    });

    it('expect a large vertical jump to hide the rows, and show the new ones once the scrolling stops', () => {
        scrollTo(mounted.element, { top: 5000 });
        expect(screen(mounted.element).rows).toEqual([]);

        vi.advanceTimersByTime(150);
        expect(screen(mounted.element)).toEqual(expected(5000, 0));

        // the end of the rows: the viewport is filled by the last rows
        const end = ROWS * CELL_HEIGHT - VIEWPORT_HEIGHT;
        scrollTo(mounted.element, { top: end });
        vi.advanceTimersByTime(150);
        expect(screen(mounted.element)).toEqual(expected(end, 0));

        scrollTo(mounted.element, { top: 0 });
        vi.advanceTimersByTime(150);
        expect(screen(mounted.element)).toEqual(expected(0, 0));
    });

    it('expect the middle columns to follow small horizontal steps, right and left again, the pinned ones to stay', () => {
        for (const left of [1, 30, 60, 61, 200, 450, 800, 790, 300, 0]) {
            scrollTo(mounted.element, { left });
            expect(screen(mounted.element), `scrollLeft ${left}`).toEqual(expected(0, left));
        }
    });

    it('expect the middle columns after large horizontal jumps', () => {
        const total = Array.from({ length: CENTER }, (_, c) => centerWidth(c)).reduce((a, b) => a + b, 0);
        for (const left of [2000, total - VIEWPORT_WIDTH, 0, 1500, 3700, 100]) {
            scrollTo(mounted.element, { left });
            expect(screen(mounted.element), `scrollLeft ${left}`).toEqual(expected(0, left));
        }
    });

    it('expect the values of the rows shown when a column comes back after the rows changed', () => {
        // at the far right fewer columns are on screen than there are column elements: some are
        // hidden. The rows change while they are hidden, then a column comes back into one of them
        const total = Array.from({ length: CENTER }, (_, c) => centerWidth(c)).reduce((a, b) => a + b, 0);
        const end = total - VIEWPORT_WIDTH;
        const steps: { top?: number; left?: number }[] = [{ left: end }, { left: end - 400 }, { left: end }, { top: 440 }];
        for (let left = end - 20; left > end - 600; left = left - 20) {
            steps.push({ left });
        }
        let top = 0;
        let left = 0;
        for (const step of steps) {
            scrollTo(mounted.element, step);
            top = step.top ?? top;
            left = step.left ?? left;
            expect(screen(mounted.element), JSON.stringify(step)).toEqual(expected(top, left));
        }
    });

    it('expect rows scrolled in after a horizontal scroll to show the columns of that position', () => {
        const steps: { top?: number; left?: number }[] = [
            { left: 1234 },
            { top: 300 },
            { top: 700 },
            { left: 2500 },
            { top: 6000 },
            { left: 400 },
            { top: 5800 },
            { left: 0, top: 0 }
        ];
        let top = 0;
        let left = 0;
        for (const step of steps) {
            scrollTo(mounted.element, step);
            vi.advanceTimersByTime(150);
            top = step.top ?? top;
            left = step.left ?? left;
            expect(screen(mounted.element), JSON.stringify(step)).toEqual(expected(top, left));
        }
    });
});

describe('scrolling - rows and columns on screen, grouped', () => {
    // two fields stacked in the center columns: a data row is 44px, a group row 22px
    const ROWS = 300;
    const data = wideData(ROWS);

    let mounted: MountedGrid;
    let heights: number[];
    let isGroup: (row: number) => boolean;
    let valuesOf: (row: number, field: string) => string[];

    beforeEach(async () => {
        mounted = await mountGrid(wideConfig(true), data, fields);
        mounted.datasource.group([{ attribute: 'group', title: 'Group' }]);
        mounted.datasource.expandGroup();
        const displayed = Array.from({ length: mounted.datasource.length() }, (_, row) => mounted.datasource.getRow(row));
        heights = displayed.map((row) => (isGroupRow(row) ? CELL_HEIGHT : CELL_HEIGHT * 2));
        isGroup = (row) => isGroupRow(displayed[row]);
        valuesOf = (row, field) => {
            const entity: any = displayed[row];
            if (/^\d+$/.test(field)) {
                return [entity[`f${field}`], entity[`g${field}`]];
            }
            return [String(entity[field])];
        };
    });

    it('expect group rows and data rows of their own heights while scrolling down and up', () => {
        // 30 groups of 10 rows: 30 x (22 + 10 x 44)
        expect(heights.reduce((a, b) => a + b, 0)).toBe(30 * (22 + 440));
        for (const top of [0, 22, 23, 66, 400, 462, 463, 800, 1200, 1000, 470, 0]) {
            scrollTo(mounted.element, { top });
            vi.advanceTimersByTime(150);
            expect(screen(mounted.element), `scrollTop ${top}`).toEqual(expectedScreen(heights, top, 0, valuesOf, isGroup, 15));
        }
    });

    it('expect the rows after large jumps, with the middle columns scrolled', () => {
        const end = heights.reduce((a, b) => a + b, 0) - VIEWPORT_HEIGHT;
        const steps = [
            { top: 5000, left: 900 },
            { top: end, left: 900 },
            { top: 2000, left: 2400 },
            { top: 0, left: 0 }
        ];
        for (const step of steps) {
            scrollTo(mounted.element, step);
            vi.advanceTimersByTime(150);
            expect(screen(mounted.element), JSON.stringify(step)).toEqual(
                expectedScreen(heights, step.top, step.left, valuesOf, isGroup, 15)
            );
        }
    });
});

describe('scrolling - rows made taller with fitRows', () => {
    // every 7th row has a name of 3 lines, every 11th (that is not a 7th) a total of 2 lines: fitRows()
    // makes them 3 and 2 lines high - the first line a cell (22), each other a line of text (15, the
    // default multilineLineHeight): 52 and 37. A multiline cell's input shows its first line
    const ROWS = 500;
    const TEXT_LINE = 15;
    const data: Record<string, any>[] = wideData(ROWS).map((row, i) => ({
        ...row,
        name: i % 7 === 0 ? `n${i}\nsecond\nthird` : row.name,
        total: i % 11 === 0 ? `t${i}\nsecond` : row.total
    }));
    const lines = (row: number) => (row % 7 === 0 ? 3 : row % 11 === 0 ? 2 : 1);
    const heights = data.map((_, row) => CELL_HEIGHT + (lines(row) - 1) * TEXT_LINE);
    const valuesOf = (row: number, field: string) => {
        if (/^\d+$/.test(field)) {
            return [data[row][`f${field}`]];
        }
        return [String(data[row][field]).split('\n')[0]];
    };
    const expected = (top: number, left: number, rowHeights = heights) =>
        expectedScreen(rowHeights, top, left, valuesOf, () => false);

    let mounted: MountedGrid;
    beforeEach(async () => {
        mounted = await mountGrid(wideConfig(), data, fields);
        mounted.gridInterface.fitRows();
    });

    it('expect the rows of every section at their own tops and heights, scrolling down and up', () => {
        expect(mounted.gridInterface.__getScrollState().scrollHeights).toEqual(heights);
        expect(screen(mounted.element)).toEqual(expected(0, 0));
        for (const top of [5, 22, 66, 67, 88, 300, 750, 1200, 1100, 1099, 600, 150, 0]) {
            scrollTo(mounted.element, { top });
            expect(screen(mounted.element), `scrollTop ${top}`).toEqual(expected(top, 0));
        }
    });

    it('expect the rows after large jumps with the middle columns scrolled, and the rows of a line again after a reset', () => {
        const end = heights.reduce((a, b) => a + b, 0) - VIEWPORT_HEIGHT;
        for (const step of [
            { top: 5000, left: 900 },
            { top: end, left: 900 },
            { top: 2000, left: 2400 }
        ]) {
            scrollTo(mounted.element, step);
            vi.advanceTimersByTime(150);
            expect(screen(mounted.element), JSON.stringify(step)).toEqual(expected(step.top, step.left));
        }

        mounted.gridInterface.resetRowHeights();
        expect(screen(mounted.element)).toEqual(
            expected(
                2000,
                2400,
                heights.map(() => CELL_HEIGHT)
            )
        );
    });
});

describe('scrolling - edge cases', () => {
    it('expect the last middle column when the viewport is narrower than it and scrolled to its end', async () => {
        // 20 columns of 100px and one of 1200px, wider than the 1000px viewport: scrolled to the end
        // the last column starts left of the viewport and fills it
        const center = [
            ...Array.from({ length: 20 }, (_, c) => ({ fields: [`f${c}`], width: 100 })),
            { fields: ['f20'], width: 1200 }
        ];
        const data = wideData(5);
        const { element } = await mountGrid({ layout: { center } }, data, fields);

        scrollTo(element, { left: 2100 });

        const { rows, headerColumns } = screen(element);
        expect(headerColumns).toEqual([{ left: 2000, width: 1200, label: 'F20' }]);
        expect(rows.map((row) => row.cells['pinned-middle'])).toEqual(
            data.map((row) => [{ left: 2000, width: 1200, values: [row.f20] }])
        );
    });

    it('expect the last row when the viewport is shorter than it and scrolled to its end', async () => {
        // a 30px high viewport, rows of 44px (two fields stacked): scrolled to the end the last row
        // starts above the viewport and fills it
        stubElementSizes(30, VIEWPORT_WIDTH);
        try {
            const data = wideData(10);
            const { element } = await mountGrid(wideConfig(true), data, fields);

            scrollTo(element, { top: 10 * 44 - 30 });

            expect(screen(element).rows.map((row) => ({ top: row.top, id: row.cells['pinned-left'][0].values }))).toEqual([
                { top: 9 * 44, id: ['9'] }
            ]);
        } finally {
            stubElementSizes(VIEWPORT_HEIGHT, VIEWPORT_WIDTH);
        }
    });

    it('expect a grid of one row to show it', async () => {
        const data = wideData(1);
        const { element } = await mountGrid(wideConfig(), data, fields);

        expect(screen(element).rows.map((row) => row.cells['pinned-left'][0].values)).toEqual([['0']]);
    });

    it('expect the header to follow a horizontal scroll when there are no rows', async () => {
        const { element } = await mountGrid(wideConfig(), [], fields);

        scrollTo(element, { left: 1234 });

        const heights: number[] = [];
        expect(screen(element)).toEqual(
            expectedScreen(
                heights,
                0,
                1234,
                () => [],
                () => false
            )
        );
    });

    it('expect the rows 150ms after the last scroll event of a long scrollbar drag', async () => {
        const { element } = await mountGrid(wideConfig(), wideData(500), fields);

        // a drag: every scroll event jumps far, the rows are hidden until the scrolling stops
        for (const top of [1000, 2000, 3000, 4000]) {
            scrollTo(element, { top });
            vi.advanceTimersByTime(50);
            expect(screen(element).rows).toEqual([]);
        }

        vi.advanceTimersByTime(100);
        expect(screen(element).rows[0]?.cells['pinned-left'][0].values).toEqual([String(Math.floor(4000 / CELL_HEIGHT))]);
    });
});
