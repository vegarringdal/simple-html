// @vitest-environment happy-dom

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Datasource } from '../../datasource/dataSource';
import type { DatasourceOptions } from '../../datasource/datasourceOptions';
import { setTexts } from '../../texts';
import { type CellRenderContext, registerCellRenderer } from '../cellRendererRegistry';
import type { ColumnFormat } from '../columnFormat';
import type { ColumnConfig, GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import { MENU_IDS, type MenuEntry } from '../gridMenus';
import { registerLookup } from '../lookup';
import { mountGrid, renderedColumn, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { headerFilterInput, menuEntry, menuTreeIds, openLabelMenu, typeInHeaderFilter } from './interactionTestHelpers';

/**
 * The display formats in the grid (ColumnConfig.format, GridState.formats, Format › in the header menu):
 * the cells and what follows them (aggregates, the footer's summary, Find, fitColumns), editing and the
 * header filter keeping to the field's formatter, the menu, the state and the config's checks, copy and
 * the CSV export. What each format shows is tested in columnFormat.test.ts, the Excel export's number
 * formats in gridExcel.test.ts.
 */

// local dates: a time zone with summer time. Node reads TZ again when it is set
const originalTimeZone = process.env.TZ;
beforeAll(() => {
    process.env.TZ = 'Europe/Oslo';
    stubCanvas();
    stubElementSizes();
});
afterAll(() => {
    if (originalTimeZone === undefined) {
        delete process.env.TZ;
    } else {
        process.env.TZ = originalTimeZone;
    }
});

beforeEach(() => {
    document.body.innerHTML = '';
    // today is Sunday 2026-11-22: the days until, the hints of the menu. Only Date: the grid's timers run
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 22, 10, 0, 0));
});

afterEach(() => {
    vi.useRealTimers();
    setTexts({});
});

// a lookup on a number field: its cells show a label, it has no format
const CODES = new Datasource();
CODES.setData([
    { code: 1, name: 'One' },
    { code: 2, name: 'Two' }
]);
registerLookup('format-test-codes', { datasource: CODES, valueField: 'code', labelField: 'name' });

const rows = () => [
    {
        id: 1,
        name: 'Ann',
        born: new Date(2026, 10, 22),
        updated: new Date(2026, 10, 22, 13, 45, 12),
        balance: 1234567.891,
        comma: 2.5,
        active: true,
        code: 1
    },
    {
        id: 2,
        name: 'Bob',
        born: new Date(2027, 0, 1),
        updated: new Date(2027, 0, 1, 8, 5, 0),
        balance: -2.5,
        comma: 0,
        active: false,
        code: 2
    },
    { id: 3, name: 'Cid', born: null, updated: null, balance: null, comma: null, active: null, code: null }
];

// comma shows a decimal comma: NumberFormatterComma
const fields = (): DatasourceOptions => ({
    key: 'id',
    fields: {
        id: 'number',
        born: 'date',
        updated: 'datetime',
        balance: 'number',
        comma: { type: 'number', formatter: 'numberComma' },
        active: 'boolean',
        code: 'number'
    }
});

const config = (columns: Record<string, ColumnConfig> = {}, options: Partial<GridConfig> = {}): GridConfig => ({
    readonly: false,
    columns: { code: { editor: { type: 'select', lookup: 'format-test-codes' } }, ...columns },
    layout: {
        center: ['name', 'born', 'updated', 'balance', 'comma', 'active', 'code'].map((field) => ({
            fields: [field],
            width: 100
        }))
    },
    ...options
});

const mount = (columns: Record<string, ColumnConfig> = {}, options: Partial<GridConfig> = {}) =>
    mountGrid(config(columns, options), rows(), fields());

const NORWEGIAN_2: ColumnFormat = { number: { decimals: 2, thousands: ' ', decimal: ',' } };

/** the input of a body cell: its field and its row in the displayed rows */
function cellInput(element: GridElement, field: string, row: number): HTMLInputElement {
    return Array.from(element.querySelectorAll<HTMLInputElement>(`input[data-attribute="${field}"]`)).find(
        (input) => (input.closest('.simple-html-grid-col-cell') as any)?.$row === row
    ) as HTMLInputElement;
}

