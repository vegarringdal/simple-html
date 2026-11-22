// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Entity } from '../../datasource/entity';
import { where } from '../../datasource/filterExpression';
import type { GridConfig } from '../gridConfig';
import type { HTMLCellElement } from '../gridFunctions/HTMLCellElement';
import { isMacPlatform } from '../gridFunctions/keyText';
import { mountGrid, simpleConfig, simpleFields, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { headerFilterInput, menuEntry, openRowMenu, sleep } from './interactionTestHelpers';

/**
 * Undo and redo in the grid: Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z in a body cell, the browser's own undo
 * while the user types in the cell, and the row menu's "Edit:" section - undo, redo, revert cell,
 * revert rows.
 */

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    document.body.innerHTML = '';
});

const data = () => [
    { firstname: 'a', lastname: 'x', age: 1 },
    { firstname: 'b', lastname: 'y', age: 2 },
    { firstname: 'c', lastname: 'z', age: 3 }
];

const editable = (): GridConfig => ({ ...simpleConfig(), readonly: false });

/** the input of a body cell */
const cellInput = (element: HTMLElement, attribute: string, rowIndex = 0) =>
    element.querySelectorAll(`input[data-attribute="${attribute}"]`)[rowIndex] as HTMLInputElement;

/** types into a cell as the user does: the focus, a value per key, an input event each */
async function typeInCell(input: HTMLInputElement, values: string[]) {
    input.dispatchEvent(new FocusEvent('focus'));
    for (const value of values) {
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(0);
    }
}

/** the focus leaves the cell, with the change event before it */
async function leaveCell(input: HTMLInputElement) {
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new FocusEvent('blur'));
    await sleep(0);
}

/** presses a key with Ctrl (or what is given) on an input, returns the event */
function press(input: HTMLInputElement, key: string, modifiers: KeyboardEventInit = { ctrlKey: true }) {
    const event = new KeyboardEvent('keydown', {
        key,
        code: `Key${key.toUpperCase()}`,
        bubbles: true,
        cancelable: true,
        ...modifiers
    });
    input.dispatchEvent(event);
    return event;
}

const firstnames = (datasource: { getAllData(): { firstname?: string }[] }) =>
    datasource.getAllData().map((row) => row.firstname);

