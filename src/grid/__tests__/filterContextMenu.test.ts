// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Datasource } from '../../datasource/dataSource';
import { isGroupRow } from '../../datasource/entity';
import { and, or, where } from '../../datasource/filterExpression';
import { registerFormatter } from '../../datasource/formatterRegistry';
import { TextFormatter } from '../../datasource/textFormatter';
import type { GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import { DROPDOWN_FILTER_MAX_ROWS } from '../gridFunctions/dropDownFilterData';
import { registerLookup } from '../lookup';
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
    // the phone without its spaces, as the custom formatter sample
    registerFormatter('fcm-compact', {
        ...TextFormatter,
        format: (value: unknown) => TextFormatter.format(value).replaceAll(' ', '')
    });
    const countries = new Datasource();
    countries.setData([
        { code: 'NO', name: 'Norway' },
        { code: 'SE', name: 'Sweden' },
        { code: 'DK', name: 'Denmark' }
    ]);
    registerLookup('fcm-countries', { datasource: countries, valueField: 'code', labelField: 'name' });
    const customers = new Datasource({ fields: { id: 'number' } });
    customers.setData([
        { id: 1, name: 'ACME' },
        { id: 2, name: 'Globex' }
    ]);
    registerLookup('fcm-customers', { datasource: customers, valueField: 'id', labelField: 'name' });
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
        runValueList(element, ['d', 'e']);
        expect(names(datasource)).toEqual(['a', 'b', 'c']);

        runValueList(element, ['a']);

        expect(names(datasource)).toEqual(['b', 'c']);
    });

    it('expect the values the column excluded itself to be listed unchecked', async () => {
        const { element } = await mountGrid(simpleConfig(), data());
        runValueList(element, ['d', 'e']);

        openFilterMenu(element, 'firstname');

        expect(valueChecked('a')).toEqual(true);
        expect(valueChecked('d')).toEqual(false);
        expect(valueChecked('e')).toEqual(false);
    });

    it('expect checking an excluded value again to bring it back', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), data());
        runValueList(element, ['d', 'e']);

        runValueList(element, ['d']);

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
        // Blank has no text to find: not with a search (it stayed, and was not filtered on)
        expect([info().textContent?.trim(), shown()]).toEqual(['1 value', ['b']]);

        openFilterMenu(element, 'lastname');
        typeSearch('');
        expect([info().textContent?.trim(), shown()]).toEqual(['2 values', ['x', 'y']]);
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
            ['a', '3'],
            ['b', '1']
        ]);
        expect(valueRow('Blank').querySelector('.simple-html-grid-value-blank')).not.toBeNull();
        expect(valueRow('a').querySelector('.simple-html-grid-value-blank')).toBeNull();
        // the label around it: the checkbox's name is the value and its count, a click on the row checks it
        expect(valueRow('a').tagName).toEqual('LABEL');
        expect(valueRow('a').contains(valueCheckbox('a'))).toBe(true);
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
        Object.defineProperty(text('a'), 'scrollWidth', { configurable: true, value: 5000 });
        Object.defineProperty(text('b'), 'scrollWidth', { configurable: true, value: text('b').clientWidth });

        text('a').dispatchEvent(new MouseEvent('mouseenter'));
        text('b').dispatchEvent(new MouseEvent('mouseenter'));

        expect([text('a').title, text('b').title]).toEqual(['a', '']);
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
    const checkedValues = () => ['a', 'b', 'c'].filter((value) => valueCheckbox(value).checked);

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

        valueRow('a').click();
        expect(state()).toEqual([false, true]);

        valueRow('b').click();
        valueRow('c').click();
        expect(state()).toEqual([false, false]);

        valueRow('b').click();
        expect(state()).toEqual([false, true]);
        valueRow('a').click();
        valueRow('c').click();
        expect(state()).toEqual([true, false]);
    });

    it('expect a click on it to check every value when some or none are, and to uncheck all when all are', async () => {
        const { element } = await mountGrid(simpleConfig(), data());
        openFilterMenu(element, 'firstname');

        selectAll().click();
        expect([state(), checkedValues()]).toEqual([[false, false], []]);

        valueRow('b').click();
        selectAll().click();
        expect([state(), checkedValues()]).toEqual([
            [true, false],
            ['a', 'b', 'c']
        ]);
    });

    it('expect it to open mixed when the column has values filtered away', async () => {
        const { element } = await mountGrid(simpleConfig(), data());
        openFilterMenu(element, 'firstname');
        valueRow('b').click();
        menuItem('Apply').click();

        openFilterMenu(element, 'firstname');

        // it showed checked before
        expect(state()).toEqual([false, true]);
        expect(checkedValues()).toEqual(['a', 'c']);
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
        valueRow('a').click();

        buttons()[0].click();

        expect(menuOpen()).toBe(false);
        expect(datasource.getFilter()).toBeNull();
        expect(names(datasource)).toEqual(['a', 'b', 'c']);
    });

    it('expect Enter on a checkbox to apply, as Apply does', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), data());
        openFilterMenu(element, 'firstname');
        valueRow('a').click();

        const enter = press(valueCheckbox('b'), 'Enter');

        expect(enter.defaultPrevented).toBe(true);
        expect(menuOpen()).toBe(false);
        expect(names(datasource)).toEqual(['b', 'c']);
    });

    /**
     * the search searches the texts the cells show, a CONTAINS (it was) compares the values: an IN of
     * the values the search found and are checked
     */
    it('expect Enter in the search box to apply what the search found: an IN of its values', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), data());
        openFilterMenu(element, 'firstname');
        const search = document.querySelector('.simple-html-grid-value-search') as HTMLInputElement;
        search.value = 'b';
        search.dispatchEvent(new Event('input'));

        press(document.querySelector('.simple-html-grid-value-search') as HTMLElement, 'Enter');

        expect(menuOpen()).toBe(false);
        expect(datasource.getFilter()).toEqual(and(where('firstname', 'IN', ['b'])));
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
        expect(moves).toEqual(['Select all', 'a', 'b', 'a', 'Select all', 'search', 'search']);
    });
});