/** types into an input as the user does: the text, then an input event */
function type(input: HTMLInputElement, text: string) {
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

/** waits for the grid's animation frame: the rows-changed microtask asks for it first */
const frame = async () => {
    await Promise.resolve();
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
};

/** the label and hint of a menu entry, as shown */
const entryText = (id: string) => menuEntry(id)?.textContent?.replace(/\s+/g, ' ').trim();

/** true when the entry has a ✓ */
const isChecked = (id: string) => menuEntry(id)?.getAttribute('aria-checked') === 'true';

/** opens a column's header menu and clicks an entry of Format › */
function pick(element: GridElement, field: string, id: string) {
    openLabelMenu(element, field);
    menuEntry(id).click();
}

describe('display formats in the grid - the cells', () => {
    it('expect the cells in the format of the config, a blank as blank', async () => {
        const { element } = await mount({
            born: { format: { date: 'norwegian' } },
            updated: { format: { date: 'isoTime' } },
            balance: { format: NORWEGIAN_2 }
        });

        expect(renderedColumn(element, 'born')).toEqual(['22.11.2026', '01.01.2027', '']);
        expect(renderedColumn(element, 'updated')).toEqual(['2026-11-22 13:45', '2027-01-01 08:05', '']);
        expect(renderedColumn(element, 'balance')).toEqual(['1 234 567,89', '-2,50', '']);
        // no format: the field's formatter
        expect(renderedColumn(element, 'comma')).toEqual(['2,5', '0', '']);
    });

    it("expect the names in the language of format.locale: the grid's texts, else the page's", async () => {
        setTexts({ 'format.locale': 'nb-NO' });
        const { element, gridInterface } = await mount({ born: { format: { date: 'full' } } });
        expect(renderedColumn(element, 'born')).toEqual(['søndag 22. november 2026', 'fredag 1. januar 2027', '']);

        gridInterface.updateConfig({ texts: { 'format.locale': 'en-GB' } });
        expect(renderedColumn(element, 'born')).toEqual(['Sunday, 22 November 2026', 'Friday, 1 January 2027', '']);
    });

    it('expect a week and a quarter written as the texts say', async () => {
        const { element, gridInterface } = await mount(
            { born: { format: { date: 'weekIso' } }, updated: { format: { date: 'quarter' } } },
            { texts: { 'format.weekIso': 'uke {week} {year}', 'format.quarter': '{quarter}. kvartal {year}' } }
        );
        expect(renderedColumn(element, 'born')).toEqual(['uke 47 2026', 'uke 53 2026', '']);
        expect(renderedColumn(element, 'updated')).toEqual(['4. kvartal 2026', '1. kvartal 2027', '']);

        gridInterface.updateConfig({ texts: {} });
        expect(renderedColumn(element, 'born')).toEqual(['2026-W47', '2026-W53', '']);
    });

    it('expect the days until from today, one less when the cells are rendered after midnight', async () => {
        const { element, gridInterface } = await mount({ born: { format: { date: 'daysUntil' } } });
        expect(renderedColumn(element, 'born')).toEqual(['0', '40', '']);

        // no timer of its own: the cells show the next day once they are rendered again
        vi.setSystemTime(new Date(2026, 10, 23, 0, 0, 1));
        expect(renderedColumn(element, 'born')).toEqual(['0', '40', '']);
        gridInterface.refresh();
        expect(renderedColumn(element, 'born')).toEqual(['-1', '39', '']);
    });

    it('expect numberOverride to follow the format: 0 is the text the format writes for it', async () => {
        const zeroToBlank = await mount({
            comma: { numberOverride: 'ZERO_TO_BLANK', format: { number: { decimals: 2, decimal: ',' } } }
        });
        expect(renderedColumn(zeroToBlank.element, 'comma')).toEqual(['2,50', '', '']);

        document.body.innerHTML = '';
        const blankToZero = await mount({
            comma: { numberOverride: 'BLANK_TO_ZERO', format: { number: { decimals: 2, decimal: ',' } } }
        });
        expect(renderedColumn(blankToZero.element, 'comma')).toEqual(['2,50', '0,00', '0,00']);
    });

    it('expect a renderer of your own to get the text of the format, the value as it is', async () => {
        const seen: CellRenderContext[] = [];
        registerCellRenderer('format-test', () => ({ update: (context) => seen.push(context) }));
        await mount({ born: { renderer: 'format-test', format: { date: 'weekIso' } } });

        const ann = seen.find((context) => context.row.name === 'Ann') as CellRenderContext;
        expect(ann.text).toEqual('2026-W47');
        expect(ann.value).toEqual(new Date(2026, 10, 22));
    });

    it('expect Find to find the text the cells show', async () => {
        const { gridInterface } = await mount({ born: { format: { date: 'weekIso' } }, updated: { format: { date: 'time' } } });

        expect(gridInterface.find('W53')).toEqual(1);
        // the value is not what the cell shows
        expect(gridInterface.find('2027-01-01')).toEqual(0);
    });

    it('expect fitColumns() to fit the text the cells show', async () => {
        const { gridInterface } = await mount({ born: { format: { date: 'year' } } });
        const width = () => gridInterface.getState().layout.center.find((column) => column.fields[0] === 'born')?.width ?? 0;
        gridInterface.fitColumns(['born']);
        const yearWidth = width();

        gridInterface.setState({ formats: { born: { date: 'full' } } });
        gridInterface.fitColumns(['born']);

        expect(width()).toBeGreaterThan(yearWidth);
    });
});

describe('display formats in the grid - editing keeps to the field formatter', () => {
    it('expect a cell shown as a week to be edited as the date, and to show the week of the new date after', async () => {
        const { element, datasource } = await mount({ born: { format: { date: 'weekIso' } } });
        const input = () => cellInput(element, 'born', 0);
        expect(input().value).toEqual('2026-W47');

        input().focus();
        expect(input().value).toEqual('2026-11-22');
        type(input(), '2026-12-31');
        input().blur();

        const born = datasource.getDataRows()[0].born as Date;
        expect([born.getFullYear(), born.getMonth(), born.getDate()]).toEqual([2026, 11, 31]);
        expect(input().value).toEqual('2026-W53');
    });

    it('expect a number cell edited as the plain number, and typed text parsed by the field formatter', async () => {
        const { element, datasource } = await mount({ balance: { format: NORWEGIAN_2 }, comma: { format: NORWEGIAN_2 } });
        const balance = () => cellInput(element, 'balance', 0);

        balance().focus();
        expect(balance().value).toEqual('1234567.891');
        type(balance(), '1234,5');
        balance().blur();
        expect(datasource.getDataRows()[0].balance).toEqual(1234.5);
        expect(balance().value).toEqual('1 234,50');

        // NumberFormatterComma: edited with its comma
        const comma = cellInput(element, 'comma', 0);
        comma.focus();
        expect(comma.value).toEqual('2,5');
    });

    it('expect a cell that can not be edited to show the format with the focus too', async () => {
        const { element } = await mount({ born: { format: { date: 'weekIso' } } }, { readonly: true });
        const input = cellInput(element, 'born', 0);

        input.focus();
        expect(input.value).toEqual('2026-W47');
    });

    it('expect the edited marker to show the original value as the cell shows a value', async () => {
        const { element, datasource } = await mount({ balance: { format: NORWEGIAN_2 } });
        datasource.getDataRows()[0].balance = 5;
        await frame();

        expect(cellInput(element, 'balance', 0).value).toEqual('5,00');
        const marker = cellInput(element, 'balance', 0)
            .closest('.simple-html-grid-col-cell')
            ?.querySelector('.simple-html-cell-edited-marker') as HTMLElement;
        expect(marker.getAttribute('data-tooltip')).toContain('Original value: 1 234 567,89');
    });
});

describe('display formats in the grid - the header filter keeps to the field formatter', () => {
    it('expect a date typed, not a week, and the placeholder of the field formatter', async () => {
        const { element, datasource } = await mount({ born: { format: { date: 'weekIso' } } });
        expect(headerFilterInput(element, 'born').placeholder).toEqual('YYYY-MM-DD');

        typeInHeaderFilter(element, 'born', '2027-01-01');

        // born >= 2027-01-01: Bob
        expect(datasource.getRows().map((row) => row.name)).toEqual(['Bob']);
        expect(headerFilterInput(element, 'born').value).toEqual('2027-01-01');
        expect(renderedColumn(element, 'born')).toEqual(['2026-W53']);
    });

    it('expect a number typed as the field formatter reads it', async () => {
        const { element, datasource } = await mount({ balance: { format: NORWEGIAN_2 } });

        // the plain number: 1 000,5 would be read as 1
        typeInHeaderFilter(element, 'balance', '1000,5');

        expect(datasource.getRows().map((row) => row.name)).toEqual(['Ann']);
        expect(datasource.getFilter()).toEqual({
            group: 'AND',
            children: [{ field: 'balance', operator: 'GREATER_THAN_OR_EQUAL_TO', value: 1000.5 }]
        });
    });
});

describe('display formats in the grid - Format › in the header menu', () => {
    /** the ids of Format ›, its submenus opened */
    const formatIds = (element: GridElement, field: string) => {
        openLabelMenu(element, field);
        return menuTreeIds().filter((id) => id.startsWith('header.format'));
    };
    const all = MENU_IDS.header.filter((id) => id.startsWith('header.format'));
    const dateOnly = (id: string) =>
        id.startsWith('header.format.date.') || id === 'header.format.timeSeparator' || id === 'header.format.partSeparator';
    const timeIds = [
        'header.format.timeSeparator',
        ...MENU_IDS.header.filter((id) => /header\.format\.date\.(.*Time|.*Seconds|time)/.test(id))
    ];

    it('expect the date formats on a date column, with the time on a datetime column, the number formats on a number column', async () => {
        const { element } = await mount();

        expect(formatIds(element, 'updated')).toEqual(
            all.filter(
                (id) => dateOnly(id) || ['header.format', 'header.format.default', 'header.format.defaultSeparator'].includes(id)
            )
        );
        expect(formatIds(element, 'born')).toEqual(formatIds(element, 'updated').filter((id) => !timeIds.includes(id)));
        expect(formatIds(element, 'balance')).toEqual(all.filter((id) => !dateOnly(id)));
        expect(timeIds).toHaveLength(7);
    });

    it('expect no Format › on a text, a boolean and a lookup column', async () => {
        const { element } = await mount();
        for (const field of ['name', 'active', 'code']) {
            expect(formatIds(element, field), field).toEqual([]);
        }
    });

    it('expect Default checked without a format, a pick to set the state and have the ✓, Default to clear it', async () => {
        const { element, gridInterface } = await mount();
        openLabelMenu(element, 'born');
        expect(isChecked('header.format.default')).toBe(true);
        expect(isChecked('header.format.date.weekIso')).toBe(false);

        pick(element, 'born', 'header.format.date.weekIso');
        expect(gridInterface.getState().formats).toEqual({ born: { date: 'weekIso' } });
        expect(renderedColumn(element, 'born')).toEqual(['2026-W47', '2026-W53', '']);

        openLabelMenu(element, 'born');
        expect(isChecked('header.format.date.weekIso')).toBe(true);
        expect(isChecked('header.format.default')).toBe(false);

        pick(element, 'born', 'header.format.default');
        expect(gridInterface.getState().formats).toEqual({});
        expect(renderedColumn(element, 'born')).toEqual(['2026-11-22', '2027-01-01', '']);
    });

    it('expect a pick on one column to keep the formats of the others', async () => {
        const { element, gridInterface } = await mount({ balance: { format: NORWEGIAN_2 } });

        pick(element, 'born', 'header.format.date.year');

        expect(gridInterface.getState().formats).toEqual({ balance: NORWEGIAN_2, born: { date: 'year' } });
    });

    it('expect the hints to be examples: today in each format, 1234567.891 in a number format', async () => {
        const { element } = await mount();
        openLabelMenu(element, 'born');
        expect(entryText('header.format.default')).toEqual('Default (2026-11-22)');
        expect(entryText('header.format.date.norwegian')).toEqual('Norwegian (22.11.2026)');
        expect(entryText('header.format.date.weekIso')).toEqual('Week, ISO (2026-W47)');
        expect(entryText('header.format.date.weekday')).toEqual('Day of week (Sunday)');
        // always 0: no example
        expect(entryText('header.format.date.daysUntil')).toEqual('Days until');

        openLabelMenu(element, 'updated');
        expect(entryText('header.format.date.isoTime')).toEqual('ISO with time (2026-11-22 10:00)');

        openLabelMenu(element, 'balance');
        expect(entryText('header.format.default')).toEqual('Default (1234567.891)');
        expect(entryText('header.format.number.norwegian')).toEqual('Norwegian (1 234 567,891)');
        expect(entryText('header.format.number.swiss')).toEqual("Swiss (1'234'567.891)");
        expect(entryText('header.format.decimals.2')).toEqual('2 (1234567.89)');
        expect(entryText('header.format.percent')).toEqual('Percent (25.6 %)');
    });

    it("expect the hints in the grid's language: format.locale", async () => {
        const { element } = await mount(
            {},
            { texts: { 'format.locale': 'nb-NO', 'header.format.date.full': 'Dag- og månedsnavn' } }
        );
        openLabelMenu(element, 'born');
        expect(entryText('header.format.date.full')).toEqual('Dag- og månedsnavn (søndag 22. november 2026)');
    });

    it('expect a preset to set the separators and keep the decimals, the parts to change one thing each', async () => {
        const { element, gridInterface } = await mount();
        const formats = () => gridInterface.getState().formats;

        pick(element, 'balance', 'header.format.decimals.2');
        expect(formats()).toEqual({ balance: { number: { decimals: 2 } } });
        expect(renderedColumn(element, 'balance')).toEqual(['1234567.89', '-2.50', '']);

        pick(element, 'balance', 'header.format.number.norwegian');
        expect(formats()).toEqual({ balance: { number: { decimals: 2, thousands: ' ', decimal: ',' } } });
        expect(renderedColumn(element, 'balance')).toEqual(['1 234 567,89', '-2,50', '']);

        pick(element, 'balance', 'header.format.thousands.dot');
        expect(formats()).toEqual({ balance: { number: { decimals: 2, thousands: '.', decimal: ',' } } });

        pick(element, 'balance', 'header.format.decimals.asIs');
        pick(element, 'balance', 'header.format.thousands.none');
        expect(formats()).toEqual({ balance: { number: { decimal: ',' } } });

        pick(element, 'balance', 'header.format.number.english');
        pick(element, 'balance', 'header.format.percent');
        expect(formats()).toEqual({ balance: { number: { thousands: ',', percent: true } } });
        expect(renderedColumn(element, 'balance')).toEqual(['123,456,789.1 %', '-250 %', '']);
        pick(element, 'balance', 'header.format.percent');
        expect(formats()).toEqual({ balance: { number: { thousands: ',' } } });
    });

    it('expect the ✓ on what the number format has, nothing but Default without one', async () => {
        const { element, gridInterface } = await mount();
        openLabelMenu(element, 'balance');
        for (const id of [
            'header.format.number.plain',
            'header.format.decimals.asIs',
            'header.format.thousands.none',
            'header.format.decimalMark.dot'
        ]) {
            expect(isChecked(id), id).toBe(false);
        }

        gridInterface.setState({ formats: { balance: NORWEGIAN_2 } });
        openLabelMenu(element, 'balance');
        const checked = MENU_IDS.header.filter((id) => id.startsWith('header.format.') && isChecked(id));
        expect(checked).toEqual([
            'header.format.number.norwegian',
            'header.format.decimals.2',
            'header.format.thousands.space',
            'header.format.decimalMark.comma'
        ]);
    });

    it('expect a separator that the other one has greyed out: one character can not be both', async () => {
        const { element, gridInterface } = await mount({ balance: { format: { number: { thousands: ',' } } } });
        const disabled = (id: string) => menuEntry(id)?.getAttribute('aria-disabled') === 'true';

        openLabelMenu(element, 'balance');
        // the decimal mark is '.': no '.' between the thousands
        expect(disabled('header.format.thousands.dot')).toBe(true);
        expect(disabled('header.format.thousands.comma')).toBe(false);
        expect(disabled('header.format.decimalMark.comma')).toBe(true);
        menuEntry('header.format.decimalMark.comma').click();
        expect(gridInterface.getState().formats.balance).toEqual({ number: { thousands: ',' } });

        // the presets change both: never greyed out
        openLabelMenu(element, 'balance');
        expect(disabled('header.format.number.norwegian')).toBe(false);
    });

    it("expect the first pick on a field that shows a comma to keep the comma: the field formatter's mark", async () => {
        const { element, gridInterface } = await mount();
        openLabelMenu(element, 'comma');
        expect(entryText('header.format.decimals.1')).toEqual('1 (1234567,9)');
        // a comma between the thousands would be the decimal mark too
        expect(menuEntry('header.format.thousands.comma').getAttribute('aria-disabled')).toEqual('true');

        menuEntry('header.format.decimals.1').click();
        expect(gridInterface.getState().formats).toEqual({ comma: { number: { decimals: 1, decimal: ',' } } });
        expect(renderedColumn(element, 'comma')).toEqual(['2,5', '0,0', '']);
    });

    it('expect the menus hook to change Format ›: an entry left out, one of your own added', async () => {
        const { element, gridInterface } = await mountGrid(config(), rows(), fields(), {
            menus: {
                header: (defaults, context) =>
                    defaults.map((entry): MenuEntry => {
                        if (entry.type !== 'submenu' || entry.id !== 'header.format') {
                            return entry;
                        }
                        return {
                            ...entry,
                            entries: [
                                ...entry.entries.filter((inner) => inner.id !== 'header.format.date.weekUs'),
                                {
                                    id: 'my.format.week',
                                    label: 'Week',
                                    action: () =>
                                        context.gridInterface.setState({ formats: { [context.field]: { date: 'weekIso' } } })
                                }
                            ]
                        };
                    })
            }
        });

        openLabelMenu(element, 'born');
        expect(menuEntry('header.format.date.weekUs')).toBeNull();
        menuEntry('my.format.week').click();

        expect(gridInterface.getState().formats).toEqual({ born: { date: 'weekIso' } });
        expect(renderedColumn(element, 'born')).toEqual(['2026-W47', '2026-W53', '']);
    });
});

describe('display formats in the grid - the state', () => {
    it("expect getState() to have the config's formats, setState() to set them, resetState() to go back", async () => {
        const { element, gridInterface } = await mount({ born: { format: { date: 'norwegian' } } });
        expect(gridInterface.getState().formats).toEqual({ born: { date: 'norwegian' } });

        gridInterface.setState({ formats: { updated: { date: 'time' }, balance: NORWEGIAN_2 } });
        expect(gridInterface.getState().formats).toEqual({ updated: { date: 'time' }, balance: NORWEGIAN_2 });
        // a part replaces the whole part: born has none now
        expect(renderedColumn(element, 'born')).toEqual(['2026-11-22', '2027-01-01', '']);
        expect(renderedColumn(element, 'updated')).toEqual(['13:45', '08:05', '']);

        gridInterface.resetState();
        expect(gridInterface.getState().formats).toEqual({ born: { date: 'norwegian' } });
        expect(renderedColumn(element, 'updated')).toEqual(['2026-11-22T13:45:12', '2027-01-01T08:05:00', '']);
    });

    it('expect getState() and setState() to copy: a change to the object changes nothing', async () => {
        const { element, gridInterface } = await mount();
        const formats: Record<string, ColumnFormat> = { balance: { number: { decimals: 1 } } };
        gridInterface.setState({ formats });
        (formats.balance.number as { decimals: number }).decimals = 3;
        const state = gridInterface.getState();
        (state.formats.balance.number as { decimals: number }).decimals = 4;

        expect(gridInterface.getState().formats).toEqual({ balance: { number: { decimals: 1 } } });
        expect(renderedColumn(element, 'balance')).toEqual(['1234567.9', '-2.5', '']);
    });

    it('expect a state saved as JSON to give another grid the same formats', async () => {
        const first = await mount();
        first.gridInterface.setState({ formats: { born: { date: 'weekIso' }, balance: NORWEGIAN_2 } });
        const saved = JSON.stringify(first.gridInterface.getState());

        const other = await mount();
        other.gridInterface.setState(JSON.parse(saved));

        expect(other.gridInterface.getState().formats).toEqual(first.gridInterface.getState().formats);
        expect(renderedColumn(other.element, 'balance')).toEqual(['1 234 567,89', '-2,50', '']);
    });

    it('expect initialState.formats to be where the grid starts, before the columns', async () => {
        const { element, gridInterface } = await mount(
            { born: { format: { date: 'norwegian' } } },
            { initialState: { formats: { born: { date: 'year' } } } }
        );
        expect(renderedColumn(element, 'born')).toEqual(['2026', '2027', '']);

        gridInterface.setState({ formats: {} });
        gridInterface.resetState();
        expect(gridInterface.getState().formats).toEqual({ born: { date: 'year' } });
    });

    it('expect updateConfig({ columns }) to replace the formats, and to be what resetState() goes back to', async () => {
        const { gridInterface } = await mount({ born: { format: { date: 'norwegian' } } });
        gridInterface.setState({ formats: { born: { date: 'year' }, balance: NORWEGIAN_2 } });

        gridInterface.updateConfig({ columns: { ...config().columns, updated: { format: { date: 'time' } } } });
        expect(gridInterface.getState().formats).toEqual({ updated: { date: 'time' } });

        gridInterface.setState({ formats: {} });
        gridInterface.resetState();
        expect(gridInterface.getState().formats).toEqual({ updated: { date: 'time' } });

        // another option: the formats stay
        gridInterface.setState({ formats: { born: { date: 'year' } } });
        gridInterface.updateConfig({ readonly: true });
        expect(gridInterface.getState().formats).toEqual({ born: { date: 'year' } });
    });

    it('expect setState() to throw a TypeError for a format that does not fit, and to change nothing', async () => {
        const { element, gridInterface } = await mount({ born: { format: { date: 'norwegian' } } });
        const cases: [unknown, RegExp][] = [
            [{ born: { date: 'week' } }, /setState: formats.born.date is "week", a date field takes/],
            [{ born: { date: 'time' } }, /setState: formats.born.date is "time", it shows the time of day/],
            [{ balance: { date: 'iso' } }, /setState: formats.balance.date is for a date or datetime field, 'balance' is number/],
            [{ name: { number: {} } }, /setState: formats.name.number is for a number field, 'name' is text/],
            [{ balance: { number: { thousands: ',', decimal: ',' } } }, /as the thousands separator and the decimal mark/],
            [{ code: { number: {} } }, /setState: formats.code is .*a lookup column/],
            [{ born: 'weekIso' }, /setState: formats.born is "weekIso", it is an object/],
            [[], /setState: formats is an object of formats by field/]
        ];
        for (const [formats, message] of cases) {
            expect(() =>
                gridInterface.setState({ formats, sorting: [{ attribute: 'name', ascending: false }] } as never)
            ).toThrow(message);
        }
        expect(() => gridInterface.setState({ formats: { born: { date: 'week' } } } as never)).toThrow(TypeError);

        expect(gridInterface.getState().formats).toEqual({ born: { date: 'norwegian' } });
        expect(gridInterface.getState().sorting).toEqual([]);
        expect(renderedColumn(element, 'born')).toEqual(['22.11.2026', '01.01.2027', '']);
    });
});

describe('display formats in the grid - the config', () => {
    it('expect a TypeError from the constructor and updateConfig() for a format that does not fit', async () => {
        await expect(mount({ born: { format: { date: 'weekISO' } as never } })).rejects.toThrow(
            /GridConfig: columns.born.format.date is "weekISO", a date field takes 'iso'/
        );
        await expect(mount({ name: { format: { date: 'iso' } } })).rejects.toThrow(
            new TypeError("GridConfig: columns.name.format.date is for a date or datetime field, 'name' is text")
        );
        await expect(
            mount({ code: { editor: { type: 'select', lookup: 'format-test-codes' }, format: { number: {} } } })
        ).rejects.toThrow(/GridConfig: columns.code.format is .*a lookup column \(editor\)/);

        const { gridInterface, element } = await mount();
        expect(() =>
            gridInterface.updateConfig({ columns: { balance: { format: { number: { decimals: 5 } } } as never } })
        ).toThrow(/GridConfig: columns.balance.format.number.decimals is 5/);
        // nothing changed
        expect(gridInterface.getState().formats).toEqual({});
        expect(renderedColumn(element, 'code')).toEqual(['One', 'Two', '']);
    });

    it('expect a config with formats to come back from JSON the same, and the grid to show the same', async () => {
        const columns = { born: { format: { date: 'weekUs' } }, balance: { format: NORWEGIAN_2 } } satisfies Record<
            string,
            ColumnConfig
        >;
        const viaJson = JSON.parse(JSON.stringify(config(columns)));
        expect(viaJson).toEqual(config(columns));

        const { element } = await mountGrid(viaJson, rows(), fields());
        expect(renderedColumn(element, 'born')).toEqual(['2026-W48', '2027-W01', '']);
        expect(renderedColumn(element, 'balance')).toEqual(['1 234 567,89', '-2,50', '']);
    });
});

describe('display formats in the grid - aggregates and the footer', () => {
    it('expect the totals row and the group rows to show a sum in the number format', async () => {
        const { element, datasource } = await mount(
            { balance: { format: NORWEGIAN_2, aggregate: ['sum', 'avg'] } },
            { totalsRow: true }
        );
        const totals = element.querySelector('.simple-html-grid-totals') as HTMLElement;
        const textOf = (key: string, parent: Element = totals) =>
            parent.querySelector(`[data-aggregate="${key}"]`)?.textContent?.replace(/\s+/g, ' ').trim();

        // 1234567.891 - 2.5
        expect(textOf('sum:balance')).toEqual('Sum 1 234 565,39');
        expect(textOf('avg:balance')).toEqual('Avg 617 282,70');

        datasource.group([{ attribute: 'name', title: 'Name' }]);
        await Promise.resolve();
        const groupRow = Array.from(element.querySelectorAll('.simple-html-grid-body-row-container-group > *')).find((row) =>
            row.textContent?.includes('Bob')
        ) as Element;
        expect(textOf('sum:balance', groupRow)).toEqual('Sum -2,50');
    });

    it('expect the summary of the selected cells in the number format of the first number field', async () => {
        const { element, gridInterface } = await mount({ balance: { format: NORWEGIAN_2 } });
        gridInterface.setRanges([{ fromRow: 0, fromField: 'balance', toRow: 2, toField: 'balance' }]);
        const items = () =>
            Array.from(element.querySelectorAll('.footer-summary-item'), (item) => item.textContent?.trim() ?? '');

        expect(items()).toEqual(['Count: 2', 'Sum: 1 234 565,39', 'Average: 617 282,70', 'Min: -2,50', 'Max: 1 234 567,89']);

        // decimals as is: two at most, as without a format
        gridInterface.setState({ formats: { balance: { number: { thousands: ' ' } } } });
        gridInterface.setRanges([{ fromRow: 0, fromField: 'balance', toRow: 2, toField: 'balance' }]);
        expect(items()).toEqual(['Count: 2', 'Sum: 1 234 565.39', 'Average: 617 282.7', 'Min: -2.5', 'Max: 1 234 567.89']);
    });
});

describe('display formats in the grid - copy and the CSV export are the value', () => {
    it("expect copy to give the field formatter's text: a paste reads it back", async () => {
        const { element, gridInterface, datasource } = await mount({
            born: { format: { date: 'weekIso' } },
            balance: { format: NORWEGIAN_2 }
        });
        gridInterface.setRanges([{ fromRow: 0, fromField: 'born', toRow: 1, toField: 'balance' }]);
        const input = cellInput(element, 'born', 0);
        input.focus();

        const clipboardData = new DataTransfer();
        input.dispatchEvent(new ClipboardEvent('copy', { clipboardData, bubbles: true, cancelable: true, composed: true }));

        // the header line first (copyHeaders)
        expect(clipboardData.getData('text/plain')).toEqual(
            'Born\tUpdated\tBalance\r\n2026-11-22\t2026-11-22T13:45:12\t1234567.891\r\n2027-01-01\t2027-01-01T08:05:00\t-2.5\r\n'
        );
        expect(datasource.getDataRows()[0].balance).toEqual(1234567.891);
    });

    it("expect the CSV export to give the field formatter's text", async () => {
        const { gridInterface } = await mount({ born: { format: { date: 'weekIso' } }, balance: { format: NORWEGIAN_2 } });

        const csv = gridInterface.getCsv({ fields: ['name', 'born', 'balance'] });

        expect(csv).toEqual('Name,Born,Balance\r\nAnn,2026-11-22,1234567.891\r\nBob,2027-01-01,-2.5\r\nCid,,\r\n');
    });
});