describe('undo and redo - the keys in a cell', () => {
    it('expect Ctrl+Z to undo what was typed in a cell once it was left, and the cell to show it', async () => {
        const { element, datasource } = await mountGrid(editable(), data(), simpleFields());
        const input = cellInput(element, 'firstname');
        await typeInCell(input, ['a1', 'a12']);
        await leaveCell(input);
        expect(firstnames(datasource)).toEqual(['a12', 'b', 'c']);

        const event = press(cellInput(element, 'lastname'), 'z');

        expect(event.defaultPrevented).toBe(true);
        expect(firstnames(datasource)).toEqual(['a', 'b', 'c']);
        expect(cellInput(element, 'firstname').value).toEqual('a');
        expect(datasource.getAllData()[0].__rowState).toBeUndefined();
    });

    it('expect Ctrl+Y, Ctrl+Shift+Z and Cmd+Shift+Z to redo, Cmd+Z to undo', async () => {
        const { element, datasource } = await mountGrid(editable(), data(), simpleFields());
        const input = cellInput(element, 'firstname');
        await typeInCell(input, ['a1']);
        await leaveCell(input);
        const other = cellInput(element, 'lastname');

        press(other, 'z');
        expect(firstnames(datasource)[0]).toEqual('a');
        press(other, 'y');
        expect(firstnames(datasource)[0]).toEqual('a1');
        expect(cellInput(element, 'firstname').value).toEqual('a1');

        press(other, 'z', { metaKey: true });
        expect(firstnames(datasource)[0]).toEqual('a');
        press(other, 'Z', { ctrlKey: true, shiftKey: true });
        expect(firstnames(datasource)[0]).toEqual('a1');

        press(other, 'z');
        press(other, 'Z', { metaKey: true, shiftKey: true });
        expect(firstnames(datasource)[0]).toEqual('a1');
    });

    it('expect the letter of a layout without latin letters to be found by where the key is', async () => {
        const { element, datasource } = await mountGrid(editable(), data(), simpleFields());
        datasource.getAllData()[0].firstname = 'changed';
        await sleep(0);

        // a Russian layout: the key with Z on it gives я
        const event = new KeyboardEvent('keydown', { key: 'я', code: 'KeyZ', ctrlKey: true, bubbles: true, cancelable: true });
        cellInput(element, 'lastname').dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(firstnames(datasource)[0]).toEqual('a');
    });

    it('expect the keys to be the input own while the user types in the cell', async () => {
        const { element, datasource } = await mountGrid(editable(), data(), simpleFields());
        const input = cellInput(element, 'firstname');
        await typeInCell(input, ['a1', 'a12']);

        const undo = press(input, 'z');
        const redo = press(input, 'y');

        expect(undo.defaultPrevented).toBe(false);
        expect(redo.defaultPrevented).toBe(false);
        expect(firstnames(datasource)[0]).toEqual('a12');

        // the browser's undo of the typing writes the value back: one step, and once the cell is
        // back where it started the keys go to the history - there is nothing in it now
        input.value = 'a';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        expect(datasource.canUndo()).toBe(false);
    });

    it('expect the keys to undo the history once the cell typed in is back where it started', async () => {
        const { element, datasource } = await mountGrid(editable(), data(), simpleFields());
        const lastname = cellInput(element, 'lastname');
        await typeInCell(lastname, ['x1']);
        await leaveCell(lastname);

        const input = cellInput(element, 'firstname');
        await typeInCell(input, ['a1']);
        input.value = 'a'; // the browser's own undo
        input.dispatchEvent(new Event('input', { bubbles: true }));

        expect(press(input, 'z').defaultPrevented).toBe(true);
        expect(datasource.getAllData()[0].lastname).toEqual('x');
    });

    it('expect all the keys typed in a cell to be one step, a second visit another', async () => {
        const { element, datasource } = await mountGrid(editable(), data(), simpleFields());
        const input = cellInput(element, 'firstname');
        await typeInCell(input, ['a1', 'a12', 'a123']);
        await leaveCell(input);
        await typeInCell(cellInput(element, 'firstname'), ['a1234']);
        await leaveCell(cellInput(element, 'firstname'));

        const other = cellInput(element, 'lastname');
        press(other, 'z');
        expect(firstnames(datasource)[0]).toEqual('a123');
        press(other, 'z');
        expect(firstnames(datasource)[0]).toEqual('a');
        expect(datasource.canUndo()).toBe(false);
    });

    it('expect a checkbox change to be a step, and the keys to work on a checkbox', async () => {
        const rows = [
            { firstname: 'a', active: true },
            { firstname: 'b', active: false }
        ];
        const config: GridConfig = {
            readonly: false,
            layout: {
                center: [
                    { fields: ['firstname'], width: 100 },
                    { fields: ['active'], width: 100 }
                ]
            }
        };
        const { element, datasource } = await mountGrid(config, rows, { fields: { active: 'boolean' } });
        const checkbox = cellInput(element, 'active');
        const before = datasource.getAllData()[0].active;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        const after = datasource.getAllData()[0].active;
        expect(after).not.toEqual(before);
        await sleep(0);

        expect(press(cellInput(element, 'active'), 'z').defaultPrevented).toBe(true);
        expect(datasource.getAllData()[0].active).toEqual(before);
        press(cellInput(element, 'active'), 'y');
        expect(datasource.getAllData()[0].active).toEqual(after);
    });

    it('expect nothing to undo to leave the key to the browser', async () => {
        const { element } = await mountGrid(editable(), data(), simpleFields());
        expect(press(cellInput(element, 'firstname'), 'z').defaultPrevented).toBe(false);
        expect(press(cellInput(element, 'firstname'), 'y').defaultPrevented).toBe(false);
    });

    it('expect no undo in a readonly grid', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), data(), simpleFields());
        datasource.getAllData()[0].firstname = 'changed';
        await sleep(0);

        expect(press(cellInput(element, 'lastname'), 'z').defaultPrevented).toBe(false);
        expect(firstnames(datasource)[0]).toEqual('changed');
    });

    it('expect no undo from a header filter', async () => {
        const { element, datasource } = await mountGrid(editable(), data(), simpleFields());
        datasource.getAllData()[0].firstname = 'changed';
        await sleep(0);

        const event = press(headerFilterInput(element, 'firstname'), 'z');

        expect(event.defaultPrevented).toBe(false);
        expect(firstnames(datasource)[0]).toEqual('changed');
    });

    it('expect the cells to show an undo from code', async () => {
        const { element, datasource } = await mountGrid(editable(), data(), simpleFields());
        const input = cellInput(element, 'firstname');
        await typeInCell(input, ['a1']);
        await leaveCell(input);

        datasource.undo();
        expect(cellInput(element, 'firstname').value).toEqual('a');
        datasource.redo();
        expect(cellInput(element, 'firstname').value).toEqual('a1');
    });

    it('expect a paste over the selected rows to be one Ctrl+Z', async () => {
        const { element, datasource } = await mountGrid(editable(), data(), simpleFields());
        vi.spyOn(navigator.clipboard, 'readText').mockResolvedValue('pasted');
        datasource.selectAll();

        openRowMenu(element, 'firstname', 0);
        menuEntry('row.paste.cell').click();
        await sleep(0); // the clipboard is read async
        expect(firstnames(datasource)).toEqual(['pasted', 'pasted', 'pasted']);

        press(cellInput(element, 'lastname'), 'z');
        expect(firstnames(datasource)).toEqual(['a', 'b', 'c']);
        expect(cellInput(element, 'firstname', 2).value).toEqual('c');
        expect(datasource.canUndo()).toBe(false);
    });

    it('expect a clear over the selected rows to be one Ctrl+Z', async () => {
        const { element, datasource } = await mountGrid(editable(), data(), simpleFields());
        datasource.selectAll();

        openRowMenu(element, 'firstname', 0);
        menuEntry('row.clear.cell').click();
        expect(firstnames(datasource)).toEqual([null, null, null]);

        press(cellInput(element, 'lastname'), 'z');
        expect(firstnames(datasource)).toEqual(['a', 'b', 'c']);
    });

    it('expect a delete from the row menu to be undone with Ctrl+Z', async () => {
        const { element, datasource } = await mountGrid(editable(), data(), simpleFields());
        datasource.getSelection().selectRowRange(0, 1);

        openRowMenu(element, 'firstname', 0);
        menuEntry('row.delete.rows').click();
        expect(datasource.getAllData().map((row) => row.__rowState)).toEqual(['D', 'D', undefined]);
        await sleep(0);

        press(cellInput(element, 'lastname'), 'z');
        expect(datasource.getAllData().map((row) => row.__rowState)).toEqual([undefined, undefined, undefined]);
    });
});

