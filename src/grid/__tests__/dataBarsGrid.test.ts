// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DatasourceOptions } from '../../datasource/datasourceOptions';
import { where } from '../../datasource/filterExpression';
import { registerCellRenderer } from '../cellRendererRegistry';
import type { ColumnFormat } from '../columnFormat';
import { BAR_END, BAR_START, SCALE_AT, SCALE_FROM, SCALE_TO } from '../dataBars';
import type { GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import type { HTMLCellElement } from '../gridFunctions/HTMLCellElement';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';

/**
 * The data bars, colour scales and icon sets of a number column in the grid (showCellColor.ts,
 * renderRowCell.ts): the classes and custom properties of the cells and the icons, as the values are -
 * a filter changes the range, a cell reused while scrolling gets its row's, an edit of the largest value
 * draws the other cells again, a rule's background wins over a scale. The range is read once for 100 000
 * rows. The pure parts are in dataBars.test.ts.
 */

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    document.body.innerHTML = '';
});

registerCellRenderer('data-bars-test', (host) => ({
    update: ({ text }) => {
        host.textContent = text;
    }
}));

/** amounts 0, 50, 100, 150, 200, a blank, -50 - a team each */
const rows = () => [
    { id: 1, team: 'a', amount: 0 },
    { id: 2, team: 'a', amount: 50 },
    { id: 3, team: 'b', amount: 100 },
    { id: 4, team: 'b', amount: 150 },
    { id: 5, team: 'b', amount: 200 },
    { id: 6, team: 'c', amount: null },
    { id: 7, team: 'c', amount: -50 }
];

const options = (): DatasourceOptions => ({ fields: { id: 'number', amount: 'number', other: 'number' } });

const config = (format: ColumnFormat, more: GridConfig['columns'] = {}): GridConfig => ({
    readonly: false,
    columns: { amount: { format }, ...more },
    layout: {
        center: [
            { fields: ['team'], width: 100 },
            { fields: ['amount'], width: 100 },
            { fields: ['other'], width: 100 }
        ]
    }
});

const mount = (format: ColumnFormat, data: Record<string, unknown>[] = rows(), more: GridConfig['columns'] = {}) =>
    mountGrid(config(format, more), data, options());

/** the cells of a field on screen, by the row they show */
function cellsOf(element: GridElement, field: string): Map<number, HTMLCellElement> {
    const cells = Array.from(element.querySelectorAll('.simple-html-grid-col-cell[type="row-cell"]')) as HTMLCellElement[];
    return new Map(
        cells
            .filter(
                (cell) =>
                    cell.$attribute === field && (cell.closest('.simple-html-grid-row') as HTMLElement).style.display === 'block'
            )
            .map((cell) => [cell.$row, cell])
    );
}

/** the cell of a row on screen (from 0, as displayed) */
function cellOf(element: GridElement, row: number, field = 'amount'): HTMLCellElement {
    const cell = cellsOf(element, field).get(row);
    if (!cell) {
        throw new Error(`no cell on screen for row ${row}, ${field}`);
    }
    return cell;
}

/** the bar of a cell: where it starts and ends, null without one */
const barOfCell = (cell: HTMLElement) =>
    cell.classList.contains('simple-html-grid-cell-bar')
        ? [cell.style.getPropertyValue(BAR_START), cell.style.getPropertyValue(BAR_END)]
        : null;

/** the scale colour of a cell: from, to and how far, null without one */
const scaleOfCell = (cell: HTMLElement) =>
    cell.classList.contains('simple-html-grid-cell-scale')
        ? [cell.style.getPropertyValue(SCALE_FROM), cell.style.getPropertyValue(SCALE_TO), cell.style.getPropertyValue(SCALE_AT)]
        : null;

/** after the frame the grid renders the changed rows in: its own is asked for in a microtask, after this one */
const nextFrame = async () => {
    await Promise.resolve();
    await new Promise((resolve) => requestAnimationFrame(resolve));
};

