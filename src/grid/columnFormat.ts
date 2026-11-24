import type { FieldType } from '../datasource/field';
import type { Formatter } from '../datasource/formatter';
import { fillText, getText, type Texts } from '../texts';
import { LINK_PROTOCOLS, templateProblem, urlTemplateProblem } from './cellTemplate';
import { assertColorRules, type ColorRule, type RuleFieldOf } from './colorRules';
import { assertValueFills, type ColorScaleFormat, type DataBarFormat, type IconSetFormat } from './dataBars';
import type { ColumnConfig } from './gridConfig';

/**
 * The display formats of a column: how its cells show the value, picked by the user in the header
 * menu (Format ›) or set in the config (`ColumnConfig.format`) and the state (`GridState.formats`).
 * Only the text shown changes - the value, editing, filtering, sorting, grouping, copy and the CSV
 * export stay with the field's formatter. See the formatting guide, "Display formats". The one
 * exception is the header filter: it takes the text as the cells show it (`filterAsShown`, see
 * filterAsShown.ts) and makes ordinary date and number conditions of it.
 *
 * A column's format is one plain object (JSON) with a part per kind of value: `{ date: 'weekIso' }`,
 * `{ number: { decimals: 2 } }`, `{ text: '{name} ({id})', link: { url: 'https://x/{id}' } }`. The grid
 * shows a value through one place: GridInterface.__getCellFormatter, a Formatter made by
 * displayFormatter() - and for a text template, which needs the row, templateFormatter() of
 * cellTemplate.ts. The address of a link is GridInterface.__getCellLink.
 *
 * The format has the rest of what the user sets for a column in the grid config dialog too: the
 * column's label (`label`, read by getColumnLabel), the placeholder of its empty cells (`placeholderRow`,
 * `placeholderRowLabel` - rowPlaceholder), a number column's blank / 0 (`numberOverride`,
 * numberOverrideOf in cellText.ts) and the checkboxes of a text or number column (`checkbox`). And its
 * colour rules (`rules`, colorRules.ts): a cell's colours from its value. And a number column's data bar,
 * colour scale and icon set (`bar`, `scale`, `icons`, dataBars.ts): from the value's place among the
 * column's numbers.
 */

/**
 * How a `date` or `datetime` column shows its dates: `ColumnFormat.date`. What 2026-11-22 13:45:12 (a
 * Sunday) is shown as:
 *
 * | format | shows | |
 * | --- | --- | --- |
 * | `'iso'` | `2026-11-22` | |
 * | `'norwegian'` | `22.11.2026` | |
 * | `'norwegianShort'` | `22.11.26` | |
 * | `'us'` | `11/22/2026` | |
 * | `'uk'` | `22/11/2026` | |
 * | `'medium'` | `Nov 22, 2026` - `22. nov. 2026` in `nb-NO` | the names in the language of the text `format.locale` |
 * | `'long'` | `November 22, 2026` - `22. november 2026` | |
 * | `'full'` | `Sunday, November 22, 2026` - `søndag 22. november 2026` | |
 * | `'weekday'` | `Sunday` - `søndag` | |
 * | `'weekIso'` | `2026-W47` | ISO 8601: weeks start on Monday, week 1 has the year's first Thursday. The year is the week's: 2027-01-01 is `2026-W53`. Written as the text `format.weekIso` says, `'{year}-W{week}'` |
 * | `'weekUs'` | `2026-W48` | weeks start on Sunday, week 1 has January 1 (Excel's `WEEKNUM`): 2026-12-31 is `2026-W53`, 2027-01-01 `2027-W01`. The text `format.weekUs` |
 * | `'month'` | `2026-11` | |
 * | `'quarter'` | `2026 Q4` | the text `format.quarter`, `'{year} Q{quarter}'` |
 * | `'year'` | `2026` | |
 * | `'daysUntil'` | `0` | whole days from today: `1` tomorrow, `-1` yesterday. Today is the day the cell is rendered |
 * | `'isoTime'` | `2026-11-22 13:45` | a `datetime` column only |
 * | `'isoSeconds'` | `2026-11-22 13:45:12` | a `datetime` column only |
 * | `'norwegianTime'` | `22.11.2026 13:45` | a `datetime` column only |
 * | `'norwegianSeconds'` | `22.11.2026 13:45:12` | a `datetime` column only |
 * | `'time'` | `13:45` | a `datetime` column only |
 * | `'timeSeconds'` | `13:45:12` | a `datetime` column only |
 *
 * The date's local day and time are shown, as the field's formatter shows them.
 *
 * @example
 * ```ts
 * import type { DateFormat, GridConfig } from '@simple-html/grid';
 *
 * const week: DateFormat = 'weekIso'; // 2026-W47
 * const columns: GridConfig['columns'] = { due: { format: { date: week } } };
 * ```
 */
export type DateFormat =
    | 'iso'
    | 'norwegian'
    | 'norwegianShort'
    | 'us'
    | 'uk'
    | 'medium'
    | 'long'
    | 'full'
    | 'weekday'
    | 'weekIso'
    | 'weekUs'
    | 'month'
    | 'quarter'
    | 'year'
    | 'daysUntil'
    | 'isoTime'
    | 'isoSeconds'
    | 'norwegianTime'
    | 'norwegianSeconds'
    | 'time'
    | 'timeSeconds';

/**
 * @internal
 * the display formats of a date and a datetime column, in the order of the menu: the date written out,
 * then a part of it. Every DateFormat is in this list or in DATETIME_FORMATS (columnFormat.test.ts)
 */
export const DATE_FORMATS: readonly DateFormat[] = [
    'iso',
    'norwegian',
    'norwegianShort',
    'us',
    'uk',
    'medium',
    'long',
    'full',
    'weekday',
    'weekIso',
    'weekUs',
    'month',
    'quarter',
    'year',
    'daysUntil'
];

/**
 * @internal
 * the date formats a date column is grouped by when it shows them: a period of time, so the rows of one
 * are next to each other in the sort - not the day of the week, nor a time of day
 */
export const GROUP_BY_FORMATS: readonly DateFormat[] = ['weekIso', 'weekUs', 'month', 'quarter', 'year'];

/**
 * @internal
 * the display formats of a datetime column only: they show the time of day
 */
export const DATETIME_FORMATS: readonly DateFormat[] = [
    'isoTime',
    'isoSeconds',
    'norwegianTime',
    'norwegianSeconds',
    'time',
    'timeSeconds'
];

