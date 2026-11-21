// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { and, or, where } from '../../datasource/filterExpression';
import { DROPDOWN_FILTER_MAX_ROWS } from '../gridFunctions/dropDownFilterData';
import { mountGrid, simpleConfig, stubCanvas, stubElementSizes } from './gridTestHelpers';
import {
    headerFilterInput,
    menuEntry,
    menuItem,
    openFilterMenu,
    typeInHeaderFilter,
    valueCheckbox,
    valueRow
} from './interactionTestHelpers';

/**
 * The right click menu on a header filter: "Is Blank" and the excel style value list.
 */

const names = (datasource: any) => datasource.getDataRows().map((row: any) => row.firstname);

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('filter menu - "Is Blank"', () => {
    const data = () => [
        { firstname: 'a', lastname: 'x', age: 1 },
        { firstname: 'b', lastname: null, age: 2 },
        { firstname: 'c', lastname: 'z', age: 3 },
        { firstname: 'd', lastname: null, age: 4 }
    ];

    it('expect "Is Blank" on an OR filter to narrow it, not widen it', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), data());
        datasource.filter(or(where('firstname', 'EQUAL', 'a'), where('firstname', 'EQUAL', 'b')));

        openFilterMenu(element, 'lastname');
        menuEntry('filter.filter.isBlank').click();

        expect(names(datasource)).toEqual(['b']);
    });

    it('expect "Is Blank" to keep a single condition on another column', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), data());
        datasource.filter(where('age', 'LESS_THAN', 3));

        openFilterMenu(element, 'lastname');
        menuEntry('filter.filter.isBlank').click();

        // v5 dropped a root condition that was not in a group
        expect(datasource.getFilter()).toEqual(and(where('lastname', 'IS_BLANK'), where('age', 'LESS_THAN', 3)));
        expect(names(datasource)).toEqual(['b']);
    });

    it('expect "Is Blank" to replace a single condition on its own column', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), data());
        datasource.filter(where('lastname', 'EQUAL', 'x'));

        openFilterMenu(element, 'lastname');
        menuEntry('filter.filter.isBlank').click();

        expect(datasource.getFilter()).toEqual(and(where('lastname', 'IS_BLANK')));
        expect(names(datasource)).toEqual(['b', 'd']);
    });

    it('expect "Is Blank" to clear the text filter shown in the header', async () => {
        const { element } = await mountGrid(simpleConfig(), data());
        typeInHeaderFilter(element, 'lastname', 'x');

        openFilterMenu(element, 'lastname');
        menuEntry('filter.filter.isBlank').click();

        expect(headerFilterInput(element, 'lastname').value).toEqual('');
    });
});

describe('filter menu - "Clear Filter"', () => {
    const data = () => [
        { firstname: 'a', lastname: 'x', age: 1 },
        { firstname: 'b', lastname: 'y', age: 2 },
        { firstname: 'c', lastname: 'z', age: 3 }
    ];

    it('expect the column conditions to be removed from nested groups too, the rest kept', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), data());
        datasource.filter(
            and(where('lastname', 'EQUAL', 'x'), or(where('lastname', 'EQUAL', 'z'), where('age', 'LESS_THAN', 3)))
        );

        openFilterMenu(element, 'lastname');
        menuItem('Clear Filter').click();

        expect(datasource.getFilter()).toEqual(and(or(where('age', 'LESS_THAN', 3))));
        expect(names(datasource)).toEqual(['a', 'b']);
    });

    it('expect the filter object that was set not to be changed', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), data());
        const filter = and(where('lastname', 'EQUAL', 'x'), where('age', 'LESS_THAN', 3));
        datasource.filter(filter);

        openFilterMenu(element, 'lastname');
        menuItem('Clear Filter').click();

        expect(filter).toEqual(and(where('lastname', 'EQUAL', 'x'), where('age', 'LESS_THAN', 3)));
        expect(names(datasource)).toEqual(['a', 'b']);
    });

    it('expect a single condition on the column to leave no filter', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), data());
        datasource.filter(where('lastname', 'EQUAL', 'x'));

        openFilterMenu(element, 'lastname');
        menuItem('Clear Filter').click();

        expect(datasource.getFilter()).toEqual(null);
        expect(names(datasource)).toEqual(['a', 'b', 'c']);
    });
});