describe('data bars in the grid', () => {
    it('expect every cell its bar, from the axis at 0: -50 left of it, a blank none', async () => {
        const { element } = await mount({ bar: { color: 'green' } });

        // -50 to 200: 0 is a fifth of the way
        expect([0, 1, 2, 3, 4, 5, 6].map((row) => barOfCell(cellOf(element, row)))).toEqual([
            ['20%', '20%'],
            ['20%', '40%'],
            ['20%', '60%'],
            ['20%', '80%'],
            ['20%', '100%'],
            null,
            ['0%', '20%']
        ]);
        expect(cellOf(element, 1).style.getPropertyValue('--simple-html-grid-bar-color')).toBe(
            'var(--simple-html-grid-palette-green-bg-color)'
        );
        // the other columns have none
        expect(barOfCell(cellOf(element, 1, 'team'))).toBeNull();
    });

    it('expect a filter to change the range: the rows it lets through', async () => {
        const { element, datasource } = await mount({ bar: {} });

        datasource.filter(where('amount', 'LESS_THAN_OR_EQUAL_TO', 100));
        // 0, 50, 100 (and the blank, 0 to the filter; -50): the axis at a third
        const shown = datasource.getRows().map((row) => row.amount);
        expect(shown).toEqual([0, 50, 100, null, -50]);
        expect(barOfCell(cellOf(element, 2))).toEqual(['33.33%', '100%']);

        datasource.filter(where('amount', 'GREATER_THAN', 0));
        // 50 to 200, and 0: 100 is half
        expect(barOfCell(cellOf(element, 1))).toEqual(['0%', '50%']);
    });

    it('expect a fixed range as it is, a value out of it at its end', async () => {
        const { element } = await mount({ bar: { min: 100, max: 150 } });

        expect(barOfCell(cellOf(element, 2))).toEqual(['0%', '0%']);
        expect(barOfCell(cellOf(element, 3))).toEqual(['0%', '100%']);
        expect(barOfCell(cellOf(element, 4))).toEqual(['0%', '100%']);
        expect(barOfCell(cellOf(element, 0))).toEqual(['0%', '0%']);
    });

    it("expect a cell reused for another row while scrolling to have its row's bar, none for a blank", async () => {
        // every tenth row blank
        const many = Array.from({ length: 300 }, (_, i) => ({ id: i + 1, team: 'x', amount: i % 10 === 0 ? null : i }));
        const { element, gridInterface } = await mount({ bar: {}, scale: { minColor: 'red', maxColor: 'green' } }, many);
        const scroller = element.querySelector('.simple-html-grid-body-scroller') as HTMLElement;
        const rowHeight = gridInterface.__getGridConfig().__rowHeight;
        const expectBars = () => {
            const cells = cellsOf(element, 'amount');
            expect(cells.size).toBeGreaterThan(5);
            for (const [row, cell] of cells) {
                const blank = row % 10 === 0;
                // 0 to 299: the bar ends at the value's place
                expect(barOfCell(cell), `row ${row}`).toEqual(
                    blank ? null : ['0%', `${Math.round((row / 299) * 10_000) / 100}%`]
                );
                expect(scaleOfCell(cell) === null, `row ${row}`).toBe(blank);
            }
        };
        const first = cellOf(element, 0);

        expectBars();
        for (const to of [10, 20, 31]) {
            scroller.scrollTop = rowHeight * to;
            scroller.dispatchEvent(new Event('scroll'));
            expectBars();
        }
        expect(first.$row).not.toBe(0);
    });

    it('expect a value set that moves the range to draw every row on screen again, not only its own', async () => {
        const { element, datasource } = await mount({ bar: {} });
        expect(barOfCell(cellOf(element, 2))).toEqual(['20%', '60%']);

        // a new largest value: 400. The range -50 to 400
        datasource.getAllData()[4].amount = 400;
        await nextFrame();
        expect(barOfCell(cellOf(element, 4))).toEqual(['11.11%', '100%']);
        expect(barOfCell(cellOf(element, 2))).toEqual(['11.11%', '33.33%']);

        // one that does not move it: the other rows stay as they are
        datasource.getAllData()[1].amount = 60;
        await nextFrame();
        expect(barOfCell(cellOf(element, 1))).toEqual(['11.11%', '24.44%']);
        expect(barOfCell(cellOf(element, 2))).toEqual(['11.11%', '33.33%']);
    });

    it('expect the bar to follow the value as it is typed', async () => {
        const { element } = await mount({ bar: { min: 0, max: 100 } });
        const input = cellOf(element, 1).querySelector('input') as HTMLInputElement;

        input.focus();
        input.value = '75';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        expect(barOfCell(cellOf(element, 1))).toEqual(['0%', '75%']);
        input.blur();
    });

    it('expect a custom cell to have the bar on its cell, a group row none - the range of every row, collapsed too', async () => {
        const { element, datasource } = await mount({ bar: {} }, rows(), {
            amount: { renderer: 'data-bars-test', format: { bar: {} } }
        });
        expect(cellOf(element, 1).querySelector('.simple-html-grid-cell-custom')).not.toBeNull();
        expect(barOfCell(cellOf(element, 1))).toEqual(['20%', '40%']);

        datasource.group([{ attribute: 'team', title: 'Team' }]);
        // collapsed: the group rows only. Their cells have no bar
        datasource.collapseGroup();
        const shownCells = [...cellsOf(element, 'amount').values()];
        expect(shownCells.filter((cell) => cell.classList.contains('simple-html-grid-cell-bar'))).toEqual([]);
        expect(element.querySelectorAll('.simple-html-grid-body-row-container-group .simple-html-grid-cell-bar').length).toBe(0);
        // team b open: its rows have the range of every row, the collapsed ones too: -50 to 200
        datasource.expandGroup('b');
        const at = datasource.getRows().findIndex((row) => row.amount === 100);
        expect(barOfCell(cellOf(element, at))).toEqual(['20%', '60%']);
    });

    it('expect a calculated column of numbers to have a bar', async () => {
        const { element } = await mountGrid(
            {
                calculatedColumns: { double: { formula: '{amount} * 2' } },
                columns: { double: { format: { bar: {} } } },
                layout: { center: [{ fields: ['double'], width: 100 }] }
            },
            rows(),
            options()
        );

        // -100 to 400
        expect(barOfCell(cellOf(element, 3, 'double'))).toEqual(['20%', '80%']);
    });
});