describe('filter menu - the value list: a text search', () => {
    const data = () => ['anna', 'anne', 'bob', 'dan', 'Annika'].map((firstname, i) => ({ firstname, lastname: 'x', age: i }));
    const search = (text: string) => {
        const box = document.querySelector('.simple-html-grid-value-search') as HTMLInputElement;
        box.value = text;
        box.dispatchEvent(new Event('input'));
    };
    const option = () => document.querySelector('.simple-html-grid-value-text-search') as HTMLLabelElement | null;
    const optionBox = () => option()?.querySelector('input') as HTMLInputElement;
    const toggleOption = () => {
        optionBox().checked = !optionBox().checked;
        optionBox().dispatchEvent(new Event('change'));
    };
    const apply = () =>
        Array.from(document.querySelectorAll<HTMLButtonElement>('.simple-html-grid-value-buttons button'))[1].click();
    const valueBoxes = () =>
        Array.from(document.querySelectorAll<HTMLInputElement>('.simple-html-grid-value-scroll input')).map((box) => [
            box.checked,
            box.disabled
        ]);

    it('expect the option only with text in the search box, unchecked, saying the text', async () => {
        const { element } = await mountGrid(simpleConfig(), data());
        openFilterMenu(element, 'firstname');
        expect(option()).toBeNull();

        search('  an ');
        expect(option()?.textContent?.trim()).toEqual('Filter on the text: contains "an"');
        expect(optionBox().checked).toBe(false);
        search('');
        expect(option()).toBeNull();
    });

    it('expect the list a preview while it is checked: every value it found checked and greyed out, given back unchecked', async () => {
        const { element } = await mountGrid(simpleConfig(), data());
        openFilterMenu(element, 'firstname');
        search('an');
        valueRow('anna').click();
        toggleOption();

        expect(document.querySelector('.simple-html-grid-value-preview')).not.toBeNull();
        expect(valueBoxes()).toEqual([
            [true, true],
            [true, true],
            [true, true],
            [true, true]
        ]);
        toggleOption();
        expect(document.querySelector('.simple-html-grid-value-preview')).toBeNull();
        // the draft of the values as it was
        expect(valueBoxes().map(([checked]) => checked)).toEqual([false, true, true, true]);
    });

    it('expect Apply to filter on the text: CONTAINS in the header filter, the cell shows it, the event once', async () => {
        const { element, datasource, gridInterface } = await mountGrid(simpleConfig(), data());
        const events: string[] = [];
        gridInterface.on('filter-operator-change', (event) => events.push(`${event.field} ${event.operator}`));
        openFilterMenu(element, 'firstname');
        search('an');
        toggleOption();
        apply();

        expect(document.querySelector('.simple-html-grid-menu')).toBeNull();
        expect(datasource.getFilter()).toEqual(and(where('firstname', 'CONTAINS', 'an')));
        expect(names(datasource)).toEqual(['anna', 'anne', 'dan', 'Annika']);
        expect(gridInterface.getState().headerFilters.firstname).toMatchObject({ value: 'an', operator: 'CONTAINS' });
        expect(headerFilterInput(element, 'firstname').value).toEqual('an');
        expect(events).toEqual(['firstname CONTAINS']);

        // a row added later with the text is found too: it is a text filter, not a list of values
        datasource.setData([...data(), { firstname: 'Johan', lastname: 'x', age: 9 }]);
        datasource.filter(datasource.getFilter());
        expect(names(datasource)).toContain('Johan');
    });

    it('expect Enter in the search box to apply the text search while it is checked, wildcards in it as in the cell', async () => {
        const { element, datasource } = await mountGrid(simpleConfig(), data());
        openFilterMenu(element, 'firstname');
        search('a_n');
        toggleOption();
        const box = document.querySelector('.simple-html-grid-value-search') as HTMLInputElement;
        box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));

        expect(datasource.getFilter()).toEqual(and(where('firstname', 'CONTAINS', 'a_n')));
        // _ is one character: anna, anne (a-n-n), Annika
        expect(names(datasource)).toEqual(['anna', 'anne', 'Annika']);
    });

    it('expect no option for a column whose filterOperators have no CONTAINS', async () => {
        const config = simpleConfig();
        config.columns = { firstname: { filterOperators: ['EQUAL', 'IN'] } };
        const { element } = await mountGrid(config, data());
        openFilterMenu(element, 'firstname');
        search('an');
        expect(option()).toBeNull();
    });

    it('expect a lookup column to search its labels', async () => {
        const config: GridConfig = {
            columns: { country: { label: 'Country', editor: { type: 'select', lookup: 'fcm-countries' } } },
            layout: {
                center: [
                    { fields: ['firstname'], width: 100 },
                    { fields: ['country'], width: 100 }
                ]
            }
        };
        const rows = [
            { firstname: 'a', country: 'NO' },
            { firstname: 'b', country: 'SE' },
            { firstname: 'c', country: 'DK' }
        ];
        const { element, datasource } = await mountGrid(config, rows, {});
        openFilterMenu(element, 'country');
        search('den');
        toggleOption();
        apply();
        // Sweden and Denmark have "den" in their labels
        expect(names(datasource)).toEqual(['b', 'c']);
        expect(headerFilterInput(element, 'country').value).toEqual('den');
    });
});