/**
 * How a `number` column shows its numbers: `ColumnFormat.number` - the decimals, the thousands
 * separator and the decimal mark. Every part is optional, `{}` is `1234567.891`. What 1234567.891 is
 * shown as:
 *
 * | format | shows |
 * | --- | --- |
 * | `{ thousands: ' ', decimal: ',' }` | `1 234 567,891` - Norwegian |
 * | `{ thousands: ',' }` | `1,234,567.891` - English |
 * | `{ thousands: "'" }` | `1'234'567.891` - Swiss |
 * | `{ decimals: 2, thousands: ' ', decimal: ',' }` | `1 234 567,89` |
 * | `{ decimals: 0 }` | `1234568` |
 * | `{ decimals: 1, percent: true }` on 0.256 | `25.6 %` |
 *
 * The same character can not be both separators: `{ thousands: '.' }` (the decimal mark is `.` too)
 * throws a `TypeError`, give it `decimal: ','`.
 *
 * @example
 * ```ts
 * import type { GridConfig, NumberFormat } from '@simple-html/grid';
 *
 * const norwegian: NumberFormat = { decimals: 2, thousands: ' ', decimal: ',' }; // 1 234 567,89
 * const columns: GridConfig['columns'] = { balance: { format: { number: norwegian } } };
 * ```
 */
export interface NumberFormat {
    /**
     * the decimals shown, 0 to 4: rounded half away from zero, of the number as it is written
     * (`1.005` is `1.01`) - the decimals a number has are padded with 0. Left out: the decimals the
     * number has, as the field's formatter shows them (at most 20)
     */
    decimals?: 0 | 1 | 2 | 3 | 4;
    /**
     * between the thousands: `' '` a space, `','` a comma, `'.'` a dot or `"'"` an apostrophe. Left
     * out: none. The space is a plain space (U+0020), not the no-break space `Intl.NumberFormat('nb-NO')`
     * writes: a cell is one line, and Find finds a space typed
     */
    thousands?: ' ' | ',' | '.' | "'";
    /** the decimal mark, `'.'` or `','`. Left out: `'.'` */
    decimal?: '.' | ',';
    /** `true`: the number times 100, with ` %` after it - 0.256 is `25.6 %` */
    percent?: boolean;
}

/**
 * The link of a text or number column, `ColumnFormat.link`: its cells are links, the text they show (the cell's
 * own, or `ColumnFormat.text`) is the link's text. The address is a template: text with `{field}`
 * placeholders, each the value of a field of the row - encoded, so a value can not change where the
 * link goes. Templates, not code: nothing in it is run.
 *
 * | `url` | links to |
 * | --- | --- |
 * | `'https://crm.example.com/customer/{id}'` | `https://crm.example.com/customer/12` |
 * | `'https://duckduckgo.com/?q={company}'` | `https://duckduckgo.com/?q=Acme%20Corp` |
 * | `'mailto:{email}'` | `mailto:ann@example.com` |
 * | `'tel:{phone}'` | `tel:+47%2012345678` |
 * | `'{website}'` | the address the field holds, as it is: one placeholder alone is a whole address |
 * | `'https://shop.example.com/order/{value}'` on a number column | `https://shop.example.com/order/1042` |
 *
 * The address starts with `https://`, `http://`, `mailto:` or `tel:`, or is one placeholder - else the
 * format throws a `TypeError` (`javascript:`, `data:`, a relative `/customer/{id}`). A row whose address
 * is no absolute address of those four schemes - a field's `javascript:alert(1)`, an empty `{id}` - shows
 * its text, no link. See the formatting guide, "Links".
 *
 * @example
 * ```ts
 * import type { GridConfig, LinkFormat } from '@simple-html/grid';
 *
 * const customer: LinkFormat = { url: 'https://crm.example.com/customer/{id}', newTab: true };
 * const columns: GridConfig['columns'] = {
 *     company: { format: { link: customer } },
 *     email: { format: { link: { url: 'mailto:{email}' } } }
 * };
 * ```
 */
export interface LinkFormat {
    /**
     * the address: `https://`, `http://`, `mailto:` or `tel:` and `{field}` placeholders - their values
     * encoded - or one placeholder alone, a field that holds the whole address (`'{website}'`)
     */
    url: string;
    /** opens the link in a new tab (`target="_blank"`, `rel="noopener noreferrer"`). Left out: `false` */
    newTab?: boolean;
}

/**
 * The checkboxes of a `text` or `number` column, `ColumnFormat.checkbox`: each cell is a checkbox, for
 * a field that holds a flag as `1` / `0`, `'Y'` / `'N'`. A cell is checked when its value is the
 * checked value - its text trimmed, a number equal to it. Clicked (or Space), an editable cell writes
 * the checked or the unchecked value: a number for a number field (`1`), else the text (`'1'`); an
 * unchecked value `''` empties the cell (null), as Delete does.
 *
 * The value stays the value: copy, paste, the CSV and Excel exports, sorting, grouping, the header
 * filter and the filter menu's value list have `1` and `0`, as without the checkboxes.
 *
 * | format | checked | a click writes |
 * | --- | --- | --- |
 * | `{}` | `'1'`, `' 1 '`; `1` in a number field | `'1'` / `'0'`, `1` / `0` in a number field |
 * | `{ checked: 'Y', unchecked: 'N' }` | `'Y'` | `'Y'` / `'N'` |
 * | `{ checked: '1', unchecked: '' }` | `'1'` | `'1'` / null |
 *
 * @example
 * ```ts
 * import type { CheckboxFormat, GridConfig } from '@simple-html/grid';
 *
 * const yesNo: CheckboxFormat = { checked: 'Y', unchecked: 'N' };
 * const columns: GridConfig['columns'] = {
 *     newsletter: { format: { checkbox: {} } }, // '1' / '0' (a text field) or 1 / 0 (a number field)
 *     approved: { format: { checkbox: yesNo } }
 * };
 * ```
 */
export interface CheckboxFormat {
    /**
     * the value of a checked cell, written when it is checked: text, not `''`. A number for a number
     * field (`'1'`, `'-1'`). Left out: `'1'`
     */
    checked?: string;
    /**
     * the value written when a cell is unchecked: text, `''` empties the cell. A number or `''` for a
     * number field. Not the checked value. Left out: `'0'`. A cell whose value is neither is unchecked
     */
    unchecked?: string;
}

