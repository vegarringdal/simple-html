// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
// the date picker element registers itself on import, the package entry does this for users
import '../../date/dateElement';
import { Datasource } from '../../datasource/dataSource';
import type { Entity } from '../../datasource/entity';
import { and, type FilterCondition, type FilterOperator, or, where } from '../../datasource/filterExpression';
import { DateInterface } from '../../date/dateInterface';
import type { IDateConfig } from '../../date/interfaces';
import { setTexts, TEXTS, type Texts } from '../../texts';
import { registerCellRenderer } from '../cellRendererRegistry';
import type { GridConfig } from '../gridConfig';
import { MAX_OPTIONS } from '../gridFunctions/lookupEditor';
import { GridInterface } from '../gridInterface';
import { registerLookup } from '../lookup';
import { type MountedGrid, mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { headerFilterInput, menuTreeEntries, openFilterMenu, openLabelMenu, openRowMenu, sleep } from './interactionTestHelpers';

/**
 * Every text the grid shows comes from the texts. With every text replaced by its id in «» - the
 * labels and values of the test are in «» too - the menus, the filter editor, the column chooser, the
 * footer, the date picker and the validation messages are opened one by one: nothing with a letter
 * may be shown outside «», and every id has to be shown somewhere.
 */

const OPERATORS: FilterOperator[] = [
    'EQUAL',
    'LESS_THAN_OR_EQUAL_TO',
    'GREATER_THAN_OR_EQUAL_TO',
    'LESS_THAN',
    'GREATER_THAN',
    'CONTAINS',
    'NOT_EQUAL_TO',
    'DOES_NOT_CONTAIN',
    'BEGIN_WITH',
    'END_WITH',
    'IN',
    'NOT_IN',
    'IS_BLANK',
    'IS_NOT_BLANK'
];

// the texts the datasource makes: setTexts() only
const isDatasourceText = (id: string) => /^(validation|filterString|grouping)\./.test(id);

/**
 * every text as «id», with the {names} of its default after it: the values are still shown
 */
function fakeTexts(only: (id: string) => boolean): Texts {
    const texts: Texts = {};
    for (const [id, text] of Object.entries(TEXTS)) {
        if (only(id)) {
            const names = text.match(/\{\w+\}/g) ?? [];
            texts[id] = `«${id}»${names.map((name) => ` ${name}`).join('')}`;
        }
    }
    return texts;
}

// 102 countries, 101 of them let through by the filter on age: the value list is cut off at 100
const COUNTRIES = Array.from({ length: 102 }, (_, i) => `«c${i}»`);

// notes of seven lines: the marker of a multiline cell, its editor, and its tooltip - the first five
// lines and how many more there are
const NOTES = Array.from({ length: 7 }, (_, i) => `«line ${i + 1}»`).join('\n');

// a lookup column (ColumnConfig.editor): the cells show the labels «o0» ..., the select has more
// options than it shows - the line that says so
const CODES = new Datasource();
CODES.setData(Array.from({ length: MAX_OPTIONS + 1 }, (_, i) => ({ code: `k${i}`, name: `«o${i}»` })));
registerLookup('texts-codes', { datasource: CODES, valueField: 'code', labelField: 'name' });

const rows = () => [
    { name: '«ann»', country: COUNTRIES[0], age: 10, born: new Date(2026, 0, 5), active: true, notes: NOTES, code: 'k0' },
    // a blank name: "Blank" in the value list, and a validation error
    { name: null, country: null, age: 20, born: null, active: false, notes: NOTES, code: null },
    ...COUNTRIES.slice(1).map((country, i) => ({
        name: '«bob»',
        country,
        age: 30 + i,
        born: new Date(2026, 1, 1),
        active: true,
        notes: NOTES,
        code: `k${i + 1}`
    }))
];

// country is a custom cell: the editor of one line opens over it
registerCellRenderer('texts-test', (host) => ({
    update: ({ text }) => {
        host.textContent = text;
    }
}));

const config = (texts?: Texts): GridConfig => ({
    readonly: false,
    layout: {
        // pinned left: its header menu has "Unpin", the others "Pin left"
        left: [{ fields: ['name'], width: 100 }],
        center: [
            { fields: ['country'], width: 100 },
            { fields: ['age'], width: 100 },
            { fields: ['born'], width: 100 },
            { fields: ['active'], width: 100 },
            { fields: ['notes'], width: 100 },
            { fields: ['code'], width: 100 }
        ]
    },
    columns: {
        name: { label: '«Name»' },
        country: { label: '«Country»', renderer: 'texts-test' },
        age: { label: '«Age»' },
        // the placeholder of a date filter is the formatter's (YYYY-MM-DD), not a text
        born: { label: '«Born»', placeholderFilter: '«born»' },
        active: { label: '«Active»' },
        notes: { label: '«Notes»' },
        code: { label: '«Code»', editor: { type: 'select', lookup: 'texts-codes' } }
    },
    // a filter on age hides a row: the value list of the other columns has "Filter Available"
    initialState: { filter: and(where('age', 'GREATER_THAN', 10)) },
    texts
});

// rules that the first rows fail, each built-in once: «ann» is 5 long, the ages are 10, 20, 30 ...
const fields = {
    fields: {
        name: {
            validate: ['required', { id: 'minLength', value: 6 }, { id: 'maxLength', value: 3 }, { id: 'pattern', value: '^x$' }]
        },
        age: {
            type: 'number' as const,
            validate: [
                { id: 'min', value: 15 },
                { id: 'max', value: 25 }
            ]
        },
        born: 'date' as const,
        active: 'boolean' as const,
        notes: { multiline: true }
    }
};

/**
 * the texts shown in the document: the text nodes, and the attributes a user sees or hears
 */
function shownTexts(node: Node = document.body, texts: string[] = []): string[] {
    if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim();
        if (text) {
            texts.push(text);
        }
    }
    if (node instanceof Element) {
        for (const name of ['placeholder', 'title', 'data-tooltip', 'aria-label']) {
            const value = node.getAttribute(name);
            // the aria-label of a cell is its field name: the data of the test
            if (value && !(name === 'aria-label' && node.hasAttribute('data-attribute'))) {
                texts.push(value);
            }
        }
    }
    for (const child of node.childNodes) {
        shownTexts(child, texts);
    }
    return texts;
}

