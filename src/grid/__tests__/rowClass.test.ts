// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatasourceOptions } from '../../datasource/datasourceOptions';
import type { GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import type { GridHooks } from '../gridHooks';
import { displayedRowOf, mountGrid, shownRowElements, stubCanvas, stubElementSizes } from './gridTestHelpers';

/**
 * The rowClass hook (GridHooks.rowClass, rowClass.ts): classes on a whole row, from its values - on the
 * row element of every section (the row number, pinned left, middle, pinned right), following the row
 * as the elements are reused, its values change and the hook changes. Not on group rows.
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

// name pinned left, status in the middle, team pinned right
const config = (): GridConfig => ({
    readonly: false,
    layout: {
        left: [{ fields: ['name'], width: 100 }],
        center: [{ fields: ['status'], width: 100 }],
        right: [{ fields: ['team'], width: 100 }]
    }
});

const rows = () => [
    { id: 1, name: 'a', status: 'late', team: 'x' },
    { id: 2, name: 'b', status: 'ok', team: 'x' },
    { id: 3, name: 'c', status: 'late', team: 'y' }
];

const fields = (): DatasourceOptions => ({ key: 'id', fields: { id: 'number' } });

const late: GridHooks = { rowClass: (row) => (row.status === 'late' ? 'late attention' : null) };

/** waits for the grid's animation frame: the rows-changed microtask asks for it first */
const frame = async () => {
    await Promise.resolve();
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
};

const SECTIONS = ['selector', 'pinned-left', 'pinned-middle', 'pinned-right'];

/** per displayed row, the sections whose row element has the class */
function rowsWith(element: GridElement, name: string): Record<number, string[]> {
    const result: Record<number, string[]> = {};
    for (const section of [...SECTIONS, 'group']) {
        for (const rowElement of shownRowElements(element, section)) {
            if (rowElement.classList.contains(name)) {
                const row = displayedRowOf(rowElement);
                result[row] = [...(result[row] ?? []), section];
            }
        }
    }
    return result;
}

describe('rowClass hook', () => {
    it('expect the classes on the row element of every section of the rows it gives them', async () => {
        const { element } = await mountGrid(config(), rows(), fields(), late);

        expect(rowsWith(element, 'late')).toEqual({ 0: SECTIONS, 2: SECTIONS });
        expect(rowsWith(element, 'attention')).toEqual({ 0: SECTIONS, 2: SECTIONS });
    });

    it('expect them to follow an edit of the row, in the next frame', async () => {
        const { element, datasource } = await mountGrid(config(), rows(), fields(), late);
        const [first, second] = datasource.getDataRows();

        first.status = 'ok';
        second.status = 'late';
        await frame();

        expect(rowsWith(element, 'late')).toEqual({ 1: SECTIONS, 2: SECTIONS });
    });

    it('expect them to follow the rows when the row elements show other rows: a sort', async () => {
        const { element, datasource } = await mountGrid(config(), rows(), fields(), late);

        // c (late), b, a (late)
        datasource.sort({ attribute: 'name', ascending: false });

        expect(rowsWith(element, 'late')).toEqual({ 0: SECTIONS, 2: SECTIONS });
        datasource.sort({ attribute: 'status', ascending: true });
        // late, late, ok
        expect(rowsWith(element, 'late')).toEqual({ 0: SECTIONS, 1: SECTIONS });
    });

    it('expect no class on a group row, the hook not called for it', async () => {
        const rowClass = vi.fn((row: any) => (row.status === 'late' ? 'late' : null));
        const { element, datasource } = await mountGrid(config(), rows(), fields(), { rowClass });

        datasource.group([{ attribute: 'team', title: 'Team' }]);
        datasource.expandGroup();

        // [group x, a (late), b, group y, c (late)]
        expect(rowsWith(element, 'late')).toEqual({ 1: SECTIONS, 4: SECTIONS });
        expect(rowClass.mock.calls.every(([row]) => !('__groupID' in (row as object)))).toBe(true);
    });

    it('expect updateHooks() to add, change and remove them', async () => {
        const { element, gridInterface } = await mountGrid(config(), rows(), fields());
        expect(rowsWith(element, 'late')).toEqual({});

        gridInterface.updateHooks(late);
        expect(rowsWith(element, 'late')).toEqual({ 0: SECTIONS, 2: SECTIONS });

        gridInterface.updateHooks({ rowClass: (row) => (row.team === 'y' ? 'team-y' : '') });
        expect(rowsWith(element, 'late')).toEqual({});
        expect(rowsWith(element, 'team-y')).toEqual({ 2: SECTIONS });

        gridInterface.updateHooks({ rowClass: undefined });
        expect(rowsWith(element, 'team-y')).toEqual({});
    });

    it("expect the grid's own row classes kept", async () => {
        const { element } = await mountGrid(config(), rows(), fields(), late);
        const middle = shownRowElements(element, 'pinned-middle')[0];

        expect(middle.classList.contains('simple-html-grid-row')).toBe(true);
        expect(middle.classList.contains('simple-html-grid-row-even')).toBe(true);
    });
});