/**
 * The display format of a column, `ColumnConfig.format` and `GridState.formats`: one plain object (JSON)
 * with a part for the kind of value the column holds - `date` for a `date` or `datetime` field, `number`
 * for a `number` field, `text` for a `text`, `number`, `date` or `datetime` field, `link` for a `text` or
 * `number` field. A part for another type throws a
 * `TypeError`. `{}` is no format: the field's formatter.
 *
 * Only what the cells show changes - and what follows the cells: the aggregates of a number column, the
 * summary of the selected cells in the footer, Find, the fitted width and the dimmed repeated values.
 * The value stays as it was: a cell that is edited shows the value as the field's formatter writes it
 * (its `formatForEdit`), a header filter is typed as the cells show it (`filterAsShown`, a date or
 * number format; else as the field's formatter reads it), sorting and grouping use the value, the group rows' names, copy and the CSV export the field's formatter. The
 * Excel export writes the value, with an Excel number format like the display format where Excel has
 * one - and the colours of the rules, the bars, the scales and the icons (`ExcelOptions.colors`).
 *
 * The templates - `text` and `link.url` - are text with `{field}` placeholders, not
 * code: a saved state can come from anywhere, nothing in a format is run. See the formatting guide,
 * "Templates" and "Links".
 *
 * The rest of what the user sets in the grid config dialog is in the format too, so the state
 * keeps it with the rest: the column's `label` and the placeholder of its empty cells (`placeholderRow`),
 * a number column's `numberOverride` (blank as 0, 0 as blank), and `checkbox` - the cells of a text or
 * number column as checkboxes. Each wins over the column's own option (`ColumnConfig.label`,
 * `placeholderRow`, `numberOverride`). And `rules`, the colour rules of any column: a cell's text
 * colour, background and bold from its value. And for a number column a data bar (`bar`), a colour scale
 * (`scale`) and an icon set (`icons`), as a spreadsheet's conditional formatting.
 *
 * @example
 * ```ts
 * import type { ColumnFormat, GridConfig } from '@simple-html/grid';
 *
 * const week: ColumnFormat = { date: 'weekIso' };
 * const config: GridConfig = {
 *     columns: {
 *         born: { format: { date: 'norwegian' } }, // 22.11.2026
 *         due: { format: week }, // 2026-W47
 *         balance: { format: { number: { decimals: 2, thousands: ' ', decimal: ',' } } }, // 1 234 567,89
 *         name: { format: { text: '{name} ({id})' } }, // Ann (12)
 *         weight: { format: { number: { decimals: 1 }, text: '{value} kg' } }, // 72.5 kg
 *         company: { format: { link: { url: 'https://duckduckgo.com/?q={company}', newTab: true } } },
 *         stock: { format: { label: 'In stock', placeholderRowLabel: true, numberOverride: 'ZERO_TO_BLANK' } },
 *         newsletter: { format: { checkbox: { checked: '1', unchecked: '0' } } }, // '1' is checked
 *         // red text for a negative number, the first rule that matches wins
 *         total: { format: { rules: [{ operator: 'LESS_THAN', value: '0', color: 'red' }] } },
 *         // a data bar, a colour scale, an icon set: by the value's place among the column's numbers
 *         sales: { format: { bar: { color: 'green' }, icons: { set: 'arrows' } } },
 *         margin: { format: { scale: { minColor: 'red', midColor: 'yellow', maxColor: 'green' } } }
 *     },
 *     layout: {
 *         center: [
 *             { fields: ['born'], width: 100 },
 *             { fields: ['due'], width: 100 },
 *             { fields: ['balance'], width: 120 },
 *             { fields: ['name'], width: 120 },
 *             { fields: ['weight'], width: 100 },
 *             { fields: ['company'], width: 150 },
 *             { fields: ['stock'], width: 80 },
 *             { fields: ['newsletter'], width: 80 },
 *             { fields: ['total'], width: 100 },
 *             { fields: ['sales'], width: 100 },
 *             { fields: ['margin'], width: 100 }
 *         ]
 *     }
 * };
 * ```
 */
export interface ColumnFormat {
    /** how a `date` or `datetime` column shows its dates, see {@link DateFormat} */
    date?: DateFormat;
    /** how a `number` column shows its numbers, see {@link NumberFormat} */
    number?: NumberFormat;
    /**
     * what the cells of a `text`, `number`, `date` or `datetime` column show: a template, text with
     * `{field}` placeholders - each the value of a field of the row as its formatter writes it, `{value}`
     * the cell's own, in the column's `number` or `date` format when it has one. `'{firstname}
     * {lastname}'`, `'{value} kg'`, `'week {value}'`, `'{company}'`. Left out: the cell's own text. The
     * text of the link too, with `link`. An edited cell shows the value, not the template. Not `''`
     */
    text?: string;
    /** the cells of a `text` or `number` column are links, see {@link LinkFormat} */
    link?: LinkFormat;
    /**
     * the column's label, any column: its header and everywhere the grid names the column - the menus,
     * the column chooser, the filter editor, the footer's filter, copy with headers and the headers of
     * the CSV and Excel exports. Wins over `ColumnConfig.label`. Left out: the column's own label. Not
     * `''`
     */
    label?: string;
    /**
     * the placeholder of the column's empty cells - the text an empty cell shows greyed, what to type in it
     * (`'Required'`, `'Name of the customer'`) - any column but a `boolean` one (its cells are checkboxes).
     * Wins over `ColumnConfig.placeholderRow`; `GridConfig.placeholderRowCurrentEntityOnly` shows it on the
     * current row only. Left out: the column's own. Not `''`, not with `placeholderRowLabel`
     */
    placeholderRow?: string;
    /** `true`: the placeholder of the column's empty cells is the column's label, see `placeholderRow` */
    placeholderRowLabel?: boolean;
    /**
     * what the cells of a `number` column show for a blank and for 0 - the value is not changed:
     * `'BLANK_TO_ZERO'` a blank as `0`, `'ZERO_TO_BLANK'` 0 as an empty cell, `'NONE'` both as they
     * are. Wins over `ColumnConfig.numberOverride` - `'NONE'` turns the column's off. Left out: the
     * column's `numberOverride`
     */
    numberOverride?: 'BLANK_TO_ZERO' | 'ZERO_TO_BLANK' | 'NONE';
    /**
     * the cells of a `text` or `number` column are checkboxes, see {@link CheckboxFormat}. Not with
     * `text`, `link`, `number` or `numberOverride`: a checkbox shows no text
     */
    checkbox?: CheckboxFormat;
    /**
     * the colour rules of the column, any column: when a cell's value matches a rule's condition - the
     * header filter's operator and text - the cell has its text colour, background or bold. The first
     * rule that matches wins, see {@link ColorRule}:
     * `[{ operator: 'LESS_THAN', value: '0', color: 'red' }]`. Left out: the grid's colours
     */
    rules?: ColorRule[];
    /**
     * a data bar in the cells of a `number` column: as long as the value's place in the range of the
     * column's numbers, see {@link DataBarFormat}: `{ color: 'green' }`. Drawn over a rule's background.
     * Left out: none. Not with `checkbox`
     */
    bar?: DataBarFormat;
    /**
     * a colour scale of a `number` column: the cell's background by the value's place from the smallest
     * number to the largest, see {@link ColorScaleFormat}: `{ minColor: 'red', midColor: 'yellow',
     * maxColor: 'green' }`. A rule's background wins over it. Left out: none. Not with `checkbox`
     */
    scale?: ColorScaleFormat;
    /**
     * an icon before (or after) the value of a `number` column, by thresholds, see {@link IconSetFormat}:
     * `{ set: 'arrows' }`. Shows with the rules' colours. Left out: none. Not with `checkbox`
     */
    icons?: IconSetFormat;
    /**
     * the header filter of a column with a `date` or `number` format takes the text as the cells show it,
     * see the filtering guide, "Filter as shown". Left out (or `true`): on - `2026-W47` typed in a column
     * shown as `weekIso` is the whole week, `≥ 2026-11` from November 1, `1 234,5` a number. `false`: the
     * header filter takes the text as the field's formatter reads it (`2026-11-16`), as it does without
     * a format. A format that shows no period of time - `'weekday'`, `'time'`, `'timeSeconds'` - is
     * never filtered as shown. For a `date`, `datetime` or `number` field: true or false
     *
     * @example
     * ```ts
     * import type { GridConfig } from '@simple-html/grid';
     *
     * const columns: GridConfig['columns'] = {
     *     due: { format: { date: 'weekIso' } }, // `2026-W47` in the header filter is the week
     *     born: { format: { date: 'norwegian', filterAsShown: false } } // typed as YYYY-MM-DD
     * };
     * ```
     */
    filterAsShown?: boolean;
    /**
     * a `text` column's cells as text of several lines (`true`) - shown on their first line, edited in the
     * text editor, Enter a new line, taller with `fitRows()` - or of one line (`false`): only a value with a
     * line break is shown as several lines then, as always. Wins over the field's `multiline`
     * (`FieldConfig.multiline`). Left out: the field's. Not for a lookup column, not with `checkbox`
     */
    multiline?: boolean;
    /**
     * `true`: the column's cells can not be edited, also in an editable grid; `false`: they can, as the
     * grid's other cells. Any column. Wins over `ColumnConfig.readonly`. Left out: the column's
     * `readonly`. The `isReadonly` hook still has the last word, it gets this as its `readonly`
     */
    readonly?: boolean;
}

