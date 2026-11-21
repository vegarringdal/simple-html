// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GridConfig } from '../gridConfig';
import { MENU_IDS } from '../gridMenus';
import { mountGrid, simpleConfig, simpleData, simpleFields, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { gridOf, openRowMenu } from './interactionTestHelpers';

/**
 * The row menu's "Delete:" section: delete marks the selected rows for deletion, undo takes the mark
 * off. Only in an editable grid; undo only when a selected row is marked. A row the isReadonly hook
 * makes readonly in every column is locked, delete skips it.
 */

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    document.body.innerHTML = '';
});

const DELETE_IDS = ['row.delete', 'row.delete.rows', 'row.delete.undo'];

/** the delete entries the open menu shows */
function shownDeleteIds(): string[] {
    return Array.from(document.querySelectorAll('.simple-html-grid-menu [data-menu-id]'))
        .map((el) => el.getAttribute('data-menu-id') ?? '')
        .filter((id) => id.startsWith('row.delete'));
}

function entry(id: string): HTMLElement {
    return document.querySelector(`.simple-html-grid-menu [data-menu-id="${id}"]`) as HTMLElement;
}

const isDisabled = (id: string) => entry(id).classList.contains('simple-html-grid-menu-item-disabled');

const editable = (): GridConfig => ({ ...simpleConfig(), readonly: false });

/** [firstname, __rowState] of every row, in the order set */
const states = (datasource: { getAllData(): { firstname?: string; __rowState?: string }[] }) =>
    datasource.getAllData().map((row) => [row.firstname, row.__rowState]);

describe('row menu - delete: the ids', () => {
    it('expect the delete ids in MENU_IDS.row, after clear and before the summary', () => {
        const ids: readonly string[] = MENU_IDS.row;
        const at = ids.indexOf('row.delete');
        expect(ids.slice(at, at + 3)).toEqual(DELETE_IDS);
        expect(ids[at - 1]).toEqual('row.clear.range');
        expect(ids[at + 3]).toEqual('row.summary');
    });
});

describe('row menu - delete: when it is shown', () => {
    it('expect no delete entries in a readonly grid', async () => {
        const { element, datasource } = await mountGrid(); // readonly: true is the default
        datasource.getSelection().selectRowRange(0, 1);
        datasource.markForDeletion(datasource.getDataRows()[0]);

        openRowMenu(element, 'firstname', 0);

        expect(shownDeleteIds()).toEqual([]);
    });

    it('expect delete, greyed out, and no undo when nothing is selected', async () => {
        const { element } = await mountGrid(editable());

        openRowMenu(element, 'firstname', 0);

        expect(shownDeleteIds()).toEqual(['row.delete', 'row.delete.rows']);
        expect(entry('row.delete.rows').textContent?.replace(/\s+/g, ' ').trim()).toEqual('Rows (selected rows)');
        expect(isDisabled('row.delete.rows')).toBe(true);
    });

    it('expect undo only when a selected row is marked', async () => {
        const { element, datasource } = await mountGrid(editable());
        datasource.getSelection().selectRowRange(0, 1);

        openRowMenu(element, 'firstname', 0);
        expect(shownDeleteIds()).toEqual(['row.delete', 'row.delete.rows']);
        expect(isDisabled('row.delete.rows')).toBe(false);

        // a marked row that is not selected does not count
        datasource.markForDeletion(datasource.getDataRows()[3]);
        openRowMenu(element, 'firstname', 0);
        expect(shownDeleteIds()).toEqual(['row.delete', 'row.delete.rows']);

        datasource.markForDeletion(datasource.getDataRows()[1]);
        openRowMenu(element, 'firstname', 0);
        expect(shownDeleteIds()).toEqual(DELETE_IDS);
        expect(entry('row.delete.undo').textContent?.replace(/\s+/g, ' ').trim()).toEqual('Undo (selected rows)');
    });

    it('expect delete to be greyed out when every selected row is marked already', async () => {
        const { element, datasource } = await mountGrid(editable());
        datasource.getSelection().selectRowRange(0, 1);
        datasource.markForDeletion(datasource.getSelectedRows());

        openRowMenu(element, 'firstname', 0);

        expect(isDisabled('row.delete.rows')).toBe(true);
        expect(isDisabled('row.delete.undo')).toBe(false);
    });

    it('expect the entries to go when the grid is made readonly with updateConfig', async () => {
        const { element, gridInterface } = await mountGrid(editable());
        gridInterface.updateConfig({ readonly: true });

        openRowMenu(element, 'firstname', 0);

        expect(shownDeleteIds()).toEqual([]);
    });
});