describe('filter menu - value list', () => {
    const data = () => ['a', 'b', 'c', 'd', 'e'].map((firstname, i) => ({ firstname, lastname: 'x', age: i }));

    const valueChecked = (value: string) => valueCheckbox(value).checked;

    /**
     * open the value list on firstname, toggle the given values (a click on the row), apply it
     */
    function runValueList(element: any, toggle: string[]) {
        openFilterMenu(element, 'firstname');
        toggle.forEach((value) => {
            valueRow(value).click();
        });
        menuItem('Apply').click();
    }

    it('expect unchecking one more value to keep the values excluded earlier', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), data());
        runValueList(element, ['D', 'E']);
        expect(names(datasource)).toEqual(['a', 'b', 'c']);

        runValueList(element, ['A']);

        expect(names(datasource)).toEqual(['b', 'c']);
    });

    it('expect the values the column excluded itself to be listed unchecked', async () => {
        const { element } = await mountGrid(simpleConfig(), data());
        runValueList(element, ['D', 'E']);

        openFilterMenu(element, 'firstname');

        expect(valueChecked('A')).toEqual(true);
        expect(valueChecked('D')).toEqual(false);
        expect(valueChecked('E')).toEqual(false);
    });

    it('expect checking an excluded value again to bring it back', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), data());
        runValueList(element, ['D', 'E']);

        runValueList(element, ['D']);

        expect(names(datasource)).toEqual(['a', 'b', 'c', 'd']);
    });
});

describe('filter menu - the value list: what it shows', () => {
    // 'a' three times, 'b' once, one blank
    const data = () => ['a', 'a', 'b', null, 'a'].map((firstname, i) => ({ firstname, lastname: i < 3 ? 'x' : 'y', age: i }));

    const list = () => document.querySelector('[data-menu-id="filter.values"]') as HTMLElement;
    const info = () => list().querySelector('.simple-html-grid-value-info') as HTMLElement;
    const search = () => list().querySelector('.simple-html-grid-value-search') as HTMLInputElement;
    const typeSearch = (text: string) => {
        search().value = text;
        search().dispatchEvent(new Event('input'));
    };

    it('expect a search box framed as an input, named, with a placeholder, and how many values there are', async () => {
        const { element } = await mountGrid(simpleConfig(), data());
        openFilterMenu(element, 'firstname');

        expect([search().tagName, search().type]).toEqual(['INPUT', 'text']);
        expect([search().getAttribute('aria-label'), search().placeholder]).toEqual(['Search values', 'Search values']);
        // the values are counted, not the rows: Blank, A and B
        expect(info().textContent?.trim()).toEqual('3 values');
        // read out when it changes
        expect(info().getAttribute('aria-live')).toEqual('polite');
        // no "Search:" section over it any more
        expect(list().querySelector('.simple-html-grid-menu-section')).toBeNull();
    });

    it('expect "1 value" for one, and the search to narrow the list', async () => {
        const { element } = await mountGrid(simpleConfig(), data());
        const shown = () =>
            Array.from(list().querySelectorAll('.simple-html-grid-value-scroll .simple-html-grid-value-text'), (text) =>
                text.textContent?.trim()
            );
        openFilterMenu(element, 'firstname');

        typeSearch('b');
        // Blank stays in the list
        expect([info().textContent?.trim(), shown()]).toEqual(['2 values', ['Blank', 'B']]);

        // lastname has no blanks
        openFilterMenu(element, 'lastname');
        typeSearch('y');
        expect([info().textContent?.trim(), shown()]).toEqual(['1 value', ['Y']]);
    });

    it('expect each value with its number of rows on its right, no parentheses, Blank first and in italics', async () => {
        const { element } = await mountGrid(simpleConfig(), data());
        openFilterMenu(element, 'firstname');

        const rows = Array.from(list().querySelectorAll('.simple-html-grid-value-scroll .simple-html-grid-value-row'), (row) => [
            row.querySelector('.simple-html-grid-value-text')?.textContent?.trim(),
            row.querySelector('.simple-html-grid-value-count')?.textContent?.trim()
        ]);
        expect(rows).toEqual([
            ['Blank', '1'],
            ['A', '3'],
            ['B', '1']
        ]);
        expect(valueRow('Blank').querySelector('.simple-html-grid-value-blank')).not.toBeNull();
        expect(valueRow('A').querySelector('.simple-html-grid-value-blank')).toBeNull();
        // the label around it: the checkbox's name is the value and its count, a click on the row checks it
        expect(valueRow('A').tagName).toEqual('LABEL');
        expect(valueRow('A').contains(valueCheckbox('A'))).toBe(true);
    });

    it('expect no counts and a warning when the list is cut off', async () => {
        const many = Array.from({ length: DROPDOWN_FILTER_MAX_ROWS + 5 }, (_, i) => ({
            firstname: `v${i}`,
            lastname: 'x',
            age: i
        }));
        const { element } = await mountGrid(simpleConfig(), many);
        openFilterMenu(element, 'firstname');

        expect(info().textContent?.trim()).toEqual(`Only the first ${DROPDOWN_FILTER_MAX_ROWS} values are shown`);
        expect(info().querySelector('.simple-html-grid-value-warning')).not.toBeNull();
        expect(list().querySelectorAll('.simple-html-grid-value-count')).toHaveLength(0);
    });

    it('expect the whole value as the tooltip of one that is cut off, none for one that fits', async () => {
        const { element } = await mountGrid(simpleConfig(), data());
        openFilterMenu(element, 'firstname');
        const text = (value: string) => valueRow(value).querySelector('.simple-html-grid-value-text') as HTMLElement;
        // happy-dom lays nothing out: wider than it is shown, and as wide
        Object.defineProperty(text('A'), 'scrollWidth', { configurable: true, value: 5000 });
        Object.defineProperty(text('B'), 'scrollWidth', { configurable: true, value: text('B').clientWidth });

        text('A').dispatchEvent(new MouseEvent('mouseenter'));
        text('B').dispatchEvent(new MouseEvent('mouseenter'));

        expect([text('A').title, text('B').title]).toEqual(['A', '']);
    });

    it('expect "Only values in filtered rows" when another column hides rows, unchecked it lists every value', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), data());
        datasource.filter({ group: 'AND', children: [{ field: 'lastname', operator: 'EQUAL', value: 'y' }] });
        openFilterMenu(element, 'firstname');
        const option = list().querySelector('.simple-html-grid-value-option') as HTMLLabelElement;

        expect(option.textContent?.trim()).toEqual('Only values in filtered rows');
        expect((option.querySelector('input') as HTMLInputElement).checked).toBe(true);
        expect(info().textContent?.trim()).toEqual('2 values');

        option.click();

        expect((option.querySelector('input') as HTMLInputElement).checked).toBe(false);
        expect(info().textContent?.trim()).toEqual('3 values');
    });
});

