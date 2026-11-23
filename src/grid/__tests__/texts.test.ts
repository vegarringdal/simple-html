// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
// the date picker element registers itself on import, the package entry does this for users
import '../../date/dateElement';
import { DateFormatterYYYYMMDDTHHMMSS } from '../../datasource/DateFormatterYYYYMMDDTHHMMSS';
import { Datasource } from '../../datasource/dataSource';
import type { Entity } from '../../datasource/entity';
import { and, type FilterCondition, type FilterOperator, or, where } from '../../datasource/filterExpression';
import { registerFormatter } from '../../datasource/formatterRegistry';
import { DateInterface } from '../../date/dateInterface';
import type { IDateConfig } from '../../date/interfaces';
import { setTexts, TEXTS, type Texts } from '../../texts';
import { registerCellRenderer } from '../cellRendererRegistry';
import { DATE_PRESETS } from '../datePresets';
import { FUNCTIONS } from '../formula';
import type { GridConfig } from '../gridConfig';
import { MAX_OPTIONS } from '../gridFunctions/lookupEditor';
import { GridInterface } from '../gridInterface';
import { registerLookup } from '../lookup';
import { type MountedGrid, mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';
import {
    headerFilterInput,
    menuEntry,
    menuTreeEntries,
    openColumnMenu,
    openFilterMenu,
    openLabelMenu,
    openRowMenu,
    sleep
} from './interactionTestHelpers';

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
    'BETWEEN',
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
 * format.locale is no text shown: the language of the names of a date's display format (Format ›), a
 * tag for Intl. Russian, so the names it gives - in the hints of Format › - have no Latin letters
 */
const LOCALE_ID = 'format.locale';

/**
 * the texts that show a template as it is written - the placeholders and hints of the column settings'
 * templates: their {names} are no values, nothing fills them in
 */
const TEMPLATE_EXAMPLES = new Set([
    'columnSettings.text.placeholder',
    'columnSettings.text.hint',
    'columnSettings.url.placeholder',
    'columnSettings.url.hint',
    'columnSettings.calculated.formula.placeholder',
    'columnSettings.rules.formula.placeholder'
]);

/**
 * the words of the formula language - how its functions are written (`ROUND(x, n)`), their names - and
 * the fields the walk writes in formulas and the names of its calculated columns: not texts, they are
 * the language's and the data's. A problem
 * of a formula shows them as they are (calculated columns, formula colour rules)
 */
const FORMULA_WORDS = [
    ...Array.from(FUNCTIONS.values(), (spec) => spec.usage),
    ...FUNCTIONS.keys(),
    'AND',
    'OR',
    'NOT',
    'TRUE',
    'FALSE',
    '{age}',
    '{born}',
    '{name}',
    '{notes}',
    '{calc_1}',
    // the placeholder of the label of a calculated column the walk adds: its field name made readable
    'Calc 1',
    'Calc 2'
];

/** a text shown without the words of the formula language, see FORMULA_WORDS */
const withoutFormulaWords = (text: string) => FORMULA_WORDS.reduce((rest, word) => rest.replaceAll(word, ''), text);

/**
 * every text as «id», with the {names} of its default after it: the values are still shown
 */
function fakeTexts(only: (id: string) => boolean): Texts {
    const texts: Texts = {};
    for (const [id, text] of Object.entries(TEXTS)) {
        if (only(id)) {
            const names = TEMPLATE_EXAMPLES.has(id) ? [] : (text.match(/\{\w+\}/g) ?? []);
            texts[id] = id === LOCALE_ID ? 'ru-RU' : `«${id}»${names.map((name) => ` ${name}`).join('')}`;
        }
    }
    return texts;
}

/** the ids no part of the grid showed: every id but format.locale, which is not shown */
const notShown = (seen: Set<string>) => Object.keys(TEXTS).filter((id) => !seen.has(id) && id !== LOCALE_ID);

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

// the datetime column: the hint of Default in its Format › is its formatter's text - data, like a cell's.
// Without the T of the built-in one, a letter that is no text. Its placeholder - the range block's input
// shows it - is data too
registerFormatter('texts-datetime', {
    ...DateFormatterYYYYMMDDTHHMMSS,
    format: (value) => DateFormatterYYYYMMDDTHHMMSS.format(value).replace('T', ' '),
    placeholder: '«yyyy»'
});

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
            { fields: ['updated'], width: 100 },
            { fields: ['active'], width: 100 },
            { fields: ['notes'], width: 100 },
            { fields: ['code'], width: 100 }
        ]
    },
    columns: {
        name: { label: '«Name»' },
        // always matches case: the hint of Match case, the tooltip of the editor's toggle
        country: { label: '«Country»', renderer: 'texts-test', filterCaseSensitive: true },
        age: { label: '«Age»' },
        // the placeholder of a date filter is the formatter's (YYYY-MM-DD), not a text
        born: { label: '«Born»', placeholderFilter: '«born»' },
        // a datetime: its Format › has the formats with the time. Every quick date in its filter menu
        updated: { label: '«Updated»', placeholderFilter: '«updated»', datePresets: [...DATE_PRESETS] },
        active: { label: '«Active»' },
        notes: { label: '«Notes»' },
        code: { label: '«Code»', editor: { type: 'select', lookup: 'texts-codes' } },
        // a column that is not in the layout: the detail form can show it
        extra: { label: '«Extra»' }
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
        updated: { type: 'datetime' as const, formatter: 'texts-datetime' },
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
        // a key of the keyboard shortcuts help that is a letter or a function key (Ctrl+C, F2) is shown as
        // it is: the key, no text. The keys with a name have a text (shortcuts.key.*)
        const keyCap = !!node.parentElement?.closest('kbd') && /^(F\d{1,2}|[A-Z])$/.test(text ?? '');
        if (text && !keyCap) {
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
            expect(withoutFormulaWords(text.replace(/«[^»]*»/g, '')), `not a text: "${text}"`).not.toMatch(/[A-Za-z]/);
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

/** a condition on name for each operator, matching case: the marker on the chips and in the text */
const conditions = (operators: FilterOperator[]): FilterCondition[] =>
    operators.map((operator) => {
        const options = { caseSensitive: true };
        if (operator === 'IN' || operator === 'NOT_IN') {
            return where('name', operator, ['«ann»'], options);
        }
        return where('name', operator, operator === 'BETWEEN' ? ['«ann»', '«bob»'] : '«ann»', options);
    });

/**
 * The column settings dialog: the list of every kind of column, the settings of a text column - its
 * template, a link and each problem of an address - of a number column (its format picker, blank / 0, a
 * label and a placeholder, its checkboxes and each problem of their values), of a checkbox and a lookup
 * column, the colour rules (a rule's parts, its problems, a value a date column does not read, a checkbox
 * column's value), and the preview of the current row, the first row and none
 */
function showColumnSettings({ datasource, gridInterface }: MountedGrid, check: (more?: string[]) => void) {
    const dialog = () => document.querySelector('dialog.column-settings') as HTMLDialogElement;
    const input = (part: string) => dialog().querySelector(`input[id$="-settings-${part}"]`) as HTMLInputElement;
    const type = (part: string, value: string) => {
        input(part).value = value;
        input(part).dispatchEvent(new Event('input', { bubbles: true }));
    };
    const checkbox = (index: number) => dialog().querySelectorAll<HTMLInputElement>('.column-settings-check input')[index];
    const toggle = (index: number) => {
        checkbox(index).checked = !checkbox(index).checked;
        checkbox(index).dispatchEvent(new Event('change', { bubbles: true }));
    };
    /** toggles the checkbox whose text has the id: the texts are their ids here */
    const toggleText = (id: string) => {
        const labels = Array.from(dialog().querySelectorAll<HTMLElement>('.column-settings-check'));
        toggle(labels.findIndex((label) => label.textContent?.includes(id)));
    };
    const option = (label: string) =>
        Array.from(dialog().querySelectorAll<HTMLElement>('[role="option"]')).find((element) =>
            element.textContent?.includes(label)
        ) as HTMLElement;

    // no current row: the first row is the preview's. A text column with nothing set
    datasource.currentEntity = null;
    gridInterface.openColumnSettings('name');
    check();
    // a template that names a field of the grid's own
    type('text', '{__«x»}');
    check();
    // a template: the column's badge
    type('text', '{name}');
    check();
    // a link: no address, then one that does not start with its scheme, then one of another scheme. The
    // first checkbox is Show as checkbox
    toggle(1);
    check();
    type('url', '«zz»');
    check();
    type('url', 'ftp://«x»');
    check();
    // the address from a field that is not in the row: empty in it, and no such field
    type('url', '{«zz»}');
    check();
    // the address from a field that holds no address: the first row shown has the age 20
    type('url', '{age}');
    check();
    // Multiline: its badge
    toggleText('columnSettings.multiline');
    check();
    // a number column: its format picker and the menu of the formats - one picked, the badge
    option('«Age»').click();
    check();
    (dialog().querySelector('.column-settings-format') as HTMLElement).click();
    check();
    (document.querySelector('[data-menu-id="header.format.number.norwegian"]') as HTMLElement).click();
    check();
    // Show blank as 0 (Show as checkbox, Filter as shown, Show blank as 0, Show 0 as blank, Use the column
    // label, Filter as you type), a label and a placeholder of the user's: their badges
    toggleText('columnSettings.blankToZero');
    type('label', '«age2»');
    type('placeholder', '«x»');
    check();
    toggleText('columnSettings.placeholderLabel');
    check();
    // Read only: its badge
    toggleText('columnSettings.readonly');
    check();
    // shown as checkboxes: the two values, their hint, each problem of them
    toggle(0);
    check();
    type('checked', '');
    check();
    type('checked', '«x»');
    check();
    type('checked', '0');
    check();
    // a date column shown as the day of the week: Filter as shown greyed out, its hint says why
    option('«Born»').click();
    (dialog().querySelector('.column-settings-format') as HTMLElement).click();
    (document.querySelector('[data-menu-id="header.format.date.weekday"]') as HTMLElement).click();
    check();
    // a checkbox and a lookup column: no settings
    option('«Active»').click();
    check();
    option('«Code»').click();
    check();
    // colour rules (a column without, above): one added - its operator, value, swatches, Bold and
    // buttons, the problem of no value - then a value (the badge), then no colour and not bold
    const byId = (part: string) => dialog().querySelector(`[id$="-settings-${part}"]`) as HTMLElement;
    byId('rules-add').click();
    check();
    type('rule-0-value', '«o1»');
    check();
    for (const kind of ['color', 'background']) {
        const none = dialog().querySelector(`input[name$="-rule-0-${kind}"].column-settings-swatch-none`) as HTMLInputElement;
        none.checked = true;
        none.dispatchEvent(new Event('change', { bubbles: true }));
    }
    check();
    // a date column: a value it does not read. A checkbox column: the value is a checkbox
    option('«Born»').click();
    byId('rules-add').click();
    type('rule-0-value', '«x»');
    check();
    option('«Active»').click();
    byId('rules-add').click();
    check();

    // what the dialog shows after each step below, checked at the end: a walk of the whole page after
    // each would take longer than the test may
    const dialogTexts: string[] = [];
    const collect = () => dialogTexts.push(...shownTexts(dialog()));
    // the kinds of a rule, on a text column: Conditions - two of them, All of them, its menu with Any of
    // them, none left; Formula - empty, not true / false, true and false in the row of the preview (the
    // first row shown: «age» 20); a custom text colour hard to read on the rows, then on its background
    const pick = (part: string) => {
        const radio = dialog().querySelector(`input[id$="-settings-${part}"]`) as HTMLInputElement;
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
    };
    option('«Name»').click();
    byId('rules-add').click();
    pick('rule-0-kind-conditions');
    byId('rule-0-condition-add').click();
    collect();
    byId('rule-0-combine').click();
    collect();
    (document.querySelector('[data-menu-id="columnSettings.rules.combine.OR"]') as HTMLElement).click();
    byId('rule-0-condition-1-remove').click();
    byId('rule-0-condition-0-remove').click();
    collect();
    pick('rule-0-kind-formula');
    collect();
    for (const formula of ['{age}', '{age} > 5', '{age} > 50']) {
        type('rule-0-expression', formula);
        collect();
    }
    for (const [kind, colour] of [
        ['color', '#999999'],
        ['background', '#888888']
    ]) {
        type(`rule-0-${kind}-custom`, colour);
        collect();
    }

    // a calculated column: added (its settings, the problem of no formula), each problem of a formula -
    // of the syntax, the fields, the types, the limits - and of the row of the preview, its type and its
    // value (a blank too), a second one that reads the first while it has a problem, the problems of its
    // field name. Not applied: Cancel
    const button = (id: string) =>
        Array.from(dialog().querySelectorAll('button')).find((each) => each.textContent?.includes(id)) as HTMLElement;
    button('columnSettings.calculated.add').click();
    collect();
    for (const formula of [
        `1${'+1'.repeat(500)}`,
        `${'('.repeat(33)}1${')'.repeat(33)}`,
        Array.from({ length: 251 }, () => '1').join('+'),
        '1 $ 2',
        '1)',
        '1 +',
        '"1',
        '{1',
        '_(1)',
        'ROUND()',
        '_ + 1',
        '{__«x»}',
        '{«zz»}',
        '{calc_1}',
        '"«x»" * 2',
        'YEAR(1)',
        'NOT {born}',
        'TRUE * 2',
        '1 = "«x»"',
        'TRUE < FALSE',
        '1 < 2 < 3',
        'ROUND(1, 1.5)',
        '{age} / 0',
        `{age} * ${'9'.repeat(400)}`,
        '{name} & ""',
        '{age} + 1'
    ]) {
        type('calculated-formula', formula);
        collect();
    }
    // the row of the preview with a value that is not of its field's type, and with a text too long
    const shown = datasource.getRows()[0] as Entity;
    shown.age = '«x»';
    type('calculated-formula', '{age} + 2');
    collect();
    datasource.undo();
    shown.notes = `«${'1'.repeat(10_001)}»`;
    type('calculated-formula', '{notes} & 1');
    collect();
    datasource.undo();
    // a second one that reads the first, while the first has a problem
    type('calculated-formula', '1 +');
    button('columnSettings.calculated.add').click();
    type('calculated-formula', '{calc_1}');
    collect();
    // its field name: no name, a field already
    type('calculated-name', '1');
    collect();
    type('calculated-name', 'age');
    collect();
    check(dialogTexts);
    (
        Array.from(dialog().querySelectorAll('button')).find((button) =>
            button.textContent?.includes('columnSettings.cancel')
        ) as HTMLElement
    ).click();

    // the current row, then no rows at all
    datasource.setRowAsCurrentEntity(0);
    gridInterface.openColumnSettings('name');
    check();
    gridInterface.openColumnSettings('name');
    datasource.currentEntity = null;
    datasource.filter(where('age', 'GREATER_THAN', 100_000));
    gridInterface.openColumnSettings('name');
    check();
    datasource.filter(null);
    (dialog().querySelector('.filter-editor-close') as HTMLElement).click();
}

/**
 * The detail form - with a row, without one, without fields, collapsed - and the Detail form tab of the
 * grid config dialog: a field of several lines and one that is not in the layout in its list, on a Mac too
 */
function showDetailForm({ datasource, gridInterface }: MountedGrid, check: () => void) {
    const before = gridInterface.getState().detailForm;
    gridInterface.setState({ detailForm: { show: true, fields: ['name', 'notes', 'extra'], expanded: false } });
    datasource.setRowAsCurrentEntity(0);
    check();
    gridInterface.setState({ detailForm: { show: true, fields: ['name', 'notes', 'extra'] } });
    check();

    gridInterface.openDetailFormSettings();
    check();
    const platform = vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    try {
        gridInterface.openDetailFormSettings();
        check();
    } finally {
        platform.mockRestore();
    }
    (document.querySelector('dialog.column-settings .filter-editor-close') as HTMLElement).click();

    datasource.currentEntity = null;
    gridInterface.refresh();
    check();
    gridInterface.setState({ detailForm: { show: true, fields: [] } });
    datasource.setRowAsCurrentEntity(0);
    check();
    gridInterface.setState({ detailForm: before });
}

/**
 * The named views: the views button at the footer's left end - Standard, changed - its menu with a
 * readonly view that is the default (its hints), the name asked for by Save as new view… - none yet, one
 * another view has - and by Rename…. The names of the views are data, in «»
 */
function showViews({ element, gridInterface }: MountedGrid, check: () => void) {
    const viewsButton = () => element.querySelector('.footer-views-button') as HTMLButtonElement;
    const nameInput = () => document.querySelector('.simple-html-grid-view-name-input') as HTMLInputElement;
    const typeName = (name: string) => {
        nameInput().value = name;
        nameInput().dispatchEvent(new Event('input', { bubbles: true }));
    };
    const before = gridInterface.getState();
    // the button of Standard and the menu: its entries, the hints of the shared view that is the default
    gridInterface.updateConfig({ viewsButton: true });
    gridInterface.setViews([{ id: 'shared', name: '«shared»', state: {}, readonly: true, default: true }]);
    viewsButton().click();
    check();
    gridInterface.closeMenu();
    // changed: the button's name says so. The name asked for, none yet, then one the shared view has
    gridInterface.setState({ sorting: [{ attribute: 'age', ascending: false }] });
    viewsButton().click();
    menuEntry('views.saveAs').click();
    check();
    typeName('«shared»');
    check();
    typeName('«mine»');
    nameInput().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    // Rename…: its button
    viewsButton().click();
    menuEntry('views.rename').click();
    check();
    gridInterface.closeMenu();
    gridInterface.setViews([]);
    gridInterface.updateConfig({ viewsButton: false });
    gridInterface.setState(before);
}

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

    // the keyboard shortcuts help: its groups and keys, then a search that finds nothing. And the header
    // menu's entry, its hint
    gridInterface.openShortcutHelp();
    check();
    const shortcutSearch = document.querySelector('.shortcut-help-search') as HTMLInputElement;
    shortcutSearch.value = 'zzz';
    shortcutSearch.dispatchEvent(new Event('input', { bubbles: true }));
    check();
    (document.querySelector('dialog.shortcut-help .filter-editor-close') as HTMLElement).click();

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
    // previous, the hint of the editor of the notes, the tooltips of the filter editor's undo and redo,
    // the modifiers of the keyboard shortcuts help and the hint of its menu entry
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
        // the keyboard shortcuts help: the modifiers and its hint, and the hint of its menu entry
        gridInterface.openShortcutHelp();
        check();
        (document.querySelector('dialog.shortcut-help .filter-editor-close') as HTMLElement).click();
        openLabelMenu(element, 'age');
        check();
        gridInterface.closeMenu();
    } finally {
        platform.mockRestore();
    }

    // the header menus: pinned left (unpin) and in the center (pin), then the column chooser
    openLabelMenu(element, 'name');
    checkMenu();
    openLabelMenu(element, 'country');
    checkMenu();
    // a number column: its Aggregate submenu has sum, average, min and max too, its Format › the number
    // formats. A date and a datetime column: the date formats, with the time - their hints are examples
    // in the language of format.locale
    openLabelMenu(element, 'age');
    checkMenu();
    openLabelMenu(element, 'born');
    checkMenu();
    openLabelMenu(element, 'updated');
    checkMenu();
    (document.querySelector('[data-menu-id="header.column.chooser"]') as HTMLElement).click();
    check();
    // the ✎ of a field: its label an input, then Esc
    (document.querySelector('.simple-html-grid-chooser-rename') as HTMLElement).click();
    check();
    document
        .querySelector('.simple-html-grid-chooser-label-input')
        ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

    // the column menu, on a column number: with a column selected, so every entry is usable
    gridInterface.selectColumns([1]);
    openColumnMenu(element, 1);
    checkMenu();
    gridInterface.closeMenu();
    gridInterface.selectColumns([]);

    // the filter menus: a number (the range operators, its range block), text with its value list, a value list that
    // is cut off, and one with one value (every row has the same notes)
    for (const field of ['age', 'name', 'country', 'notes']) {
        openFilterMenu(element, field);
        checkMenu();
    }
    // a search typed in the value list: its option to filter on the text. A digit: the check takes every
    // letter left for a text of the grid's own
    openFilterMenu(element, 'name');
    const valueSearch = document.querySelector('.simple-html-grid-value-search') as HTMLInputElement;
    valueSearch.value = '1';
    valueSearch.dispatchEvent(new Event('input'));
    checkMenu();

    // a date column shown as the days until the date, filtered as shown: the placeholder of the range
    // block of its menu (its header filter has the column's placeholderFilter)
    gridInterface.setState({ formats: { born: { date: 'daysUntil' } } });
    openFilterMenu(element, 'born');
    check();
    gridInterface.closeMenu();
    gridInterface.setState({ formats: {} });

    // a header filter with BETWEEN: its placeholder, and From and To of the range block of its menu
    gridInterface.setState({ headerFilters: { age: { value: null, operator: 'BETWEEN' } } });
    check();
    openFilterMenu(element, 'age');
    check();
    gridInterface.closeMenu();
    // the operator indicator of each operator: its symbol, its name and its tooltip - the text
    // operators on name, the comparisons on age
    const textOperators: FilterOperator[] = ['EQUAL', 'NOT_EQUAL_TO', 'CONTAINS', 'DOES_NOT_CONTAIN', 'BEGIN_WITH', 'END_WITH'];
    const numberOperators: FilterOperator[] = ['LESS_THAN', 'LESS_THAN_OR_EQUAL_TO', 'GREATER_THAN', 'GREATER_THAN_OR_EQUAL_TO'];
    textOperators.forEach((operator, i) => {
        gridInterface.setState({
            headerFilters: {
                name: { value: null, operator },
                age: { value: null, operator: numberOperators[i] ?? 'EQUAL' }
            }
        });
        check();
    });
    gridInterface.setState({ headerFilters: {} });

    // the quick dates of a datetime column, Overdue too: their names, the group's name and the days of each
    // (the tooltips, the datetime formatter's digits). One clicked: its name in the cell and on the chip
    openFilterMenu(element, 'updated');
    check();
    (document.querySelector('[data-menu-id="filter.dates"] [data-preset="thisMonth"]') as HTMLElement).click();
    check();
    gridInterface.setState({ headerFilters: {}, filter: and(where('age', 'GREATER_THAN', 10)) });

    // the filter editor: AND with an OR group, a condition compared with a field not picked yet. A text
    // condition has the Match case toggle, of a column that always matches case its other tooltip, a
    // BETWEEN its inputs from and to
    const compareWithField: FilterCondition = { field: 'age', operator: 'EQUAL', valueField: '' };
    datasource.setFilter(
        and(
            where('name', 'EQUAL', '«ann»'),
            where('country', 'EQUAL', '«x»'),
            compareWithField,
            where('age', 'BETWEEN', [1, 2]),
            or(where('age', 'LESS_THAN', 5))
        )
    );
    gridInterface.openFilterEditor();
    check();
    // the operators of a number
    const between = Array.from(document.querySelectorAll<HTMLElement>('.filter-editor-pick-operator')).find((picker) =>
        picker.getAttribute('aria-label')?.includes('filterEditor.operator.BETWEEN')
    ) as HTMLElement;
    between.click();
    check();
    gridInterface.closeMenu();
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

    // the column settings dialog, see showColumnSettings
    showColumnSettings({ element, datasource, gridInterface }, check);
    // the detail form and its tab of the dialog, see showDetailForm
    showDetailForm({ element, datasource, gridInterface }, check);
    // the views button and its menu, see showViews
    showViews({ element, datasource, gridInterface }, check);

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

    // the range picker of a date header filter with Between: From and To not picked, then From picked
    openFilterMenu(element, 'born');
    menuEntry('filter.operator.between').click();
    headerFilterInput(element, 'born').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await sleep(20);
    check();
    (document.querySelector('simple-html-date .simple-html-date-day:not(.simple-html-date-day-dimmed)') as HTMLElement).click();
    check();
    gridInterface.closeMenu();
    openFilterMenu(element, 'born');
    menuEntry('filter.operator.greaterThanOrEqualTo').click();

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

// showEverything opens every part of the grid one by one (every menu, the editors, the date picker, the
// calculated columns and the kinds of a colour rule, the views menu ...): seconds, more on a loaded machine than the 5s
// vitest gives a test - 30s and more with two workers busy
describe('texts in the grid - every text replaced', { timeout: 90_000 }, () => {
    it('expect every text from setTexts(), none left in English, and every id shown', async () => {
        setTexts(fakeTexts(() => true));
        const { seen, check } = checker();

        await showEverything(await mountGrid(config(), rows(), fields), check);
        await showConflicts(undefined, check);

        expect(notShown(seen)).toEqual([]);
    });

    it("expect the grid's texts from its config, and the datasource's from setTexts()", async () => {
        // the datasource has no grid: GridConfig.texts does not reach the texts it makes
        setTexts(fakeTexts(isDatasourceText));
        const { seen, check } = checker();

        const gridTexts = fakeTexts((id) => !isDatasourceText(id));
        await showEverything(await mountGrid(config(gridTexts), rows(), fields), check);
        await showConflicts(gridTexts, check);

        expect(notShown(seen)).toEqual([]);
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
        // the fields of the config's columns: its quick dates are for a date column
        const datasource = new Datasource(fields);
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