describe('colour scales in the grid', () => {
    it('expect the two colours a value is between and how far, the midpoint halfway', async () => {
        const { element } = await mount({ scale: { minColor: 'red', midColor: 'yellow', maxColor: '#00ff00' } });

        // -50 to 200, the midpoint 75
        expect(scaleOfCell(cellOf(element, 6))).toEqual([
            'var(--simple-html-grid-palette-red-bg-color)',
            'var(--simple-html-grid-palette-yellow-bg-color)',
            '0%'
        ]);
        expect(scaleOfCell(cellOf(element, 1))).toEqual([
            'var(--simple-html-grid-palette-red-bg-color)',
            'var(--simple-html-grid-palette-yellow-bg-color)',
            '80%'
        ]);
        expect(scaleOfCell(cellOf(element, 4))).toEqual([
            'var(--simple-html-grid-palette-yellow-bg-color)',
            'light-dark(#ccffcc, #003300)',
            '100%'
        ]);
        expect(scaleOfCell(cellOf(element, 5))).toBeNull();
    });

    it("expect a rule's background to win over the scale, its text colour not; the bar to show with the rule", async () => {
        const { element } = await mount({
            rules: [
                { operator: 'EQUAL', value: '100', background: 'grey' },
                { operator: 'EQUAL', value: '50', color: 'red' }
            ],
            bar: {},
            scale: { minColor: 'red', maxColor: 'green' }
        });

        const grey = cellOf(element, 2);
        expect(grey.classList.contains('simple-html-grid-cell-bg-grey')).toBe(true);
        expect(scaleOfCell(grey)).toBeNull();
        expect(barOfCell(grey)).toEqual(['20%', '60%']);
        const red = cellOf(element, 1);
        expect(red.classList.contains('simple-html-grid-cell-text-red')).toBe(true);
        expect(scaleOfCell(red)).not.toBeNull();
        expect(barOfCell(red)).not.toBeNull();
    });
});