describe('filter menu - the value list: "Select all", checked, unchecked or mixed', () => {
    const data = () => ['a', 'b', 'c'].map((firstname, i) => ({ firstname, lastname: 'x', age: i }));
    const selectAll = () => document.querySelector('.simple-html-grid-value-all input') as HTMLInputElement;
    const state = () => [selectAll().checked, selectAll().indeterminate];
    const checkedValues = () => ['A', 'B', 'C'].filter((value) => valueCheckbox(value).checked);

    it('expect it to be the header of the list: a row with a line under it, over the box that scrolls', async () => {
        const { element } = await mountGrid(simpleConfig(), data());
        openFilterMenu(element, 'firstname');
        const row = selectAll().closest('label') as HTMLElement;

        expect(row.textContent?.trim()).toEqual('Select all');
        expect(row.parentElement?.classList.contains('simple-html-grid-value-box')).toBe(true);
        expect(row.nextElementSibling?.classList.contains('simple-html-grid-value-scroll')).toBe(true);
    });

    it('expect checked when every value is, mixed when some are, unchecked when none is', async () => {
        const { element } = await mountGrid(simpleConfig(), data());
        openFilterMenu(element, 'firstname');
        expect(state()).toEqual([true, false]);

        valueRow('A').click();
        expect(state()).toEqual([false, true]);

        valueRow('B').click();
        valueRow('C').click();
        expect(state()).toEqual([false, false]);

        valueRow('B').click();
        expect(state()).toEqual([false, true]);
        valueRow('A').click();
        valueRow('C').click();
        expect(state()).toEqual([true, false]);
    });

    it('expect a click on it to check every value when some or none are, and to uncheck all when all are', async () => {
        const { element } = await mountGrid(simpleConfig(), data());
        openFilterMenu(element, 'firstname');

        selectAll().click();
        expect([state(), checkedValues()]).toEqual([[false, false], []]);

        valueRow('B').click();
        selectAll().click();
        expect([state(), checkedValues()]).toEqual([
            [true, false],
            ['A', 'B', 'C']
        ]);
    });

    it('expect it to open mixed when the column has values filtered away', async () => {
        const { element } = await mountGrid(simpleConfig(), data());
        openFilterMenu(element, 'firstname');
        valueRow('B').click();
        menuItem('Apply').click();

        openFilterMenu(element, 'firstname');

        // it showed checked before
        expect(state()).toEqual([false, true]);
        expect(checkedValues()).toEqual(['A', 'C']);
    });

    it('expect it to be disabled when the search finds no value', async () => {
        const { element } = await mountGrid(simpleConfig(), data());
        openFilterMenu(element, 'firstname');
        const search = document.querySelector('.simple-html-grid-value-search') as HTMLInputElement;

        search.value = 'nothing like it';
        search.dispatchEvent(new Event('input'));

        expect([selectAll().disabled, ...state()]).toEqual([true, false, false]);
        expect(document.querySelector('.simple-html-grid-value-info')?.textContent?.trim()).toEqual('0 values');
    });
});