/**
 * The placeholder of a column's empty cells: the user's from the grid config dialog - the column's label
 * (`format.placeholderRowLabel`) or a text (`format.placeholderRow`) - else the column's own
 * (`ColumnConfig.placeholderRow`), else none (`''`)
 * @param label the column's label, getColumnLabel
 */
export function rowPlaceholder(column: ColumnConfig | undefined, label: string): string {
    if (column?.format?.placeholderRowLabel) {
        return label;
    }
    return column?.format?.placeholderRow ?? column?.placeholderRow ?? '';
}

/**
 * true when a column's cells are read only by its settings: the user's (`format.readonly`, the grid config
 * dialog), else the column's `readonly` - what the `isReadonly` hook gets, it has the last word
 * (`gridInterface.__isCellReadonly`)
 */
export function readonlyOf(column: ColumnConfig | undefined): boolean {
    return column?.format?.readonly ?? column?.readonly ?? false;
}

/**
 * the language of the names when the text `format.locale` is not a language Intl takes
 */
export const FALLBACK_LOCALE = 'en-US';

/**
 * The texts the date formats are written with, from the grid's texts: the language of the names, and
 * how a week and a quarter are written - `{year}`, `{week}` (two digits) and `{quarter}` are filled in
 */
export interface FormatTexts {
    /** `format.locale`: a BCP 47 language tag, `'en-US'` */
    locale: string;
    /** `format.weekIso`: `'{year}-W{week}'` */
    weekIso: string;
    /** `format.weekUs`: `'{year}-W{week}'` */
    weekUs: string;
    /** `format.quarter`: `'{year} Q{quarter}'` */
    quarter: string;
}

/**
 * The texts of the date formats: a grid's (`GridConfig.texts`), else the page's (`setTexts()`), else
 * the English defaults
 */
export function formatTexts(overrides?: Texts): FormatTexts {
    return {
        locale: getText('format.locale', overrides),
        weekIso: getText('format.weekIso', overrides),
        weekUs: getText('format.weekUs', overrides),
        quarter: getText('format.quarter', overrides)
    };
}

/** a day in ms */
const DAY = 86_400_000;

/**
 * true when a column's format has a part - it changes how the column is shown: its cells, its label,
 * its header filter's placeholder. `{}` does not: the state leaves it out
 */
export function hasDisplayFormat(format: ColumnFormat | undefined): format is ColumnFormat {
    return FORMAT_KEYS.some((key) => format?.[key] !== undefined);
}

/** the checked value of a column's checkboxes when its format leaves it out */
export const CHECKED_VALUE = '1';

/** the unchecked value of a column's checkboxes when its format leaves it out */
export const UNCHECKED_VALUE = '0';

/**
 * The values of a column's checkboxes, with the defaults: `'1'` checked, `'0'` unchecked
 */
export function checkboxValues(checkbox: CheckboxFormat): { checked: string; unchecked: string } {
    return { checked: checkbox.checked ?? CHECKED_VALUE, unchecked: checkbox.unchecked ?? UNCHECKED_VALUE };
}

/**
 * true when a cell of a column with checkboxes is checked: its value is the checked value - a number
 * equal to it (`1` and `'1'`, `'1.0'`), else its text trimmed (`' 1 '` and `'1'`). A blank is not
 */
export function isCheckedValue(value: unknown, checkbox: CheckboxFormat): boolean {
    const checked = checkboxValues(checkbox).checked.trim();
    if (typeof value === 'number') {
        // Number('') is 0: the checked value is never '' (assertColumnFormat)
        return checked !== '' && value === Number(checked);
    }
    return value !== null && value !== undefined && String(value).trim() === checked;
}

/**
 * The value a click writes into a cell of a column with checkboxes: the checked or the unchecked value,
 * as the field's type has it - a number for a number field (`1`), else the text (`'1'`). An unchecked
 * value `''` is null, an empty cell
 * @param on the cell is checked now
 */
export function checkboxValueOf(on: boolean, checkbox: CheckboxFormat, type: FieldType): unknown {
    const values = checkboxValues(checkbox);
    const text = on ? values.checked : values.unchecked;
    if (text.trim() === '') {
        return null;
    }
    return type === 'number' ? Number(text) : text;
}

/**
 * true when a column's format shows its values in a date or number format - the formats of a value,
 * not of a row (the templates of a text column need the row)
 */
export function hasValueFormat(format: ColumnFormat | undefined): boolean {
    return format?.date !== undefined || format?.number !== undefined;
}

/** two digits, `5` -> `'05'` */
function pad(value: number): string {
    return String(value).padStart(2, '0');
}

/**
 * The local day of a date as a number of days, 0 is 1970-01-01: the same day number for every time of
 * the day and across summer time, so days can be counted by subtracting. setUTCFullYear, not Date.UTC:
 * Date.UTC reads the years 0 to 99 as 1900 to 1999
 */
function dayNumber(year: number, month: number, day: number): number {
    const utc = new Date(0);
    utc.setUTCFullYear(year, month, day);
    return utc.getTime() / DAY;
}

/** the local day of a Date, see dayNumber */
function dayOf(date: Date): number {
    return dayNumber(date.getFullYear(), date.getMonth(), date.getDate());
}

/** the day of the week of a day number: 0 Sunday ... 6 Saturday. Day 0, 1970-01-01, was a Thursday */
function weekdayOf(day: number): number {
    return (((day + 4) % 7) + 7) % 7;
}

/**
 * The ISO 8601 week of a date's local day, and the year it belongs to: weeks start on Monday, week 1
 * is the week with the year's first Thursday. The Thursday of a date's week decides the year: the
 * first days of January can be the last week of the year before (2027-01-01 is 2026-W53), the last
 * days of December week 1 of the next (2024-12-30 is 2025-W01)
 */