describe('filter menu - the value list shows the texts of the cells, Apply filters on their values', () => {
    const lookupConfig = (): GridConfig => ({
        columns: {
            country: { label: 'Country', editor: { type: 'select', lookup: 'fcm-countries' } },
            customer: { label: 'Customer', editor: { type: 'grid', lookup: 'fcm-customers' } }
        },
        layout: {
            center: [
                { fields: ['name'], width: 100 },
                { fields: ['country'], width: 100 },
                { fields: ['customer'], width: 100 }
            ]
        }
    });
    const lookupRows = () => [
        { name: 'a', country: 'NO', customer: 2 },
        { name: 'b', country: 'SE', customer: 1 },
        { name: 'c', country: 'NO', customer: 2 },
        // a value the lookup does not have, and blanks
        { name: 'd', country: 'XX', customer: null },
        { name: 'e', country: null, customer: 1 }
    ];
    const mountLookups = () => mountGrid(lookupConfig(), lookupRows(), { fields: { customer: 'number' } });

    const list = () => document.querySelector('[data-menu-id="filter.values"]') as HTMLElement;
    const shown = () =>
        Array.from(list().querySelectorAll('.simple-html-grid-value-scroll .simple-html-grid-value-row'), (row) =>
            [
                row.querySelector('.simple-html-grid-value-text')?.textContent?.trim(),
                row.querySelector('.simple-html-grid-value-count')?.textContent?.trim()
            ].join(' ')
        );
    const typeSearch = (text: string) => {
        const search = list().querySelector('.simple-html-grid-value-search') as HTMLInputElement;
        search.value = text;
        search.dispatchEvent(new Event('input'));
    };
    const selectAll = () => (document.querySelector('.simple-html-grid-value-all input') as HTMLInputElement).click();
    const rowNames = (datasource: any) => datasource.getDataRows().map((row: any) => row.name);
    /** the footer's chips: field, operator, value */
    const chips = (element: GridElement) =>
        Array.from(element.querySelectorAll('.footer-filter-chip'), (chip) => chip.textContent?.replace(/\s+/g, ' ').trim());

    it('expect a lookup column to list its labels with their counts, not its values', async () => {
        const { element } = await mountLookups();
        openFilterMenu(element, 'country');

        // in the order of the labels; a value the lookup does not have shows itself, as in the cell
        expect(shown()).toEqual(['Blank 1', 'Norway 2', 'Sweden 1', 'XX 1']);
    });

    it('expect Apply to filter on the values behind the labels: a NOT_IN of the unchecked, the chip shows the label', async () => {
        const { element, datasource, gridInterface } = await mountLookups();
        openFilterMenu(element, 'country');
        valueRow('Sweden').click();
        menuItem('Apply').click();

        // a normal filter of the datasource: the values
        expect(datasource.getFilter()).toEqual(and(where('country', 'NOT_IN', ['SE'])));
        expect(rowNames(datasource)).toEqual(['a', 'c', 'd', 'e']);
        expect(datasource.getFilterString()).toEqual("([COUNTRY] <<NOT_IN>> ['SE'])");
        // the footer shows the labels, as the cells
        expect(chips(element)).toEqual(['Country not in Sweden']);
        // the header filter cell is empty: a list is nothing it can show
        expect(gridInterface.getState().headerFilters).toEqual({});

        // opened again: Sweden unchecked
        openFilterMenu(element, 'country');
        expect([valueCheckbox('Sweden').checked, valueCheckbox('Norway').checked]).toEqual([false, true]);
    });

    it('expect a search to find the labels, Enter an IN of the values found', async () => {
        const { element, datasource } = await mountLookups();
        openFilterMenu(element, 'country');
        typeSearch('way');
        expect(shown()).toEqual(['Norway 2']);

        menuItem('Apply').click();

        expect(datasource.getFilter()).toEqual(and(where('country', 'IN', ['NO'])));
        expect(rowNames(datasource)).toEqual(['a', 'c']);
        expect(chips(element)).toEqual(['Country in Norway']);
    });

    it('expect the same IN as the header filter makes of a label', async () => {
        const { element, datasource } = await mountLookups();
        typeInHeaderFilter(element, 'country', 'norway');
        const typed = datasource.getFilter();

        openFilterMenu(element, 'country');
        menuItem('Clear Filter').click();
        openFilterMenu(element, 'country');
        selectAll();
        valueRow('Norway').click();
        menuItem('Apply').click();

        expect(datasource.getFilter()).toEqual(typed);
    });

    it('expect a lookup on a number field to have a value list of its labels, Apply to filter on the numbers', async () => {
        const { element, datasource } = await mountLookups();
        openFilterMenu(element, 'customer');
        expect(shown()).toEqual(['Blank 1', 'ACME 2', 'Globex 2']);

        valueRow('Globex').click();
        menuItem('Apply').click();

        expect(datasource.getFilter()).toEqual(and(where('customer', 'NOT_IN', [2])));
        expect(rowNames(datasource)).toEqual(['b', 'd', 'e']);
        expect(chips(element)).toEqual(['Customer not in Globex']);

        // more unchecked than checked: an IN, with the blanks
        openFilterMenu(element, 'customer');
        valueRow('ACME').click();
        menuItem('Apply').click();
        expect(datasource.getFilter()).toEqual(and(where('customer', 'IN', ['NULL'])));
        expect(rowNames(datasource)).toEqual(['d']);
        expect(chips(element)).toEqual(['Customer in NULL']);
    });

    it('expect the texts of a formatter: two values shown the same are one entry, both filtered', async () => {
        const { element, datasource } = await mountGrid(
            simpleConfig(),
            ['12 34', '1234', '56 78', '5', '6'].map((firstname, i) => ({ firstname, lastname: 'x', age: i })),
            { fields: { age: 'number', firstname: { formatter: 'fcm-compact' } } }
        );
        openFilterMenu(element, 'firstname');
        expect(shown()).toEqual(['1234 2', '5 1', '5678 1', '6 1']);

        valueRow('1234').click();
        menuItem('Apply').click();

        expect(datasource.getFilter()).toEqual(and(where('firstname', 'NOT_IN', ['12 34', '1234'])));
        expect(names(datasource)).toEqual(['56 78', '5', '6']);
    });

    it('expect values that differ in case only to be one entry, filtered together', async () => {
        const { element, datasource } = await mountGrid(
            simpleConfig(),
            ['Oslo', 'OSLO', 'Bergen', 'oslo'].map((firstname, i) => ({ firstname, lastname: 'x', age: i }))
        );
        openFilterMenu(element, 'firstname');
        expect(shown()).toEqual(['Bergen 1', 'Oslo 3']);

        valueRow('Oslo').click();
        menuItem('Apply').click();

        expect(names(datasource)).toEqual(['Bergen']);
    });

    it('expect unchecking Blank to leave out the empty cells: null, "" and 0', async () => {
        const { element, datasource } = await mountGrid(
            simpleConfig(),
            ['a', null, '', 0, 'b'].map((firstname, i) => ({ firstname, lastname: 'x', age: i }))
        );
        openFilterMenu(element, 'firstname');
        expect(shown()).toEqual(['Blank 3', 'a 1', 'b 1']);

        valueRow('Blank').click();
        menuItem('Apply').click();

        expect(datasource.getFilter()).toEqual(and(where('firstname', 'NOT_IN', ['NULL'])));
        expect(names(datasource)).toEqual(['a', 'b']);
    });

    it('expect a NOT_IN to keep the values past the cap, an IN after a search the values it lists', async () => {
        const many = Array.from({ length: DROPDOWN_FILTER_MAX_ROWS + 5 }, (_, i) => ({
            firstname: `v${String(i).padStart(3, '0')}`,
            lastname: 'x',
            age: i
        }));
        const { element, datasource } = await mountGrid(simpleConfig(), many);
        openFilterMenu(element, 'firstname');
        valueRow('v000').click();
        menuItem('Apply').click();

        expect(datasource.getFilter()).toEqual(and(where('firstname', 'NOT_IN', ['v000'])));
        expect(datasource.getDataRows()).toHaveLength(DROPDOWN_FILTER_MAX_ROWS + 4);

        // the search finds every value, it lists the first 100 - v000 unchecked: Apply is an IN of the
        // checked ones of those
        openFilterMenu(element, 'firstname');
        typeSearch('v');
        menuItem('Apply').click();

        expect(datasource.getDataRows()).toHaveLength(DROPDOWN_FILTER_MAX_ROWS - 1);
        expect([names(datasource)[0], names(datasource).at(-1)]).toEqual([
            'v001',
            `v${String(DROPDOWN_FILTER_MAX_ROWS - 1).padStart(3, '0')}`
        ]);
    });

    it('expect nothing checked to leave the column without a condition of the list, as before', async () => {
        const { element, datasource } = await mountGrid(
            simpleConfig(),
            ['a', 'b'].map((firstname, i) => ({ firstname, lastname: 'x', age: i }))
        );
        datasource.filter(and(where('firstname', 'IN', ['a']), where('age', 'LESS_THAN', 5)));
        openFilterMenu(element, 'firstname');
        // mixed: a click checks all, the next none
        selectAll();
        selectAll();
        menuItem('Apply').click();

        expect(datasource.getFilter()).toEqual(and(where('age', 'LESS_THAN', 5)));
    });

    it('expect it to work on a grouped grid: the values of the data rows, the group rows kept', async () => {
        const { element, datasource } = await mountGrid(
            simpleConfig(),
            ['a', 'b', 'a', 'c'].map((firstname, i) => ({ firstname, lastname: 'x', age: i }))
        );
        datasource.group([{ attribute: 'lastname', title: 'Last' }]);
        openFilterMenu(element, 'firstname');
        expect(shown()).toEqual(['a 2', 'b 1', 'c 1']);

        valueRow('b').click();
        menuItem('Apply').click();

        expect(names(datasource)).toEqual(['a', 'a', 'c']);
        expect(datasource.getRows().some(isGroupRow)).toBe(true);
    });
});