/**
 * Checks what is shown now, and adds the ids it shows to `seen`. getFilterString() upper cases, so an
 * id is matched in any case
 * @param more texts shown elsewhere: getFilterString(), the names of the group rows
 */
function checker() {
    const seen = new Set<string>();
    const ids = new Map(Object.keys(TEXTS).map((id) => [id.toUpperCase(), id]));
    const check = (more: string[] = []) => {
        for (const text of [...shownTexts(), ...more]) {
            expect(text.replace(/«[^»]*»/g, ''), `not a text: "${text}"`).not.toMatch(/[A-Za-z]/);
            for (const [, id] of text.matchAll(/«([^»]+)»/g)) {
                const known = ids.get(id.toUpperCase());
                if (known) {
                    seen.add(known);
                }
            }
        }
    };
    return { seen, check };
}

/** clicks the icon of the filter editor with this tooltip */
function clickIcon(tooltip: string) {
    const holder = document.querySelector(`.filter-editor-content [data-tooltip="${tooltip}"]`) as HTMLElement;
    (holder.querySelector('svg') ?? holder).dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 100 }));
}

/** a condition on name for each operator */
const conditions = (operators: FilterOperator[]): FilterCondition[] =>
    operators.map((operator) =>
        operator === 'IN' || operator === 'NOT_IN' ? where('name', operator, ['«ann»']) : where('name', operator, '«ann»')
    );

/**
 * Opens every part of the grid that shows a text, and checks each
 */