export function isoWeek(date: Date): { year: number; week: number } {
    const day = dayOf(date);
    // Monday 0 ... Sunday 6
    const fromMonday = (weekdayOf(day) + 6) % 7;
    const thursday = day - fromMonday + 3;
    const year = new Date(thursday * DAY).getUTCFullYear();
    return { year, week: Math.floor((thursday - dayNumber(year, 0, 1)) / 7) + 1 };
}

/**
 * The US week number of a date's local day, as Excel's `WEEKNUM(date)`: weeks start on Sunday, week 1
 * is the week of January 1, and a week belongs to the year of the date - the days of a week across
 * New Year are the last week of the one year and week 1 of the next. 1 to 53, 54 in a leap year that
 * starts on a Saturday (2000-12-31)
 */
export function usWeek(date: Date): number {
    const day = dayOf(date);
    const newYear = dayNumber(date.getFullYear(), 0, 1);
    return Math.floor((day - newYear + weekdayOf(newYear)) / 7) + 1;
}

/**
 * The whole days from today to the date's day, local days: 1 tomorrow, 0 today, -1 yesterday. The
 * time of day does not count, nor does summer time
 * @param today now, `new Date()` - a parameter for the tests
 */
export function daysUntil(date: Date, today: Date): number {
    return dayOf(date) - dayOf(today);
}

/**
 * the Intl formatters of the names, by locale and options: made once each
 */
const dateTimeFormats = new Map<string, Intl.DateTimeFormat>();

/**
 * The names of a date in a language, with Intl: `new Intl.DateTimeFormat(locale, options)`. A locale
 * Intl does not take (`'nb_NO'`, `''`) throws a RangeError there: English (FALLBACK_LOCALE) then
 */
function intlDate(date: Date, locale: string, options: Intl.DateTimeFormatOptions): string {
    const key = `${locale}|${JSON.stringify(options)}`;
    let format = dateTimeFormats.get(key);
    if (!format) {
        try {
            format = new Intl.DateTimeFormat(locale, options);
        } catch (error) {
            if (!(error instanceof RangeError)) {
                throw error;
            }
            format = new Intl.DateTimeFormat(FALLBACK_LOCALE, options);
        }
        dateTimeFormats.set(key, format);
    }
    return format.format(date);
}

/**
 * A date as text in a date format, see {@link DateFormat}: its local day and time.
 * @param texts the language of the names (`medium`, `long`, `full`, `weekday`), how a week and a
 * quarter are written: formatTexts()
 * @param today now, for `daysUntil`
 */
export function formatDateAs(date: Date, format: DateFormat, texts: FormatTexts, today: Date): string {
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const iso = `${year}-${month}-${day}`;
    const norwegian = `${day}.${month}.${year}`;
    const minutes = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    const seconds = `${minutes}:${pad(date.getSeconds())}`;

    switch (format) {
        case 'iso':
            return iso;
        case 'norwegian':
            return norwegian;
        case 'norwegianShort':
            return `${day}.${month}.${pad(((year % 100) + 100) % 100)}`;
        case 'us':
            return `${month}/${day}/${year}`;
        case 'uk':
            return `${day}/${month}/${year}`;
        case 'medium':
        case 'long':
        case 'full':
            return intlDate(date, texts.locale, { dateStyle: format });
        case 'weekday':
            return intlDate(date, texts.locale, { weekday: 'long' });
        case 'weekIso': {
            const week = isoWeek(date);
            return fillText(texts.weekIso, { year: week.year, week: pad(week.week) });
        }
        case 'weekUs':
            return fillText(texts.weekUs, { year, week: pad(usWeek(date)) });
        case 'month':
            return `${year}-${month}`;
        case 'quarter':
            return fillText(texts.quarter, { year, quarter: Math.floor(date.getMonth() / 3) + 1 });
        case 'year':
            return String(year);
        case 'daysUntil':
            return String(daysUntil(date, today));
        case 'isoTime':
            return `${iso} ${minutes}`;
        case 'isoSeconds':
            return `${iso} ${seconds}`;
        case 'norwegianTime':
            return `${norwegian} ${minutes}`;
        case 'norwegianSeconds':
            return `${norwegian} ${seconds}`;
        case 'time':
            return minutes;
        case 'timeSeconds':
            return seconds;
    }
}

/**
 * the Intl formatters of the digits, by the decimals (undefined: as the number has them)
 */
const digitFormats = new Map<number | undefined, Intl.NumberFormat>();

/**
 * A number as plain digits: `-1234567.89`. `en-US` gives ASCII digits, `.` and `-`, without a thousands
 * separator. Intl rounds the number as it is written (the shortest text that reads back as it), so
 * `1.005` is `1.01` - `toFixed(2)` gives `1.00`, of the binary value 1.00499... It writes no exponent
 * (`1e21` is 1 and 21 zeros), and no sign for a number rounded to 0 (`-0.001` is `0.00`)
 */
function digits(value: number, decimals: number | undefined): string {
    let format = digitFormats.get(decimals);
    if (!format) {
        format = new Intl.NumberFormat('en-US', {
            useGrouping: false,
            signDisplay: 'negative',
            minimumFractionDigits: decimals ?? 0,
            maximumFractionDigits: decimals ?? 20
        });
        digitFormats.set(decimals, format);
    }
    return format.format(value);
}

/**
 * A finite number as text in a number format, see {@link NumberFormat}: `1 234 567,89`
 */
export function formatNumberAs(value: number, format: NumberFormat): string {
    // times 100 can add a binary tail: 0.07 * 100 is 7.000000000000001. 15 digits drop it
    const scaled = format.percent ? Number((value * 100).toPrecision(15)) : value;
    const [whole, fraction] = digits(scaled, format.decimals).split('.');
    const sign = whole.startsWith('-') ? '-' : '';
    const integer = sign ? whole.slice(1) : whole;
    const grouped = format.thousands ? integer.replace(/\B(?=(\d{3})+$)/g, format.thousands) : integer;
    const text = `${sign}${grouped}${fraction === undefined ? '' : `${format.decimal ?? '.'}${fraction}`}`;
    return format.percent ? `${text} %` : text;
}

/**
 * The value of a date column as a Date, as the built-in date formatters read it: a Date, or a text or
 * a timestamp `new Date()` reads. null for a blank and for what is no valid date
 */