describe('undo and redo - the row menu', () => {
    // the items of the Undo / Redo submenu, first in the menu
    const EDIT_IDS = ['row.edit.undo', 'row.edit.redo', 'row.edit.revertCell', 'row.edit.revertRow', 'row.edit.revertRows'];

    // the entry, its submenu opened on the way
    const entry = (id: string) => menuEntry(id);
    const isDisabled = (id: string) => entry(id).classList.contains('simple-html-grid-menu-item-disabled');
    const label = (id: string) => entry(id).textContent?.replace(/\s+/g, ' ').trim();
    // the ids of the Undo / Redo submenu and what is in it, the submenu opened
    const shownEditIds = () => {
        menuEntry('row.edit')?.click();
        return Array.from(document.querySelectorAll('.simple-html-grid-menu [data-menu-id]'))
            .map((el) => el.getAttribute('data-menu-id') ?? '')
            .filter((id) => id.startsWith('row.edit'));
    };

    it('expect the edit entries in an editable grid, greyed out with nothing to do', async () => {
        const { element } = await mountGrid(editable(), data(), simpleFields());

        openRowMenu(element, 'firstname', 0);

        expect(shownEditIds()).toEqual(['row.edit', ...EDIT_IDS]);
        expect(label('row.edit')).toMatch(/^Undo \/ Redo/);
        expect(EDIT_IDS.map(label)).toEqual([
            'Undo last change (Ctrl+Z)',
            'Redo (Ctrl+Y)',
            'Undo cell edit',
            'Undo row edits',
            'Undo row edits (selected rows)'
        ]);
        expect(EDIT_IDS.map(isDisabled)).toEqual([true, true, true, true, true]);
    });

    it('expect no edit entries in a readonly grid', async () => {
        const { element } = await mountGrid(simpleConfig(), data(), simpleFields());
        openRowMenu(element, 'firstname', 0);
        expect(shownEditIds()).toEqual([]);
    });

    it('expect undo and redo to be enabled when there is something to do, and to do it', async () => {
        const { element, datasource } = await mountGrid(editable(), data(), simpleFields());
        datasource.getAllData()[0].firstname = 'changed';
        await sleep(0);

        openRowMenu(element, 'lastname', 0);
        expect([isDisabled('row.edit.undo'), isDisabled('row.edit.redo')]).toEqual([false, true]);
        entry('row.edit.undo').click();
        expect(firstnames(datasource)[0]).toEqual('a');
        expect(cellInput(element, 'firstname').value).toEqual('a');

        openRowMenu(element, 'lastname', 0);
        expect([isDisabled('row.edit.undo'), isDisabled('row.edit.redo')]).toEqual([true, false]);
        entry('row.edit.redo').click();
        expect(firstnames(datasource)[0]).toEqual('changed');
        expect(cellInput(element, 'firstname').value).toEqual('changed');
    });

    it('expect revert cell for an edited cell only, putting its original value back as a step', async () => {
        const { element, datasource } = await mountGrid(editable(), data(), simpleFields());
        const [first] = datasource.getAllData();
        first.firstname = 'changed';
        first.lastname = 'changed too';
        await sleep(0);

        openRowMenu(element, 'age', 0);
        expect(isDisabled('row.edit.revertCell')).toBe(true);
        openRowMenu(element, 'firstname', 0);
        expect(isDisabled('row.edit.revertCell')).toBe(false);
        entry('row.edit.revertCell').click();

        expect([first.firstname, first.lastname]).toEqual(['a', 'changed too']);
        expect(cellInput(element, 'firstname').value).toEqual('a');
        await sleep(0);
        press(cellInput(element, 'age'), 'z');
        expect(first.firstname).toEqual('changed');
    });

    it('expect revert rows for the selected rows that are changed, as a step', async () => {
        const { element, datasource } = await mountGrid(editable(), data(), simpleFields());
        const [first, second, third] = datasource.getAllData();
        first.firstname = 'changed';
        datasource.markForDeletion(second);
        third.firstname = 'not selected';
        await sleep(0);

        datasource.getSelection().selectRowRange(1, 1);
        openRowMenu(element, 'firstname', 0);
        expect(isDisabled('row.edit.revertRows')).toBe(false);

        datasource.deselectAll();
        datasource.getSelection().selectRowRange(0, 1);
        openRowMenu(element, 'firstname', 0);
        entry('row.edit.revertRows').click();

        expect(firstnames(datasource)).toEqual(['a', 'b', 'not selected']);
        expect(datasource.getAllData().map((row) => row.__rowState)).toEqual([undefined, undefined, 'M']);
        await sleep(0);
        press(cellInput(element, 'age'), 'z');
        expect(firstnames(datasource)).toEqual(['changed', 'b', 'not selected']);
        expect(second.__rowState).toEqual('D');
    });

    it('expect revert rows for selected new rows, not edited: enabled, they are marked for deletion - undo brings them back', async () => {
        const { element, datasource } = await mountGrid(editable(), data(), simpleFields());
        datasource.addNewEmpty({ firstname: 'new 1' });
        datasource.addNewEmpty({ firstname: 'new 2' });
        const added = datasource.getAllData().slice(-2);
        await sleep(0);
        datasource.deselectAll();
        datasource.getSelection().selectRowRange(datasource.length() - 2, datasource.length() - 1);
        expect(datasource.getSelectedRows()).toEqual(added);

        openRowMenu(element, 'firstname', 0);
        expect(isDisabled('row.edit.revertRows')).toBe(false);
        entry('row.edit.revertRows').click();

        expect(added.map((row) => row.__rowState)).toEqual(['D', 'D']);
        expect(datasource.getChanges().newEntities).toEqual([]);
        // marked already: nothing left to undo for them
        openRowMenu(element, 'firstname', 0);
        expect(isDisabled('row.edit.revertRows')).toBe(true);

        await sleep(0);
        press(cellInput(element, 'age'), 'z');
        expect(added.map((row) => row.__rowState)).toEqual(['N', 'N']);
    });

    it('expect undo row edits on a new row, not edited, to be enabled and mark it', async () => {
        const { element, datasource } = await mountGrid(editable(), data(), simpleFields());
        datasource.addNewEmpty({ firstname: 'new' });
        const added = datasource.getAllData().at(-1) as Entity;
        await sleep(0);
        const index = datasource.getRows().indexOf(added);

        openRowMenu(element, 'firstname', index);
        expect(isDisabled('row.edit.revertRow')).toBe(false);
        entry('row.edit.revertRow').click();
        expect(added.__rowState).toEqual('D');
    });

    it('expect the Undo / Redo submenu first in the menu', async () => {
        const { element } = await mountGrid(editable(), data(), simpleFields());

        openRowMenu(element, 'firstname', 0);

        const first = document.querySelector('.simple-html-grid-menu [data-menu-id]');
        expect(first?.getAttribute('data-menu-id')).toEqual('row.edit');
        expect(first?.getAttribute('aria-haspopup')).toEqual('menu');
    });

    it('expect undo row edits to revert the row right clicked, without selecting it, as one step', async () => {
        const { element, datasource } = await mountGrid(editable(), data(), simpleFields());
        const [first, second] = datasource.getAllData();
        first.firstname = 'changed';
        first.lastname = 'changed too';
        second.firstname = 'other row';
        await sleep(0);
        expect(datasource.getSelectedRows()).toEqual([]);

        openRowMenu(element, 'age', 0);
        expect(isDisabled('row.edit.revertRow')).toBe(false);
        // nothing selected: the selected rows' entry has nothing to do
        expect(isDisabled('row.edit.revertRows')).toBe(true);
        entry('row.edit.revertRow').click();

        expect([first.firstname, first.lastname]).toEqual(['a', 'x']);
        expect(second.firstname).toEqual('other row');
        expect(first.__rowState).toBeUndefined();
        expect(cellInput(element, 'firstname').value).toEqual('a');

        // one undo step: Ctrl+Z brings both fields back
        await sleep(0);
        press(cellInput(element, 'age'), 'z');
        expect([first.firstname, first.lastname]).toEqual(['changed', 'changed too']);
    });

    it('expect undo row edits to take the deletion mark off the row right clicked', async () => {
        const { element, datasource } = await mountGrid(editable(), data(), simpleFields());
        const first = datasource.getAllData()[0];
        datasource.markForDeletion(first);

        openRowMenu(element, 'firstname', 0);
        entry('row.edit.revertRow').click();

        expect(first.__rowState).toBeUndefined();
    });

    it('expect undo row edits greyed out on a row that is not changed', async () => {
        const { element, datasource } = await mountGrid(editable(), data(), simpleFields());
        datasource.getAllData()[1].firstname = 'changed';

        openRowMenu(element, 'firstname', 0);
        expect(isDisabled('row.edit.revertRow')).toBe(true);
    });

    it('expect no edit entries in a readonly grid', async () => {
        const { element } = await mountGrid({ ...editable(), readonly: true }, data(), simpleFields());

        openRowMenu(element, 'firstname', 0);
        expect(shownEditIds()).toEqual([]);
    });

    it('expect revert rows greyed out when no selected row is changed', async () => {
        const { element, datasource } = await mountGrid(editable(), data(), simpleFields());
        datasource.getAllData()[2].firstname = 'changed';
        datasource.getSelection().selectRowRange(0, 1);

        openRowMenu(element, 'firstname', 0);
        expect(isDisabled('row.edit.revertRows')).toBe(true);
    });
});

