// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import { GROUP_LEVEL_WIDTH } from '../gridFunctions/getGroupingWidth';
import { mountGrid, shownRowElements, simpleConfig, stubCanvas, stubElementSizes } from './gridTestHelpers';

/**
 * The grouping columns look like a tree (renderRowGroup.ts, grid.css): a column per level of grouping,
 * the +/- of a group row a box in the column of its level, and the line of a group from under its box
 * down through its rows - in a group row the lines of the groups it is in, and in a data row the lines
 * of all the levels. grid.css draws the lines; here: which elements are there, their sizes and places.
 * The real browser look is checked with screenshots, by the browser checks (scripts/browser/checks)
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

// two levels: firstname a (lastname x, y) and b (lastname x)
const data = () => [
    { firstname: 'a', lastname: 'x', age: 10 },
    { firstname: 'a', lastname: 'y', age: 20 },
    { firstname: 'b', lastname: 'x', age: 30 }
];

const grouping = [
    { attribute: 'firstname', title: 'First' },
    { attribute: 'lastname', title: 'Last' }
];

type GroupRowLook = {
    text: string;
    expanded: string | null;
    /** the path of the sign in the box: a minus, or a minus and an upright (a plus) */
    sign: string | null;
    /** the width of the lines of the groups it is in, null when it is in none */
    levels: string | null;
    /** the line of the group under its box: where, null when collapsed */
    line: { left: string; top: string } | null;
};

/**
 * not hidden: a data row hides the group cell of its row element, what a group row showed in it before
 * is left there (renderRowGroup)
 */
function shown(element: HTMLElement) {
    for (let e: HTMLElement | null = element; e; e = e.parentElement) {
        if (e.style.display === 'none') {
            return false;
        }
    }
    return true;
}

/** the group rows on screen, in their order: how their grouping columns look */
function groupRows(element: GridElement): GroupRowLook[] {
    return shownRowElements(element, 'group')
        .map((row) => row.querySelector<HTMLElement>('.simple-html-grid-group-toggle'))
        .filter((toggle): toggle is HTMLElement => !!toggle && shown(toggle))
        .map((toggle) => {
            // the cell's content: the gridcell, or the container of a row with aggregates
            const cell = (toggle.closest('.simple-html-grid-group-aggregates') ??
                toggle.closest('.simple-html-label-group')) as HTMLElement;
            const levels = cell.querySelector<HTMLElement>('.simple-html-grid-group-levels');
            const line = cell.querySelector<HTMLElement>('.simple-html-grid-group-line');
            return {
                text: cell.querySelector('.simple-html-grid-group-text')?.textContent?.trim() ?? '',
                expanded: toggle.getAttribute('aria-expanded'),
                sign: toggle.querySelector('.simple-html-grid-group-box-sign')?.getAttribute('d') ?? null,
                levels: levels ? levels.style.width : null,
                line: line ? { left: line.style.left, top: line.style.top } : null
            };
        });
}

const MINUS = 'M3 5.5h5';
const PLUS = 'M3 5.5h5M5.5 3v5';

describe('group rows - the +/- box and the lines of the levels', () => {
    it('expect a plus in the box of a collapsed group, no line under it', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), data());
        datasource.group(grouping);

        expect(groupRows(element)).toEqual([
            { text: 'First: a (2)', expanded: 'false', sign: PLUS, levels: null, line: null },
            { text: 'First: b (1)', expanded: 'false', sign: PLUS, levels: null, line: null }
        ]);
    });

    it('expect a minus and the line from the middle of the row down when expanded, a sub group in the next column', async () => {
        const { element, datasource, gridInterface } = await mountGrid(simpleConfig(), data());
        datasource.group(grouping);
        datasource.expandGroup();
        // the line starts in the middle of the name line, the box is over its top
        const top = `${Math.floor(gridInterface.__getGridConfig().cellHeight / 2)}px`;

        const rows = groupRows(element);
        expect(rows.map((row) => row.text)).toEqual([
            'First: a (2)',
            'Last: x (1)',
            'Last: y (1)',
            'First: b (1)',
            'Last: x (1)'
        ]);
        expect(rows[0]).toEqual({
            text: 'First: a (2)',
            expanded: 'true',
            sign: MINUS,
            levels: null,
            line: { left: '0px', top }
        });
        // in group a: its line goes through, its own box and line one column further
        expect(rows[1]).toEqual({
            text: 'Last: x (1)',
            expanded: 'true',
            sign: MINUS,
            levels: `${GROUP_LEVEL_WIDTH}px`,
            line: { left: `${GROUP_LEVEL_WIDTH}px`, top }
        });
    });

    it('expect the box and the lines to follow a collapse', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), data());
        datasource.group(grouping);
        datasource.expandGroup();
        const sub = datasource.getRows().find((row: any) => row.__groupLvl === 1);
        datasource.collapseGroup(sub.__groupID);

        expect(groupRows(element)[1]).toEqual({
            text: 'Last: x (1)',
            expanded: 'false',
            sign: PLUS,
            levels: `${GROUP_LEVEL_WIDTH}px`,
            line: null
        });
    });

    it('expect the grouping column of a data row as wide as the levels, so it has the line of each', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), data());
        const gutters = () =>
            shownRowElements(element, 'pinned-left')
                .map((row) => row.querySelector<HTMLElement>('.simple-html-grid-grouping-row'))
                .filter((gutter): gutter is HTMLElement => !!gutter && gutter.style.display !== 'none')
                .map((gutter) => gutter.style.width);

        datasource.group(grouping);
        datasource.expandGroup();
        expect(new Set(gutters())).toEqual(new Set([`${2 * GROUP_LEVEL_WIDTH}px`]));

        datasource.group([grouping[0]]);
        datasource.expandGroup();
        expect(new Set(gutters())).toEqual(new Set([`${GROUP_LEVEL_WIDTH}px`]));
    });

    it('expect the lines over the whole group row with aggregates, the box in the name line', async () => {
        const config: GridConfig = { ...simpleConfig(), columns: { age: { aggregate: ['sum', 'avg'] } } };
        const { element, datasource } = await mountGrid(config, data());
        datasource.group(grouping);
        datasource.expandGroup();

        const cell = shownRowElements(element, 'group')
            .map((row) => row.querySelector<HTMLElement>('.simple-html-grid-group-aggregates'))
            .filter(Boolean)[1] as HTMLElement;
        // the lines are in the row's container, over its height; the box is in the name cell
        expect(cell.querySelector(':scope > .simple-html-grid-group-levels')).not.toBeNull();
        expect(cell.querySelector(':scope > .simple-html-grid-group-line')).not.toBeNull();
        expect(cell.querySelector('.simple-html-grid-group-name .simple-html-grid-group-toggle')).not.toBeNull();
        expect(cell.querySelector('.simple-html-grid-group-name .simple-html-grid-group-levels')).toBeNull();
    });
});