async function showEverything({ element, datasource, gridInterface }: MountedGrid, check: (more?: string[]) => void) {
    // the grid, its footer with the filter. The notes have a marker for a screen reader
    check();

    // the find bar (Ctrl+F): its name, the input, the buttons - the count with matches, and without.
    // "Filter rows" on: the chip of its text in the footer
    gridInterface.find('«bob»');
    check();
    gridInterface.find('«nobody»');
    check();
    gridInterface.find('«bob»', { filterRows: true });
    check();
    gridInterface.closeFind();

    // the editor of the notes, and read-only in a readonly grid
    const notes = element.querySelector('input[data-attribute="notes"]') as HTMLInputElement;
    const pressKey = (target: Element, key: string) =>
        target.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, bubbles: true, cancelable: true }));
    pressKey(notes, 'Enter');
    check();
    pressKey(document.querySelector('.simple-html-grid-text-editor textarea') as HTMLElement, 'Escape');
    gridInterface.updateConfig({ readonly: true });
    pressKey(element.querySelector('input[data-attribute="notes"]') as HTMLElement, 'Enter');
    check();
    pressKey(document.querySelector('.simple-html-grid-text-editor textarea') as HTMLElement, 'Escape');
    gridInterface.updateConfig({ readonly: false });

    // a lookup column: the name of its button (in the grid, checked above), its select - the search,
    // a list longer than it shows - and a search that finds nothing
    const code = element.querySelector('input[data-attribute="code"]') as HTMLInputElement;
    code.focus();
    pressKey(code, 'F4');
    check();
    const lookupSearch = document.querySelector('.simple-html-grid-lookup-search') as HTMLInputElement;
    lookupSearch.value = 'zz';
    lookupSearch.dispatchEvent(new Event('input', { bubbles: true }));
    check();
    pressKey(lookupSearch, 'Escape');

    // the editor of one line over a custom cell
    pressKey(element.querySelector('.simple-html-grid-cell-custom[data-attribute="country"]') as HTMLElement, 'Enter');
    check();
    pressKey(document.querySelector('.simple-html-grid-text-editor input') as HTMLElement, 'Escape');

    // the row menu: an editable number cell, a selected row marked for deletion (undo). Not the row
    // with the blank name, a row marked for deletion is not validated
    const marked = datasource.getRows().findIndex((row) => row.country === COUNTRIES[5]);
    datasource.select(marked);
    datasource.markForDeletion(datasource.getSelectedRows());
    // a range of cells: the range entries (marking rows clears the ranges, so after it)
    gridInterface.setRanges([{ fromRow: 0, fromField: 'name', toRow: 1, toField: 'age' }]);
    // the menu, then each submenu as it opens
    const checkMenu = () => {
        check();
        menuTreeEntries(check);
    };
    openRowMenu(element, 'age', 0);
    checkMenu();
    gridInterface.clearRanges();

    // on a Mac: the texts that name a key, `<id>.mac` - the hints of undo and redo, the find bar's
    // previous, the hint of the editor of the notes, the tooltips of the filter editor's undo and redo
    const platform = vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    try {
        openRowMenu(element, 'age', 0);
        checkMenu();
        gridInterface.closeMenu();
        gridInterface.find('«bob»');
        check();
        gridInterface.closeFind();
        pressKey(element.querySelector('input[data-attribute="notes"]') as HTMLElement, 'Enter');
        check();
        pressKey(document.querySelector('.simple-html-grid-text-editor textarea') as HTMLElement, 'Escape');
        gridInterface.openFilterEditor();
        check();
        clickIcon('«filterEditor.closeButton.tooltip»');
    } finally {
        platform.mockRestore();
    }

    // the header menus: pinned left (unpin) and in the center (pin), then the column chooser
    openLabelMenu(element, 'name');
    checkMenu();
    openLabelMenu(element, 'country');
    checkMenu();
    // a number column: its Aggregate submenu has sum, average, min and max too
    openLabelMenu(element, 'age');
    checkMenu();
    (document.querySelector('[data-menu-id="header.column.chooser"]') as HTMLElement).click();
    check();

    // the filter menus: a number (the range operators), text with its value list, a value list that
    // is cut off, and one with one value (every row has the same notes)
    for (const field of ['age', 'name', 'country', 'notes']) {
        openFilterMenu(element, field);
        checkMenu();
    }

    // the filter editor: AND with an OR group, a condition compared with a field not picked yet
    const compareWithField: FilterCondition = { field: 'age', operator: 'EQUAL', valueField: '' };
    datasource.setFilter(and(where('name', 'EQUAL', '«ann»'), compareWithField, or(where('age', 'LESS_THAN', 5))));
    gridInterface.openFilterEditor();
    check();
    // a new condition: no field and no operator picked
    clickIcon('«filterEditor.addCondition.tooltip»');
    check();
    // its menus: the operators, the fields
    clickIcon('«filterEditor.pickOperator.tooltip»');
    check();
    clickIcon('«filterEditor.pickAttribute.tooltip»');
    check();
    // nothing left in it: the hint
    clickIcon('«filterEditor.clearAll.tooltip»');
    check();
    clickIcon('«filterEditor.closeButton.tooltip»');

    // the footer: a chip for each operator, five at a time, an OR group in the first
    datasource.filter(and(...conditions(OPERATORS.slice(0, 3)), or(...conditions(OPERATORS.slice(3, 5)))));
    check();
    datasource.filter(and(...conditions(OPERATORS.slice(5, 10))));
    check();
    datasource.filter(and(...conditions(OPERATORS.slice(10))));
    check();
    // more than 5 conditions: one box instead of the chips
    datasource.filter(and(...conditions(OPERATORS.slice(0, 6))));
    check();
    // one condition that does not fit
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, get: () => 5000 });
    try {
        datasource.filter(where('age', 'GREATER_THAN', 10));
        check();
    } finally {
        Reflect.deleteProperty(HTMLElement.prototype, 'scrollWidth');
    }

    // the date picker of a date header filter, and every month
    headerFilterInput(element, 'born').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await sleep(20);
    check();
    for (let month = 1; month < 12; month++) {
        // « ‹ › »: the third is the next month
        const next = document.querySelectorAll('simple-html-date .simple-html-date-nav')[2];
        next.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        check();
    }
    gridInterface.closeMenu();

    // the validation messages: on the cell and the row number
    datasource.filter(null);
    datasource.validate();
    gridInterface.refresh();
    check();

    // grouped: the grouping panel and the group rows, the blank group first
    datasource.group([{ attribute: 'country', title: '«Country»' }]);
    check(
        datasource
            .getRows()
            .slice(0, 3)
            .map((row) => ('__groupName' in row ? String(row.__groupName) : ''))
    );

    // the aggregates: the label of each function in the group rows and the totals row, and "Total"
    const columns = config().columns ?? {};
    for (const fn of ['sum', 'avg', 'min', 'max'] as const) {
        gridInterface.updateConfig({
            columns: { ...columns, age: { ...columns.age, aggregate: fn }, name: { ...columns.name, aggregate: 'count' } },
            totalsRow: true
        });
        check();
    }
    gridInterface.updateConfig({ columns, totalsRow: false });
    datasource.removeGroup();

    // getFilterString(), every operator
    datasource.setFilter(and(...conditions(OPERATORS), or(where('age', 'EQUAL', 1), where('age', 'EQUAL', 2))));
    check([datasource.getFilterString((field) => `«${field}»`)]);

    // the row state and the edited cells: an edited row (the marker of a value and of a blank), a
    // new row, the row marked for deletion (above), the errors - and "changed rows only" in the footer
    datasource.filter(null);
    const [ann, blank] = datasource.getDataRows();
    ann.name = '«anna»';
    blank.name = '«x»';
    datasource.addNewEmpty({ name: '«new»' }, { scrollTo: false });
    datasource.filterChangedOnly(true);
    datasource.validate();
    gridInterface.refresh();
    check();
}