describe('undo and redo - the focus goes to what changed', () => {
    // 500 rows; note is a field that is not in the layout
    const many = () => Array.from({ length: 500 }, (_, i) => ({ firstname: `f${i}`, lastname: `l${i}`, age: i, note: `n${i}` }));
    const mountMany = () => mountGrid(editable(), many(), simpleFields());

    /** the input of a field in a displayed row, in a row element on screen */
    const inputAt = (element: HTMLElement, row: number, field: string) =>
        Array.from(element.querySelectorAll<HTMLInputElement>(`input[data-attribute="${field}"]`)).find((input) => {
            const cell = input.closest('.simple-html-grid-col-cell') as HTMLCellElement;
            return cell.$row === row && (input.closest('.simple-html-grid-row') as HTMLElement).style.display === 'block';
        }) as HTMLInputElement;
    /** the row and field of the cell with the focus */
    const focused = () => {
        const cell = document.activeElement?.closest('.simple-html-grid-col-cell') as HTMLCellElement | null;
        return cell ? { row: cell.$row, field: cell.$attribute } : null;
    };
    const scroller = (element: HTMLElement) => element.querySelector('.simple-html-grid-body-scroller') as HTMLElement;

    /** Ctrl+Z (or Ctrl+Y) in the cell of a row and field, focused first */
    const pressIn = (element: HTMLElement, row: number, field: string, key = 'z') => {
        const input = inputAt(element, row, field);
        input.focus();
        return press(input, key);
    };

    it('expect Ctrl+Z to focus the cell it changed and make its row the current row', async () => {
        const { element, datasource } = await mountMany();
        datasource.getRows()[5].lastname = 'x';
        await sleep(0);

        expect(pressIn(element, 0, 'firstname').defaultPrevented).toBe(true);

        expect(datasource.getRows()[5].lastname).toEqual('l5');
        expect(focused()).toEqual({ row: 5, field: 'lastname' });
        expect(datasource.currentEntity).toBe(datasource.getRows()[5]);
        // on screen: no scroll
        expect(scroller(element).scrollTop).toBe(0);
    });

    it('expect a change off screen scrolled to, in the middle of the view - and Ctrl+Y there again', async () => {
        const { element, datasource, gridInterface } = await mountMany();
        const rowHeight = gridInterface.__getGridConfig().__rowHeight;
        datasource.getRows()[400].age = 1;
        await sleep(0);

        pressIn(element, 0, 'firstname');

        expect(focused()).toEqual({ row: 400, field: 'age' });
        expect(scroller(element).scrollTop).toBe(Math.round(400 * rowHeight - (600 - rowHeight) / 2));

        // back at the top, Ctrl+Y redoes it: there again
        press(document.activeElement as HTMLInputElement, 'Home', { ctrlKey: true });
        expect(focused()).toEqual({ row: 0, field: 'firstname' });
        expect(press(document.activeElement as HTMLInputElement, 'y').defaultPrevented).toBe(true);
        expect(datasource.getRows()[400].age).toBe(1);
        expect(focused()).toEqual({ row: 400, field: 'age' });
    });

    it('expect the first change of a step: the first one made', async () => {
        const { element, datasource } = await mountMany();
        // one step: row 7 first, then row 3
        datasource.getRows()[7].lastname = 'x';
        datasource.getRows()[3].lastname = 'y';
        await sleep(0);

        pressIn(element, 0, 'firstname');

        expect(datasource.getRows()[3].lastname).toEqual('l3');
        expect(focused()).toEqual({ row: 7, field: 'lastname' });
    });

    it('expect a deletion mark undone to focus its row, in the column of the cell the key was pressed in', async () => {
        const { element, datasource } = await mountMany();
        datasource.markForDeletion([datasource.getRows()[9]]);
        await sleep(0);

        pressIn(element, 0, 'age');

        expect(datasource.getRows()[9].__controller.__isDeleted).toBeFalsy();
        expect(focused()).toEqual({ row: 9, field: 'age' });
    });

    it('expect a change of a field not in the layout to focus its row, in the column of the cell', async () => {
        const { element, datasource } = await mountMany();
        datasource.getRows()[12].note = 'x';
        await sleep(0);

        pressIn(element, 0, 'lastname');

        expect(datasource.getRows()[12].note).toEqual('n12');
        expect(focused()).toEqual({ row: 12, field: 'lastname' });
    });

    it('expect the focus to stay when the row of the change is not displayed', async () => {
        const { element, datasource } = await mountMany();
        const hidden = datasource.getRows()[300];
        hidden.lastname = 'x';
        await sleep(0);
        datasource.filter(where('age', 'LESS_THAN', 10));

        expect(pressIn(element, 2, 'firstname').defaultPrevented).toBe(true);

        expect(hidden.lastname).toEqual('l300');
        expect(focused()).toEqual({ row: 2, field: 'firstname' });
    });

    it('expect the row menu Undo / Redo to focus the cell they changed', async () => {
        const { element, datasource } = await mountMany();
        datasource.getRows()[300].firstname = 'x';
        await sleep(0);

        inputAt(element, 0, 'lastname').focus();
        openRowMenu(element, 'lastname', 0);
        menuEntry('row.edit.undo').click();

        expect(datasource.getRows()[300].firstname).toEqual('f300');
        expect(focused()).toEqual({ row: 300, field: 'firstname' });

        press(document.activeElement as HTMLInputElement, 'Home', { ctrlKey: true });
        openRowMenu(element, 'age', 0);
        menuEntry('row.edit.redo').click();
        expect(focused()).toEqual({ row: 300, field: 'firstname' });
    });

    it('expect datasource.undo() from code not to move the focus', async () => {
        const { element, datasource } = await mountMany();
        datasource.getRows()[8].lastname = 'x';
        await sleep(0);
        inputAt(element, 1, 'firstname').focus();

        datasource.undo();

        expect(focused()).toEqual({ row: 1, field: 'firstname' });
    });
});

