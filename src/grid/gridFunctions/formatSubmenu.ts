import type { TextId } from '../../texts';
import {
    type ColumnFormat,
    compactNumberFormat,
    DATE_FORMATS,
    DATETIME_FORMATS,
    type DateFormat,
    decimalMarkOf,
    formatDateAs,
    formatNumberAs,
    formatTexts,
    hasDisplayFormat,
    hasValueFormat,
    type NumberFormat
} from '../columnFormat';
import type { Grid } from '../grid';
import type { MenuEntry, MenuItem, MenuSubmenu } from '../gridMenus';
import { gridText } from './gridText';

/**
 * Format › in the header menu: how the column's cells show the value, picked by the user - the display
 * formats of columnFormat.ts. A date or datetime column lists the date formats, a number column the
 * number formats; text and boolean columns, and a lookup column (its cells show a label), have none.
 * The format in use has a ✓, "Default" when the column has none: the field's formatter. A pick changes
 * the date or number part of the column's format only (`ColumnFormat.date`, `.number`): its label, its
 * blank / 0 from the column settings stay. A number column shown as checkboxes has no Format ›.
 *
 * A pick changes the grid's state (GridState.formats), so getState() keeps it and resetState() goes back
 * to the config's (ColumnConfig.format). Every hint is an example: the format applied to today (a date
 * column) or to 1234567.891 (a number column, 0.256 with Percent) - made when the menu opens, not texts.
 *
 * The column settings dialog (columnSettings.ts) opens the same entries from its format picker, with a
 * FormatTarget of its draft: one list of the formats, in one order.
 */

/** the number the hints of a number column show */
export const NUMBER_SAMPLE = 1234567.891;

/** the number the hints show while Percent is on: 25.6 % */
export const PERCENT_SAMPLE = 0.256;

/** the formats of a part of a date, after the dates written out */
const DATE_PARTS: readonly DateFormat[] = ['weekday', 'weekIso', 'weekUs', 'month', 'quarter', 'year', 'daysUntil'];

/** the separators of the presets of a number column: Norwegian, English, Swiss, plain */
const PRESETS = [
    { id: 'norwegian', thousands: ' ', decimal: ',' },
    { id: 'english', thousands: ',', decimal: '.' },
    { id: 'swiss', thousands: "'", decimal: '.' },
    { id: 'plain', thousands: undefined, decimal: '.' }
] as const;

/** the thousands separators, `undefined` none */
const THOUSANDS = [
    { id: 'none', char: undefined },
    { id: 'space', char: ' ' },
    { id: 'comma', char: ',' },
    { id: 'dot', char: '.' },
    { id: 'apostrophe', char: "'" }
] as const;

/** the decimal marks */
const DECIMAL_MARKS = [
    { id: 'dot', char: '.' },
    { id: 'comma', char: ',' }
] as const;

/** the decimals, `undefined` as the number has them */
const DECIMALS = [undefined, 0, 1, 2, 3, 4] as const;

/**
 * Where the entries of Format › read the format in use and write the one picked: the grid's state for
 * the header menu, the draft of the column settings dialog (columnSettings.ts) for its format picker
 */
export interface FormatTarget {
    /** the column's format now: read when the menu opens and when an entry is clicked */
    current: () => ColumnFormat | undefined;
    /** sets the column's format, undefined: none (Default) */
    set: (format: ColumnFormat | undefined) => void;
}

/**
 * The format in the grid's state, for the header menu: GridState.formats
 */
function stateTarget(ctx: Grid, attribute: string): FormatTarget {
    const gridInterface = ctx.gridInterface;
    return {
        current: () => gridInterface.__getGridConfig().columns[attribute]?.format,
        set: (format) => {
            const formats = gridInterface.getState().formats;
            if (format) {
                formats[attribute] = format;
            } else {
                delete formats[attribute];
            }
            gridInterface.setState({ formats });
        }
    };
}

/**
 * The Format submenu of a column. Its entries are always there, as every default entry: the ones that
 * are not for the column's type are hidden by `visible`, and so is the submenu when none is
 * @param target where the format is read and written: the grid's state (the header menu) when left
 * out, the column settings dialog's draft for its picker
 */