describe('filter menu - the value list: Apply, Cancel and the keyboard', () => {
    const data = () => ['a', 'b', 'c'].map((firstname, i) => ({ firstname, lastname: 'x', age: i }));
    const press = (target: Element, key: string) => {
        const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
        target.dispatchEvent(event);
        return event;
    };
    const menuOpen = () => document.querySelector('.simple-html-grid-menu') !== null;
    const buttons = () => Array.from(document.querySelectorAll<HTMLButtonElement>('.simple-html-grid-value-buttons button'));

    it('expect Cancel and Apply, buttons, Apply the primary one', async () => {
        const { element } = await mountGrid(simpleConfig(), data());
        openFilterMenu(element, 'firstname');

        expect(buttons().map((button) => [button.textContent?.trim(), button.type])).toEqual([
            ['Cancel', 'button'],
            ['Apply', 'button']
        ]);
        expect(buttons()[1].classList.contains('simple-html-grid-button-primary')).toBe(true);
    });

    it('expect Cancel to close the menu and leave the filter as it was', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), data());
        openFilterMenu(element, 'firstname');
        valueRow('A').click();

        buttons()[0].click();

        expect(menuOpen()).toBe(false);
        expect(datasource.getFilter()).toBeNull();
        expect(names(datasource)).toEqual(['a', 'b', 'c']);
    });

    it('expect Enter on a checkbox to apply, as Apply does', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), data());
        openFilterMenu(element, 'firstname');
        valueRow('A').click();

        const enter = press(valueCheckbox('B'), 'Enter');

        expect(enter.defaultPrevented).toBe(true);
        expect(menuOpen()).toBe(false);
        expect(names(datasource)).toEqual(['b', 'c']);
    });

    it('expect Enter in the search box to apply the search: a CONTAINS', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), data());
        openFilterMenu(element, 'firstname');
        const search = document.querySelector('.simple-html-grid-value-search') as HTMLInputElement;
        search.value = 'b';
        search.dispatchEvent(new Event('input'));

        press(document.querySelector('.simple-html-grid-value-search') as HTMLElement, 'Enter');

        expect(menuOpen()).toBe(false);
        expect(datasource.getFilter()).toEqual(and(where('firstname', 'CONTAINS', 'b')));
        expect(names(datasource)).toEqual(['b']);
    });

    it('expect ArrowDown / ArrowUp to move between the search box and the checkboxes', async () => {
        const { element } = await mountGrid(simpleConfig(), data());
        openFilterMenu(element, 'firstname');
        const search = document.querySelector('.simple-html-grid-value-search') as HTMLInputElement;
        search.focus();
        const focused = () =>
            document.activeElement === search
                ? 'search'
                : document.activeElement?.closest('label')?.querySelector('.simple-html-grid-value-text')?.textContent?.trim();

        const moves = ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp'].map((key) => {
            press(document.activeElement as HTMLElement, key);
            return focused();
        });

        // the first ArrowUp in the search box stays there
        expect(moves).toEqual(['Select all', 'A', 'B', 'A', 'Select all', 'search', 'search']);
    });
});