/**
 * A conflict with the server, on a grid of its own: an upsert merges by key, and the rows of the other
 * grid have none. A field the server changed while it was edited (its marker), and a row the server
 * removed that has changes here (its row number)
 */
async function showConflicts(texts: Texts | undefined, check: (more?: string[]) => void) {
    const keyed = rows().map((row, i) => ({ ...row, id: i + 1 }));
    const { datasource, gridInterface } = await mountGrid(config(texts), keyed, { ...fields, key: 'id' });
    // rows on screen: the config's filter hides the first (age 10)
    const row = (id: number) => datasource.getDataRows().find((entity) => entity.id === id) as Entity;
    row(3).age = 31;
    row(4).name = '«x»';
    // the server changed the age of row 3, and has no row 4 any more
    datasource.upsert(
        keyed.filter((entity) => entity.id !== 4).map((entity) => (entity.id === 3 ? { ...entity, age: 32 } : entity)),
        { removeMissing: true }
    );
    gridInterface.refresh();
    check();
}

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    document.body.innerHTML = '';
});

// setTexts() is one for the page: back to the defaults, so no other test sees these
afterEach(() => {
    setTexts({});
});

// showEverything opens every part of the grid one by one (every menu, the editors, the date picker
// ...): seconds, more on a loaded machine than the 5s vitest gives a test
describe('texts in the grid - every text replaced', { timeout: 30_000 }, () => {
    it('expect every text from setTexts(), none left in English, and every id shown', async () => {
        setTexts(fakeTexts(() => true));
        const { seen, check } = checker();

        await showEverything(await mountGrid(config(), rows(), fields), check);
        await showConflicts(undefined, check);

        expect(Object.keys(TEXTS).filter((id) => !seen.has(id))).toEqual([]);
    });

    it("expect the grid's texts from its config, and the datasource's from setTexts()", async () => {
        // the datasource has no grid: GridConfig.texts does not reach the texts it makes
        setTexts(fakeTexts(isDatasourceText));
        const { seen, check } = checker();

        const gridTexts = fakeTexts((id) => !isDatasourceText(id));
        await showEverything(await mountGrid(config(gridTexts), rows(), fields), check);
        await showConflicts(gridTexts, check);

        expect(Object.keys(TEXTS).filter((id) => !seen.has(id))).toEqual([]);
    });
});