describe('undo and redo - on a Mac', () => {
    const label = (id: string) => menuEntry(id).textContent?.replace(/\s+/g, ' ').trim();
    const mac = () => vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');

    afterEach(() => {
        vi.restoreAllMocks();
        Reflect.deleteProperty(navigator, 'userAgentData');
    });

    it('expect the hints ⌘Z and ⇧⌘Z in the row menu on a Mac, Ctrl+Z and Ctrl+Y elsewhere', async () => {
        const { element } = await mountGrid(editable(), data(), simpleFields());

        openRowMenu(element, 'firstname', 0);
        expect([label('row.edit.undo'), label('row.edit.redo')]).toEqual(['Undo last change (Ctrl+Z)', 'Redo (Ctrl+Y)']);

        mac();
        openRowMenu(element, 'firstname', 0);
        expect([label('row.edit.undo'), label('row.edit.redo')]).toEqual(['Undo last change (⌘Z)', 'Redo (⇧⌘Z)']);
    });

    it('expect the Mac texts from the texts of the grid, translated', async () => {
        const texts = { 'row.edit.undo.hint.mac': 'Cmd-Z', 'row.edit.redo.hint.mac': 'Shift-Cmd-Z' };
        const { element } = await mountGrid({ ...editable(), texts }, data(), simpleFields());
        mac();

        openRowMenu(element, 'firstname', 0);

        expect([label('row.edit.undo'), label('row.edit.redo')]).toEqual(['Undo last change (Cmd-Z)', 'Redo (Shift-Cmd-Z)']);
    });

    it('expect the keys a Mac user presses to work: Cmd+Z, Cmd+Shift+Z, Cmd+Y', async () => {
        const { element, datasource } = await mountGrid(editable(), data(), simpleFields());
        mac();
        datasource.getAllData()[0].firstname = 'changed';
        await sleep(0);
        const input = cellInput(element, 'lastname');

        expect(press(input, 'z', { metaKey: true }).defaultPrevented).toBe(true);
        expect(firstnames(datasource)[0]).toEqual('a');
        expect(press(input, 'z', { metaKey: true, shiftKey: true }).defaultPrevented).toBe(true);
        expect(firstnames(datasource)[0]).toEqual('changed');
        press(cellInput(element, 'lastname'), 'z', { metaKey: true });
        expect(press(cellInput(element, 'lastname'), 'y', { metaKey: true }).defaultPrevented).toBe(true);
        expect(firstnames(datasource)[0]).toEqual('changed');
    });

    it('expect the platform from userAgentData where there is one, else navigator.platform', () => {
        const platforms: [string | undefined, string, boolean][] = [
            [undefined, 'MacIntel', true],
            [undefined, 'iPhone', true],
            [undefined, 'iPad', true],
            [undefined, 'Win32', false],
            [undefined, 'Linux x86_64', false],
            ['macOS', 'Linux x86_64', true],
            ['Windows', 'MacIntel', false],
            // an empty one: navigator.platform
            ['', 'MacIntel', true]
        ];
        const platform = vi.spyOn(navigator, 'platform', 'get');
        for (const [userAgentData, navigatorPlatform, expected] of platforms) {
            platform.mockReturnValue(navigatorPlatform);
            Reflect.deleteProperty(navigator, 'userAgentData');
            if (userAgentData !== undefined) {
                Object.defineProperty(navigator, 'userAgentData', { configurable: true, value: { platform: userAgentData } });
            }
            expect(isMacPlatform(), `${userAgentData} / ${navigatorPlatform}`).toBe(expected);
        }
    });

    it('expect the hint of the multiline editor and the tooltip of the find bar for a Mac', async () => {
        const config: GridConfig = { ...editable(), layout: { center: [{ fields: ['firstname'], width: 100 }] } };
        const { element, gridInterface } = await mountGrid(config, data(), { fields: { firstname: { multiline: true } } });
        mac();

        press(cellInput(element, 'firstname'), 'Enter', {});
        expect(document.querySelector('.simple-html-grid-text-editor-hint')?.textContent?.trim()).toEqual(
            '⌘Enter to save, Esc to cancel'
        );
        press(document.querySelector('.simple-html-grid-text-editor textarea') as HTMLInputElement, 'Escape', {});

        gridInterface.openFind();
        const previous = element.querySelector('.simple-html-grid-find-button[aria-label="Previous match"]');
        expect(previous?.getAttribute('title')).toEqual('Previous match (⇧Enter)');
    });
});