describe('row menu - delete: the actions', () => {
    it('expect delete to mark the selected rows, and the rows to stay in the grid', async () => {
        const { element, datasource } = await mountGrid(editable());
        datasource.getSelection().selectRowRange(1, 2);

        openRowMenu(element, 'firstname', 0);
        entry('row.delete.rows').click();

        expect(states(datasource)).toEqual([
            ['first1', undefined],
            ['first2', 'D'],
            ['first3', 'D'],
            ['first4', undefined],
            ['first5', undefined]
        ]);
        expect(datasource.getDataRows()).toHaveLength(5);
        // the row numbers of the marked rows get the class the css strikes through
        expect(element.querySelectorAll('.row-is-deleted')).toHaveLength(2);
    });

    it('expect undo to take the mark off the selected rows only', async () => {
        const { element, datasource } = await mountGrid(editable());
        datasource.markAllForDeletion();
        datasource.getSelection().selectRowRange(0, 1);

        openRowMenu(element, 'firstname', 0);
        entry('row.delete.undo').click();

        expect(states(datasource).map(([, state]) => state)).toEqual([undefined, undefined, 'D', 'D', 'D']);
        expect(element.querySelectorAll('.row-is-deleted')).toHaveLength(3);
    });

    it('expect a new row to be marked, and to come back as a new row on undo', async () => {
        const { element, datasource } = await mountGrid(editable());
        datasource.addNewEmpty({ firstname: 'new' }); // selected

        openRowMenu(element, 'firstname', 5);
        entry('row.delete.rows').click();
        expect(states(datasource)[5]).toEqual(['new', 'D']);
        expect(datasource.getChanges().newEntities).toEqual([]);

        openRowMenu(element, 'firstname', 5);
        entry('row.delete.undo').click();
        expect(states(datasource)[5]).toEqual(['new', 'N']);
    });

    it('expect the grid to be rebuilt once per action', async () => {
        const { element, datasource } = await mountGrid(editable());
        datasource.getSelection().selectRowRange(0, 0);
        const rebuild = vi.spyOn(gridOf(element), 'rebuild');

        openRowMenu(element, 'firstname', 0);
        entry('row.delete.rows').click();
        expect(rebuild).toHaveBeenCalledTimes(1);

        openRowMenu(element, 'firstname', 0);
        entry('row.delete.undo').click();
        expect(rebuild).toHaveBeenCalledTimes(2);
    });
});

describe('row menu - delete: the isReadonly hook', () => {
    it('expect delete to skip a row the hook makes readonly in every column', async () => {
        const { element, datasource } = await mountGrid(editable(), simpleData(), simpleFields(), {
            isReadonly: (row) => (row.firstname === 'first2' ? true : null)
        });
        datasource.getSelection().selectRowRange(0, 2);

        openRowMenu(element, 'firstname', 0);
        entry('row.delete.rows').click();

        expect(states(datasource).map(([, state]) => state)).toEqual(['D', undefined, 'D', undefined, undefined]);
    });

    it('expect delete to be greyed out when every selected row is locked', async () => {
        const { element, datasource } = await mountGrid(editable(), simpleData(), simpleFields(), {
            isReadonly: (row) => (row.firstname === 'first2' ? true : null)
        });
        datasource.getSelection().selectRowRange(1, 1);

        openRowMenu(element, 'firstname', 1);

        expect(isDisabled('row.delete.rows')).toBe(true);
    });

    it('expect a row readonly in some columns only to be deleted', async () => {
        const { element, datasource } = await mountGrid(editable(), simpleData(), simpleFields(), {
            isReadonly: (row, field) => (row.firstname === 'first1' && field !== 'age' ? true : null)
        });
        datasource.getSelection().selectRowRange(0, 0);

        openRowMenu(element, 'firstname', 0);
        entry('row.delete.rows').click();

        expect(datasource.getDataRows()[0].__rowState).toEqual('D');
    });

    it("expect readonly columns (the columns' option, no hook) not to stop a delete", async () => {
        const config: GridConfig = {
            ...editable(),
            columns: { firstname: { readonly: true }, lastname: { readonly: true }, age: { readonly: true } }
        };
        const { element, datasource } = await mountGrid(config);
        datasource.getSelection().selectRowRange(0, 0);

        openRowMenu(element, 'firstname', 0);
        entry('row.delete.rows').click();

        expect(datasource.getDataRows()[0].__rowState).toEqual('D');
    });

    it('expect undo to work on a row the hook makes readonly because it is marked', async () => {
        const { element, datasource } = await mountGrid(editable(), simpleData(), simpleFields(), {
            // a marked row can not be edited
            isReadonly: (row) => (row.__rowState === 'D' ? true : null)
        });
        datasource.getSelection().selectRowRange(0, 0);

        openRowMenu(element, 'firstname', 0);
        entry('row.delete.rows').click();
        expect(datasource.getDataRows()[0].__rowState).toEqual('D');

        openRowMenu(element, 'firstname', 0);
        expect(isDisabled('row.delete.rows')).toBe(true);
        entry('row.delete.undo').click();

        expect(datasource.getDataRows()[0].__rowState).toBeUndefined();
    });
});

describe('the grid after acceptChanges', () => {
    it('expect the marked rows gone and the row states cleared, in one rebuild', async () => {
        const { element, datasource } = await mountGrid(editable());
        const [first, second] = datasource.getDataRows();
        first.lastname = 'edited';
        datasource.markForDeletion(second);
        datasource.addNewEmpty({ firstname: 'new' }, { scrollTo: false });
        expect(element.querySelectorAll('.row-is-deleted, .row-is-new, .row-is-modified')).toHaveLength(3);
        const rebuild = vi.spyOn(gridOf(element), 'rebuild');

        datasource.acceptChanges();

        expect(rebuild).toHaveBeenCalledTimes(1);
        expect(datasource.getDataRows().map((row) => row.firstname)).toEqual(['first1', 'first3', 'first4', 'first5', 'new']);
        expect(element.querySelectorAll('.row-is-deleted, .row-is-new, .row-is-modified')).toHaveLength(0);
    });
});