describe('texts in the grid - where a text comes from', () => {
    // the labels of the menu and its submenus
    const menuLabels = () => menuTreeEntries().map((entry) => entry.textContent?.replace(/\s+/g, ' ').trim());

    it("expect the grid's texts, then the page's, then the defaults", async () => {
        setTexts({ 'row.copy': 'page copy', 'row.paste': 'page paste' });
        const { element } = await mountGrid(config({ 'row.copy': 'grid copy' }), rows(), fields);

        openRowMenu(element, 'age', 0);
        expect(menuLabels()).toEqual(expect.arrayContaining(['grid copy', 'page paste', 'Cell Value']));
    });

    it('expect updateConfig({ texts }) to replace the texts as a whole, and to rebuild', async () => {
        const { element, gridInterface } = await mountGrid(config({ 'row.copy': 'grid copy' }), rows(), fields);
        const footerClear = () => element.querySelector('.footer-filter-clear')?.textContent?.trim();

        gridInterface.updateConfig({ texts: { 'footer.clear': 'Tøm' } });
        expect(footerClear()).toEqual('Tøm');
        openRowMenu(element, 'age', 0);
        expect(menuLabels()).toContain('Copy');

        gridInterface.updateConfig({ texts: undefined });
        expect(footerClear()).toEqual('✕ Clear');
    });

    it('expect setTexts() to show in a grid after its next rebuild, in a menu the next time it opens', async () => {
        const { element, gridInterface } = await mountGrid(config(), rows(), fields);
        const footerClear = () => element.querySelector('.footer-filter-clear')?.textContent?.trim();

        setTexts({ 'footer.clear': 'Tøm', 'row.copy': 'Kopier:' });
        expect(footerClear()).toEqual('✕ Clear');
        gridInterface.rebuild();
        expect(footerClear()).toEqual('Tøm');

        openRowMenu(element, 'age', 0);
        expect(menuLabels()).toContain('Kopier:');
    });

    it("expect a grid's texts not to change the validation messages: the datasource makes them", async () => {
        const { element, datasource, gridInterface } = await mountGrid(config({ 'validation.required': 'grid' }), rows(), fields);
        datasource.validate();
        gridInterface.refresh();

        const tooltips = Array.from(element.querySelectorAll('.simple-html-cell-error'), (cell) =>
            cell.getAttribute('data-tooltip')
        );
        expect(tooltips).toContain('Required');
    });

    it("expect the date picker of the grid to show the grid's texts", async () => {
        const { element } = await mountGrid(config({ 'datePicker.use': 'Bruk', 'datePicker.day.monday': 'Ma' }), rows(), fields);

        headerFilterInput(element, 'born').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await sleep(20);

        const picker = document.querySelector('simple-html-date') as HTMLElement;
        const buttons = Array.from(picker.querySelectorAll('.simple-html-date-actions button'), (button) =>
            button.textContent?.trim()
        );
        expect(buttons).toEqual(['Clear', 'Now', 'Bruk']);
        // the week starts on monday
        expect(picker.querySelector('.simple-html-date-day-header')?.textContent?.trim()).toEqual('Ma');
    });
});