export function formatSubmenu(ctx: Grid, attribute: string, target: FormatTarget = stateTarget(ctx, attribute)): MenuSubmenu {
    const gridInterface = ctx.gridInterface;
    const datasource = gridInterface.getDatasource();
    const type = datasource.getField(attribute).type;
    const lookup = gridInterface.__getLookupColumn(attribute) !== undefined;
    const isDate = !lookup && (type === 'date' || type === 'datetime');
    const isDatetime = !lookup && type === 'datetime';
    const isNumber = !lookup && type === 'number';
    const fieldFormatter = datasource.getFormatter(attribute);
    const formatTextsNow = formatTexts(gridInterface.__getGridConfig().texts);
    const text = (id: TextId) => gridText(ctx, id);
    // the date of the examples: now, when the menu opens
    const now = new Date();

    /** the column's format now, read when the menu opens and when an entry is clicked */
    const current = target.current;
    /** the number format in use, undefined with Default */
    const numberNow = (): NumberFormat | undefined => current()?.number;
    /**
     * what a number entry changes: the format in use - with Default, the field formatter's decimal mark,
     * so a first pick keeps it (NumberFormatterComma shows 1,5)
     */
    const numberBase = (): NumberFormat => numberNow() ?? { decimal: decimalMarkOf(fieldFormatter) };
    const changed = (change: NumberFormat): NumberFormat => compactNumberFormat({ ...numberBase(), ...change });
    /** the example of a number format: 1234567.891, 0.256 with Percent */
    const numberExample = (format: NumberFormat) => formatNumberAs(format.percent ? PERCENT_SAMPLE : NUMBER_SAMPLE, format);

    /**
     * sets the column's date or number format, undefined: none (Default). The rest of the column's format
     * - its label, its blank / 0 ... from the column settings - stays as it is
     */
    const set = (part: Pick<ColumnFormat, 'date' | 'number'> | undefined) => {
        const next: ColumnFormat = { ...current(), ...part };
        if (!part) {
            delete next.date;
            delete next.number;
        }
        target.set(hasDisplayFormat(next) ? next : undefined);
    };
    const pickNumber = (change: NumberFormat) => set({ number: changed(change) });

    const dateItem = (format: DateFormat, visible: boolean): MenuItem => ({
        id: `header.format.date.${format}`,
        label: text(`header.format.date.${format}`),
        // the days until today is always 0: no example
        hint: format === 'daysUntil' ? undefined : formatDateAs(now, format, formatTextsNow, now),
        visible: () => visible,
        selected: () => current()?.date === format,
        action: () => set({ date: format })
    });

    const numberItem = (
        id: TextId,
        change: NumberFormat,
        selected: (format: NumberFormat) => boolean,
        disabled?: () => boolean
    ): MenuItem => ({
        id,
        label: text(id),
        // a number column's formatter only: a date formatter has no decimal mark
        hint: isNumber ? numberExample(changed(change)) : undefined,
        visible: () => isNumber,
        // with Default nothing but Default has a ✓
        selected: () => {
            const format = numberNow();
            return format !== undefined && selected(format);
        },
        disabled,
        action: () => pickNumber(change)
    });

    const entries: MenuEntry[] = [
        {
            id: 'header.format.default',
            label: text('header.format.default'),
            hint: isNumber ? fieldFormatter.format(NUMBER_SAMPLE) : fieldFormatter.format(now),
            selected: () => !hasValueFormat(current()),
            action: () => set(undefined)
        },
        { type: 'separator', id: 'header.format.defaultSeparator' },
        // a date written out, then with the time (datetime), then a part of it
        ...DATE_FORMATS.filter((format) => !DATE_PARTS.includes(format)).map((format) => dateItem(format, isDate)),
        { type: 'separator', id: 'header.format.timeSeparator', visible: () => isDatetime },
        ...DATETIME_FORMATS.map((format) => dateItem(format, isDatetime)),
        { type: 'separator', id: 'header.format.partSeparator', visible: () => isDate },
        ...DATE_PARTS.map((format) => dateItem(format, isDate)),
        // a number: the presets of the separators, then each part
        ...PRESETS.map((preset) =>
            numberItem(
                `header.format.number.${preset.id}`,
                { thousands: preset.thousands, decimal: preset.decimal },
                (format) => format.thousands === preset.thousands && (format.decimal ?? '.') === preset.decimal
            )
        ),
        { type: 'separator', id: 'header.format.settingsSeparator', visible: () => isNumber },
        {
            type: 'submenu',
            id: 'header.format.decimals',
            label: text('header.format.decimals'),
            entries: DECIMALS.map((decimals) =>
                numberItem(`header.format.decimals.${decimals ?? 'asIs'}`, { decimals }, (format) => format.decimals === decimals)
            )
        },
        {
            type: 'submenu',
            id: 'header.format.thousands',
            label: text('header.format.thousands'),
            // not the character of the decimal mark: pick another decimal mark first
            entries: THOUSANDS.map((thousands) =>
                numberItem(
                    `header.format.thousands.${thousands.id}`,
                    { thousands: thousands.char },
                    (format) => format.thousands === thousands.char,
                    () => thousands.char === (numberBase().decimal ?? '.')
                )
            )
        },
        {
            type: 'submenu',
            id: 'header.format.decimalMark',
            label: text('header.format.decimalMark'),
            // not the character of the thousands separator
            entries: DECIMAL_MARKS.map((mark) =>
                numberItem(
                    `header.format.decimalMark.${mark.id}`,
                    { decimal: mark.char },
                    (format) => (format.decimal ?? '.') === mark.char,
                    () => mark.char === numberBase().thousands
                )
            )
        },
        {
            id: 'header.format.percent',
            label: text('header.format.percent'),
            hint: isNumber ? numberExample(changed({ percent: true })) : undefined,
            visible: () => isNumber,
            selected: () => numberNow()?.percent === true,
            action: () => pickNumber({ percent: numberNow()?.percent !== true })
        }
    ];

    return {
        type: 'submenu',
        id: 'header.format',
        label: text('header.format'),
        // a number column shown as checkboxes (ColumnFormat.checkbox) shows no number
        visible: () => isDate || (isNumber && !current()?.checkbox),
        entries
    };
}