function asDate(value: unknown): Date | null {
    if (value === '' || !(value instanceof Date || typeof value === 'string' || typeof value === 'number')) {
        return null;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * A value as text in a display format. null when the format can not show it - a blank, a date column
 * value that is no date, a number column value that is no finite number: the field's formatter shows
 * those (a blank as `''`)
 */
export function formatValueAs(value: unknown, format: ColumnFormat, texts: FormatTexts): string | null {
    if (format.number) {
        return typeof value === 'number' && Number.isFinite(value) ? formatNumberAs(value, format.number) : null;
    }
    if (format.date) {
        const date = asDate(value);
        return date ? formatDateAs(date, format.date, texts, new Date()) : null;
    }
    return null;
}

/**
 * The formatter the cells of a column with a display format are shown with: the field's formatter, its
 * `format` replaced by the display format. A value the format can not show (a blank, no date) is shown
 * by the field's formatter. Editing keeps to the field's formatter: `formatForEdit` is the field's
 * (its `format` when it has none) - an edited cell shows the value as the field writes it, not
 * `2026-W47` - and so are `parse`, `parseFilter` and `placeholder`.
 * @param texts the language of the names, how a week and a quarter are written: formatTexts()
 */
export function displayFormatter(fieldFormatter: Formatter, format: ColumnFormat, texts: FormatTexts): Formatter {
    return {
        ...fieldFormatter,
        format: (value) => formatValueAs(value, format, texts) ?? fieldFormatter.format(value),
        // called on the formatter, so one that uses `this` works
        formatForEdit: (value) =>
            fieldFormatter.formatForEdit ? fieldFormatter.formatForEdit(value) : fieldFormatter.format(value)
    };
}

/**
 * the parts of a column's format, for the check of one from plain JavaScript or JSON
 */
const FORMAT_KEYS: readonly (keyof ColumnFormat)[] = [
    'date',
    'number',
    'text',
    'link',
    'label',
    'placeholderRow',
    'placeholderRowLabel',
    'numberOverride',
    'checkbox',
    'filterAsShown',
    'multiline',
    'readonly',
    'rules',
    'bar',
    'scale',
    'icons'
];

/**
 * the keys a column's checkboxes have
 */
const CHECKBOX_FORMAT_KEYS: readonly (keyof CheckboxFormat)[] = ['checked', 'unchecked'];

/**
 * the values of `numberOverride`
 */
const NUMBER_OVERRIDES: readonly NonNullable<ColumnFormat['numberOverride']>[] = ['BLANK_TO_ZERO', 'ZERO_TO_BLANK', 'NONE'];

/**
 * the keys a link has
 */
const LINK_FORMAT_KEYS: readonly (keyof LinkFormat)[] = ['url', 'newTab'];

/** the types of field a template (`ColumnFormat.text`) is for: the ones with a text to put `{value}` in */
const TEMPLATE_TYPES: readonly FieldType[] = ['text', 'number', 'date', 'datetime'];

/** the types of field a link (`ColumnFormat.link`) is for: a text, an order number */
const LINK_TYPES: readonly FieldType[] = ['text', 'number'];

/**
 * the keys a number format has
 */
const NUMBER_FORMAT_KEYS: readonly (keyof NumberFormat)[] = ['decimals', 'thousands', 'decimal', 'percent'];

/** a plain object, not null or an array */
const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Throws when a column's format does not fit its field: TypeScript catches neither a typo nor a part of
 * another type in a config from plain JavaScript or JSON - the cells would show the field's formatter
 * without a word. undefined is no format
 * - an object with the parts `date` and `number`, nothing else
 * - `date` for a `date` field: one of DATE_FORMATS; a `datetime` field DATETIME_FORMATS too
 * - `number` for a `number` field: a {@link NumberFormat}, its parts of the values they take, not the
 *   same character for both separators
 * - `text` for a `text`, `number`, `date` or `datetime` field, `link` for a `text` or `number` field: a
 *   template that is text, not `''`, without a placeholder of
 *   the grid's own (`{__...}`); a {@link LinkFormat} whose `url` starts with `https://`, `http://`,
 *   `mailto:` or `tel:` or is one placeholder (cellTemplate.ts, urlTemplateProblem)
 * - `label` and `placeholderRow` text, not `''`; `placeholderRowLabel` true or false, not with `placeholderRow`;
 *   no placeholder for a `boolean` field (its header filter is a checkbox)
 * - `numberOverride` for a `number` field: `'BLANK_TO_ZERO'`, `'ZERO_TO_BLANK'` or `'NONE'`
 * - `checkbox` for a `text` or `number` field: a {@link CheckboxFormat} (checkboxProblem), not with
 *   `text`, `link`, `number` or `numberOverride`
 * - `multiline` true or false, for a `text` field, not with `checkbox`; `readonly` true or false, any
 * - `rules` for any column: a list of {@link ColorRule}s, see assertColorRules
 * - `bar`, `scale` and `icons` for a `number` field, not with `checkbox`: see assertValueFills
 * - a lookup column (`editor`: its cells show a label) takes `label`, the placeholder, `readonly` and `rules` only
 * @param name how the message names it: `GridConfig: columns.born.format`, `setState: formats.born`
 * @param fieldOf the fields a colour rule's condition or formula can name (see assertColorRules). Left
 * out: none but the column's own
 * @throws a `TypeError` naming it, what it has and what it takes
 */
export function assertColumnFormat(
    format: unknown,
    field: string,
    type: FieldType,
    lookup: boolean,
    name: string,
    fieldOf?: RuleFieldOf
): void {
    if (format === undefined) {
        return;
    }
    const got = JSON.stringify(format);
    if (!isObject(format)) {
        throw new TypeError(
            `${name} is ${got}, it is an object: { date: 'norwegian' } for a date field, { number: { decimals: 2 } } for a number field, { text: '{name} ({id})' } or { link: { url: 'https://example.com/{id}' } } for a text field, { label: 'Name' } for any`
        );
    }
    for (const key of Object.keys(format)) {
        if (!FORMAT_KEYS.some((known) => known === key)) {
            throw new TypeError(`${name} has '${key}', a format has ${FORMAT_KEYS.join(', ')}`);
        }
    }
    const { date, number, text, link, numberOverride, checkbox, multiline, readonly } = format;
    if (lookup && [date, number, text, link, numberOverride, checkbox, multiline].some((part) => part !== undefined)) {
        throw new TypeError(
            `${name} is ${got}: a lookup column (editor) shows the label of its value, it has no format - a label, a placeholder, readonly and rules only`
        );
    }
    if (readonly !== undefined && typeof readonly !== 'boolean') {
        throw new TypeError(`${name}.readonly is ${JSON.stringify(readonly)}, it is true or false`);
    }
    if (multiline !== undefined) {
        if (typeof multiline !== 'boolean') {
            throw new TypeError(`${name}.multiline is ${JSON.stringify(multiline)}, it is true or false`);
        }
        if (type !== 'text') {
            throw new TypeError(`${name}.multiline is for a text field, '${field}' is ${type}`);
        }
        if (checkbox !== undefined) {
            throw new TypeError(`${name} has checkbox and multiline: a checkbox shows no text, it is the one or the other`);
        }
    }
    assertLabelParts(format, field, type, lookup, name);
    if (format.rules !== undefined) {
        assertColorRules(format.rules, type, lookup, `${name}.rules`, fieldOf);
    }
    assertValueFills(format, field, type, lookup, name);
    if (numberOverride !== undefined) {
        if (type !== 'number') {
            throw new TypeError(`${name}.numberOverride is for a number field, '${field}' is ${type}`);
        }
        if (!NUMBER_OVERRIDES.some((known) => known === numberOverride)) {
            throw new TypeError(
                `${name}.numberOverride is ${JSON.stringify(numberOverride)}, it is ${NUMBER_OVERRIDES.map((each) => `'${each}'`).join(', ')}`
            );
        }
    }
    if (checkbox !== undefined) {
        assertCheckboxFormat(checkbox, field, type, `${name}.checkbox`);
        // a checkbox shows no text: no template, link or number format, no blank / 0
        const other = (['text', 'link', 'number', 'numberOverride'] as const).find((key) => format[key] !== undefined);
        if (other) {
            throw new TypeError(`${name} has checkbox and ${other}: a checkbox shows no text, it is the one or the other`);
        }
    }
    if (text !== undefined && !TEMPLATE_TYPES.includes(type)) {
        throw new TypeError(`${name}.text is for a text, number, date or datetime field, '${field}' is ${type}`);
    }
    if (link !== undefined && !LINK_TYPES.includes(type)) {
        throw new TypeError(`${name}.link is for a text or number field, '${field}' is ${type}`);
    }
    if (text !== undefined) {
        assertTextTemplate(text, `${name}.text`);
    }
    if (link !== undefined) {
        assertLinkFormat(link, `${name}.link`);
    }
    const list = (formats: readonly string[]) => formats.map((id) => `'${id}'`).join(', ');
    if (date !== undefined) {
        if (type !== 'date' && type !== 'datetime') {
            throw new TypeError(`${name}.date is for a date or datetime field, '${field}' is ${type}`);
        }
        const isTime = DATETIME_FORMATS.some((id) => id === date);
        if (isTime && type === 'date') {
            throw new TypeError(
                `${name}.date is ${JSON.stringify(date)}, it shows the time of day: for a datetime field, '${field}' is date. A date field takes ${list(DATE_FORMATS)}`
            );
        }
        if (!isTime && !DATE_FORMATS.some((id) => id === date)) {
            const formats = type === 'date' ? DATE_FORMATS : [...DATE_FORMATS, ...DATETIME_FORMATS];
            throw new TypeError(`${name}.date is ${JSON.stringify(date)}, a ${type} field takes ${list(formats)}`);
        }
    }
    if (number !== undefined) {
        if (type !== 'number') {
            throw new TypeError(`${name}.number is for a number field, '${field}' is ${type}`);
        }
        assertNumberFormat(number, `${name}.number`);
    }
    assertFilterAsShown(format.filterAsShown, field, type, lookup, name);
}

/**
 * see assertColumnFormat: `filterAsShown`, true or false - for a date, datetime or number field, not a
 * lookup column (its header filter finds the labels)
 * @throws a `TypeError` naming the part and what it takes
 */
function assertFilterAsShown(filterAsShown: unknown, field: string, type: FieldType, lookup: boolean, name: string): void {
    if (filterAsShown === undefined) {
        return;
    }
    if (typeof filterAsShown !== 'boolean') {
        throw new TypeError(`${name}.filterAsShown is ${JSON.stringify(filterAsShown)}, it is true or false`);
    }
    if (lookup || (type !== 'date' && type !== 'datetime' && type !== 'number')) {
        throw new TypeError(
            `${name}.filterAsShown is for a date, datetime or number field with a format, '${field}' is ${lookup ? 'a lookup column' : type}`
        );
    }
}

/**
 * see assertColumnFormat
 * @throws a `TypeError` naming the part and what it takes
 */
function assertNumberFormat(format: unknown, name: string): void {
    if (!isObject(format)) {
        throw new TypeError(
            `${name} is ${JSON.stringify(format)}, it is an object: { decimals?: 0-4, thousands?: ' ' | ',' | '.' | "'", decimal?: '.' | ',', percent?: boolean }`
        );
    }
    for (const key of Object.keys(format)) {
        if (!NUMBER_FORMAT_KEYS.some((known) => known === key)) {
            throw new TypeError(`${name} has '${key}', a number format has ${NUMBER_FORMAT_KEYS.join(', ')}`);
        }
    }
    const { decimals, thousands, decimal, percent } = format;
    if (decimals !== undefined && ![0, 1, 2, 3, 4].includes(decimals as number)) {
        throw new TypeError(
            `${name}.decimals is ${JSON.stringify(decimals)}, it is 0, 1, 2, 3 or 4 - left out, the decimals the number has`
        );
    }
    if (thousands !== undefined && ![' ', ',', '.', "'"].includes(thousands as string)) {
        throw new TypeError(`${name}.thousands is ${JSON.stringify(thousands)}, it is ' ', ',', '.' or "'" - left out, none`);
    }
    if (decimal !== undefined && decimal !== '.' && decimal !== ',') {
        throw new TypeError(`${name}.decimal is ${JSON.stringify(decimal)}, it is '.' or ','`);
    }
    if (percent !== undefined && typeof percent !== 'boolean') {
        throw new TypeError(`${name}.percent is ${JSON.stringify(percent)}, it is true or false`);
    }
    if (thousands !== undefined && thousands === (decimal ?? '.')) {
        const leftOut = decimal === undefined ? " (left out, the decimal mark is '.')" : '';
        throw new TypeError(
            `${name} has '${String(thousands)}' as the thousands separator and the decimal mark${leftOut}: give them different characters`
        );
    }
}

/**
 * see assertColumnFormat: the label of a column, the placeholder of its header filter
 * @throws a `TypeError` naming the part and what it takes
 */
function assertLabelParts(format: Record<string, unknown>, field: string, type: FieldType, lookup: boolean, name: string): void {
    const { label, placeholderRow: placeholder, placeholderRowLabel: placeholderLabel } = format;
    const isText = (value: unknown) => typeof value === 'string' && value.trim() !== '';
    if (label !== undefined && !isText(label)) {
        throw new TypeError(
            `${name}.label is ${JSON.stringify(label)}, it is the column's label: text, not '' - left out, the column's own`
        );
    }
    if ((placeholder !== undefined || placeholderLabel !== undefined) && type === 'boolean' && !lookup) {
        throw new TypeError(
            `${name}.${placeholder !== undefined ? 'placeholderRow' : 'placeholderRowLabel'} is for a cell that is typed in, '${field}' is boolean: its cells are checkboxes`
        );
    }
    if (placeholder !== undefined && !isText(placeholder)) {
        throw new TypeError(
            `${name}.placeholderRow is ${JSON.stringify(placeholder)}, it is the placeholder of the empty cells: text, not '' - left out, the column's own`
        );
    }
    if (placeholderLabel !== undefined && typeof placeholderLabel !== 'boolean') {
        throw new TypeError(`${name}.placeholderRowLabel is ${JSON.stringify(placeholderLabel)}, it is true or false`);
    }
    if (placeholder !== undefined && placeholderLabel === true) {
        throw new TypeError(
            `${name} has placeholderRow and placeholderRowLabel: true - the placeholder is the text or the label, not both`
        );
    }
}

/**
 * true for text that is a number: `'1'`, `'-1'`, `'0.5'` - not `''`, not `'one'`
 */
function isNumberText(text: string): boolean {
    return text.trim() !== '' && Number.isFinite(Number(text));
}

/**
 * What is wrong with the values of a column's checkboxes (with the defaults), null when nothing - for
 * assertColumnFormat and the grid config dialog:
 * - `'checkedEmpty'`: the checked value is `''` - a blank cell would be checked
 * - `'checkedNumber'`, `'uncheckedNumber'`: a value of a number field is no number (`''` empties the
 *   cell, an unchecked value can be it)
 * - `'same'`: the two values are the same - a click could not uncheck a cell
 */
export function checkboxProblem(
    checkbox: CheckboxFormat,
    type: FieldType
): 'checkedEmpty' | 'checkedNumber' | 'uncheckedNumber' | 'same' | null {
    const { checked, unchecked } = checkboxValues(checkbox);
    if (checked.trim() === '') {
        return 'checkedEmpty';
    }
    if (type === 'number' && !isNumberText(checked)) {
        return 'checkedNumber';
    }
    if (type === 'number' && unchecked.trim() !== '' && !isNumberText(unchecked)) {
        return 'uncheckedNumber';
    }
    const same = type === 'number' ? Number(checked) === Number(unchecked) : checked.trim() === unchecked.trim();
    return same && unchecked.trim() !== '' ? 'same' : null;
}

/**
 * see assertColumnFormat: the checkboxes of a text or number column
 * @throws a `TypeError` naming the part and what it takes
 */
function assertCheckboxFormat(checkbox: unknown, field: string, type: FieldType, name: string): void {
    if (type !== 'text' && type !== 'number') {
        throw new TypeError(`${name} is for a text or number field, '${field}' is ${type}`);
    }
    if (!isObject(checkbox)) {
        throw new TypeError(`${name} is ${JSON.stringify(checkbox)}, it is an object: { checked?: '1', unchecked?: '0' }`);
    }
    for (const key of Object.keys(checkbox)) {
        if (!CHECKBOX_FORMAT_KEYS.some((known) => known === key)) {
            throw new TypeError(`${name} has '${key}', a checkbox has ${CHECKBOX_FORMAT_KEYS.join(', ')}`);
        }
    }
    for (const key of CHECKBOX_FORMAT_KEYS) {
        if (checkbox[key] !== undefined && typeof checkbox[key] !== 'string') {
            throw new TypeError(`${name}.${key} is ${JSON.stringify(checkbox[key])}, it is text: '1', '0', 'Y'`);
        }
    }
    // its parts are text or left out now
    const values = checkboxValues(checkbox as CheckboxFormat);
    switch (checkboxProblem(checkbox as CheckboxFormat, type)) {
        case 'checkedEmpty':
            throw new TypeError(`${name}.checked is "", it is the value of a checked cell - left out, '1'`);
        case 'checkedNumber':
            throw new TypeError(
                `${name}.checked is ${JSON.stringify(values.checked)}: '${field}' is a number field, it takes a number - '1'`
            );
        case 'uncheckedNumber':
            throw new TypeError(
                `${name}.unchecked is ${JSON.stringify(values.unchecked)}: '${field}' is a number field, it takes a number - '0' - or '' for an empty cell`
            );
        case 'same':
            throw new TypeError(
                `${name} has ${JSON.stringify(values.checked)} as the checked and the unchecked value: a click could not uncheck a cell`
            );
    }
}

/**
 * see assertColumnFormat: a template of the text a cell shows
 * @throws a `TypeError` naming the part and what it takes
 */
function assertTextTemplate(template: unknown, name: string): void {
    if (typeof template !== 'string' || template === '') {
        throw new TypeError(
            `${name} is ${JSON.stringify(template)}, it is a template - text with {field} placeholders, '{firstname} {lastname}' - left out, the cell's own text`
        );
    }
    const problem = templateProblem(template);
    if (problem) {
        throw new TypeError(`${name} has {${problem.field}}: a name that starts with __ is the grid's own, not a field`);
    }
}

/**
 * see assertColumnFormat: a link, its address a template of an allowed scheme
 * @throws a `TypeError` naming the part and what it takes
 */
function assertLinkFormat(link: unknown, name: string): void {
    if (!isObject(link)) {
        throw new TypeError(
            `${name} is ${JSON.stringify(link)}, it is an object: { url: 'https://example.com/customer/{id}', newTab?: boolean }`
        );
    }
    for (const key of Object.keys(link)) {
        if (!LINK_FORMAT_KEYS.some((known) => known === key)) {
            throw new TypeError(`${name} has '${key}', a link has ${LINK_FORMAT_KEYS.join(', ')}`);
        }
    }
    const { url, newTab } = link;
    if (typeof url !== 'string') {
        throw new TypeError(`${name}.url is ${JSON.stringify(url)}, it is the address: 'https://example.com/customer/{id}'`);
    }
    const problem = urlTemplateProblem(url);
    if (problem?.problem === 'empty') {
        throw new TypeError(`${name}.url is ${JSON.stringify(url)}, it is the address: 'https://example.com/customer/{id}'`);
    }
    if (problem?.problem === 'internal') {
        throw new TypeError(`${name}.url has {${problem.field}}: a name that starts with __ is the grid's own, not a field`);
    }
    if (problem?.problem === 'protocol') {
        throw new TypeError(
            `${name}.url is ${JSON.stringify(url)}: a link to ${problem.protocol} is not allowed, only ${LINK_PROTOCOLS.join(', ')}`
        );
    }
    if (problem?.problem === 'start') {
        throw new TypeError(
            `${name}.url is ${JSON.stringify(url)}: it starts with https://, http://, mailto: or tel:, or is one {field} that holds the whole address`
        );
    }
    if (newTab !== undefined && typeof newTab !== 'boolean') {
        throw new TypeError(`${name}.newTab is ${JSON.stringify(newTab)}, it is true or false`);
    }
}

/**
 * The decimal mark a formatter shows: `','` when it writes 1.5 with a comma (`NumberFormatterComma`),
 * else `'.'`. For the header menu: a number format picked there starts with the field's own mark
 */
export function decimalMarkOf(formatter: Formatter): '.' | ',' {
    return String(formatter.format(1.5)).includes(',') ? ',' : '.';
}

/**
 * A number format with the parts that are the default left out - `decimal: '.'`, `percent: false` and
 * undefined - so the state holds what was picked: `{ decimals: 2 }`
 */
export function compactNumberFormat(format: NumberFormat): NumberFormat {
    const compact: NumberFormat = {};
    if (format.decimals !== undefined) {
        compact.decimals = format.decimals;
    }
    if (format.thousands !== undefined) {
        compact.thousands = format.thousands;
    }
    if (format.decimal === ',') {
        compact.decimal = ',';
    }
    if (format.percent) {
        compact.percent = true;
    }
    return compact;
}