describe('texts in the grid - what GridConfig.texts takes', () => {
    it('expect a TypeError for a text that is not a string, from the constructor and updateConfig()', () => {
        const datasource = new Datasource();
        // a config from JSON can have anything
        expect(() => new GridInterface({ ...config(), texts: JSON.parse('{ "row.copy": null }') }, datasource)).toThrow(
            /'row\.copy'/
        );

        const gridInterface = new GridInterface(config(), datasource);
        expect(() => gridInterface.updateConfig({ texts: JSON.parse('[]') })).toThrow(TypeError);
    });
});

describe('texts in a date picker of your own', () => {
    const dateConfig = (texts?: Texts): IDateConfig => ({
        monthsToShow: 1,
        monthColumns: 1,
        startMonth: 0,
        startYear: 2026,
        weekStart: 1,
        showWeek: true,
        isoWeek: true,
        rowHeight: 22,
        monthWidth: 230,
        monthMargin: 10,
        hideDimmedDates: false,
        showYearInMonth: false,
        headerTitle: '',
        datepicker: true,
        datepickerDate: new Date(2026, 3, 15),
        texts
    });

    function mount(config: IDateConfig) {
        const element = document.createElement('simple-html-date') as HTMLElement & { connectInterface(i: DateInterface): void };
        element.connectInterface(new DateInterface(config));
        document.body.appendChild(element);
        return element;
    }

    it("expect the page's texts, and its own texts over them", () => {
        setTexts({ 'datePicker.month.april': 'April (side)', 'datePicker.now': 'Nå' });

        expect(mount(dateConfig()).querySelector('.simple-html-date-month-name')?.textContent?.trim()).toEqual('April (side)');

        const own = mount(dateConfig({ 'datePicker.month.april': 'April (egen)' }));
        expect(own.querySelector('.simple-html-date-month-name')?.textContent?.trim()).toEqual('April (egen)');
        expect(
            Array.from(own.querySelectorAll('.simple-html-date-actions button'), (button) => button.textContent?.trim())
        ).toEqual(['Clear', 'Nå', 'Use']);
    });
});