describe('icon sets in the grid', () => {
    /** the icon of a cell: its level, shape and colour, the words for a screen reader */
    const iconOfCell = (cell: HTMLElement) => {
        const icon = cell.querySelector('.simple-html-grid-cell-icon') as HTMLElement | null;
        if (!icon) {
            return null;
        }
        const color = ['green', 'amber', 'red'].find((each) => icon.classList.contains(`simple-html-grid-cell-icon-${each}`));
        return `${icon.dataset.level} ${icon.dataset.shape} ${color} "${icon.querySelector('.simple-html-visually-hidden')?.textContent}"`;
    };

    it('expect an icon by the thirds of the range, its level in words describing the input', async () => {
        const { element } = await mount({ icons: { set: 'arrows' } });

        // -50 to 200: middle from 32.5, high from 117.5
        expect([0, 1, 2, 3, 4, 5, 6].map((row) => iconOfCell(cellOf(element, row)))).toEqual([
            'low down red "Low"',
            'middle side amber "Middle"',
            'middle side amber "Middle"',
            'high up green "High"',
            'high up green "High"',
            null,
            'low down red "Low"'
        ]);
        const cell = cellOf(element, 3);
        const input = cell.querySelector('input') as HTMLInputElement;
        const icon = cell.querySelector('.simple-html-grid-cell-icon') as HTMLElement;
        expect(input.getAttribute('aria-describedby')).toBe(icon.id);
        expect(icon.getAttribute('aria-hidden')).toBe('true');
        expect(input.classList.contains('simple-html-grid-cell-with-icon-before')).toBe(true);
        expect(icon.classList.contains('simple-html-grid-cell-icon-before')).toBe(true);
        // a blank: no icon, no description, no room
        const blank = cellOf(element, 5).querySelector('input') as HTMLInputElement;
        expect(blank.hasAttribute('aria-describedby')).toBe(false);
        expect(blank.classList.contains('simple-html-grid-cell-with-icon-before')).toBe(false);
    });

    it('expect numbers as thresholds, reversed, after the value', async () => {
        const { element } = await mount({
            icons: { set: 'symbols', thresholds: [0, 150], unit: 'number', reverse: true, position: 'after' }
        });

        expect(iconOfCell(cellOf(element, 6))).toBe('low check green "Low"');
        expect(iconOfCell(cellOf(element, 0))).toBe('middle exclamation amber "Middle"');
        expect(iconOfCell(cellOf(element, 3))).toBe('high cross red "High"');
        expect(cellOf(element, 3).querySelector('input')?.classList.contains('simple-html-grid-cell-with-icon-after')).toBe(true);
    });

    it('expect the icon of the state, none after resetState()', async () => {
        const { element, gridInterface } = await mount({});
        expect(iconOfCell(cellOf(element, 4))).toBeNull();

        gridInterface.setState({ formats: { amount: { icons: { set: 'traffic' } } } });
        expect(iconOfCell(cellOf(element, 4))).toBe('high circle green "High"');
        expect(JSON.parse(JSON.stringify(gridInterface.getState().formats))).toEqual({ amount: { icons: { set: 'traffic' } } });

        gridInterface.resetState();
        expect(iconOfCell(cellOf(element, 4))).toBeNull();
    });
});

describe('bars, scales, icons - the config and the state', () => {
    it('expect a TypeError from the config and from setState() for a part that does not fit', async () => {
        await expect(mount({ bar: { color: 'magenta' } as never })).rejects.toThrow(
            /GridConfig: columns.amount.format.bar.color is "magenta"/
        );
        const { gridInterface } = await mount({});
        expect(() => gridInterface.setState({ formats: { team: { bar: {} } } })).toThrow(
            new TypeError("setState: formats.team.bar is for a number field, 'team' is text")
        );
        expect(() => gridInterface.setState({ formats: { amount: { scale: { minColor: 'red' } as never } } })).toThrow(
            /setState: formats.amount.scale.maxColor is undefined/
        );
    });
});

describe('bars, scales, icons - 100 000 rows', () => {
    it('expect the range read once for every render of the cells, again when a value changes or the rows are filtered', async () => {
        // a row that counts the reads of its amount
        let reads = 0;
        const many = Array.from({ length: 100_000 }, (_, i) => {
            const row: Record<string, unknown> = { id: i + 1, team: 'x' };
            const amount = i % 1000;
            Object.defineProperty(row, 'amount', {
                enumerable: true,
                get: () => {
                    reads++;
                    return amount;
                }
            });
            return row;
        });
        const { element, datasource, gridInterface } = await mount(
            { bar: {}, scale: { minColor: 'red', maxColor: 'green' }, icons: { set: 'arrows' } },
            many
        );
        // the min and the max: a read of every row each, once - and the cells on screen
        const shown = cellsOf(element, 'amount').size;
        expect(reads).toBeGreaterThanOrEqual(200_000);
        expect(reads).toBeLessThan(200_000 + 100 * shown);

        reads = 0;
        gridInterface.refresh();
        gridInterface.refresh();
        // the cells on screen read their value, the range is kept
        expect(reads).toBeLessThan(100 * shown);

        // other rows: read again
        reads = 0;
        datasource.filter(where('id', 'LESS_THAN_OR_EQUAL_TO', 50_000));
        expect(reads).toBeGreaterThanOrEqual(100_000);
        expect(barOfCell(cellOf(element, 1))).toEqual(['0%', '0.1%']);
    });
});
