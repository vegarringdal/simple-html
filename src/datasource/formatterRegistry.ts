import { BooleanFormatter } from './booleanFormatter';
import { DateFormatterDDMMYYYY } from './DateFormatterDDMMYYYY';
import { DateFormatterDDMMYYYYTHHMMSS } from './DateFormatterDDMMYYYYTHHMMSS';
import { DateFormatterYYYYMMDD } from './DateFormatterYYYYMMDD';
import { DateFormatterYYYYMMDDTHHMMSS } from './DateFormatterYYYYMMDDTHHMMSS';
import type { FieldType } from './field';
import type { Formatter } from './formatter';
import { NumberFormatterComma } from './numberFormatterComma';
import { NumberFormatterDot } from './numberFormatterDot';
import { TextFormatter } from './textFormatter';

/**
 * The formatters by id, the built-in ones registered from the start. One registry for the page:
 * every datasource looks its ids up here.
 */
const registry = new Map<string, Formatter>([
    ['text', TextFormatter],
    ['boolean', BooleanFormatter],
    ['numberDot', NumberFormatterDot],
    ['numberComma', NumberFormatterComma],
    ['dateYYYYMMDD', DateFormatterYYYYMMDD],
    ['dateDDMMYYYY', DateFormatterDDMMYYYY],
    ['datetimeYYYYMMDD', DateFormatterYYYYMMDDTHHMMSS],
    ['datetimeDDMMYYYY', DateFormatterDDMMYYYYTHHMMSS]
]);

/**
 * @internal
 * The id of the default formatter of each type, for the types the `formatters` option leaves out.
 */
export const DEFAULT_FORMATTER_IDS: Readonly<Record<FieldType, string>> = {
    text: 'text',
    number: 'numberDot',
    boolean: 'boolean',
    date: 'dateYYYYMMDD',
    datetime: 'datetimeYYYYMMDD'
};

/**
 * Registers a formatter under an id, for the datasource options to name it: a field's `formatter`
 * and the default per type in `formatters` are ids, so the options are plain JSON and can be stored,
 * e.g. in a backend. The formatter itself is code: register it when the page loads, before the
 * datasource that names it is made.
 *
 * The built-in formatters are registered from the start:
 *
 * | id | formatter | shows |
 * | --- | --- | --- |
 * | `'text'` | {@link TextFormatter} | the text, the default for `text` |
 * | `'boolean'` | {@link BooleanFormatter} | `true` / `false`, the default for `boolean` |
 * | `'numberDot'` | {@link NumberFormatterDot} | `1234.5`, the default for `number` |
 * | `'numberComma'` | {@link NumberFormatterComma} | `1234,5` |
 * | `'dateYYYYMMDD'` | {@link DateFormatterYYYYMMDD} | `2026-11-20`, the default for `date` |
 * | `'dateDDMMYYYY'` | {@link DateFormatterDDMMYYYY} | `20.11.2026` |
 * | `'datetimeYYYYMMDD'` | {@link DateFormatterYYYYMMDDTHHMMSS} | `2026-11-20T13:45:12`, the default for `datetime` |
 * | `'datetimeDDMMYYYY'` | {@link DateFormatterDDMMYYYYTHHMMSS} | `20.11.2026T13:45:12` |
 *
 * - **Registering an id again replaces the formatter** - a built-in one too, and replacing a built-in
 *   default (`'numberDot'` ...) changes every field of that type without a formatter of its own. Pick
 *   an id of your own unless that is what you want.
 * - **A datasource looks its ids up when it is made** and keeps the formatters it found: replacing a
 *   formatter later changes the datasources made after, not the ones made before.
 * - There is one registry for the page, shared by every datasource.
 *
 * @param id the name the options use, e.g. `'money'`. Any text but `''`
 * @param formatter the formatter, see {@link Formatter}
 * @throws a `TypeError` when the id is not a text, or the formatter has no `format` or `parse`
 *
 * @sample custom-formatter
 * @example
 * ```ts
 * import { Datasource, type Formatter, NumberFormatterDot, registerFormatter } from '@simple-html/grid';
 *
 * // two decimals and a space between the thousands: 12345.6 -> '12 345.60'; edited as the plain number
 * const money: Formatter = {
 *     ...NumberFormatterDot,
 *     format: (value) => (typeof value === 'number' ? value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : ''),
 *     formatForEdit: (value) => NumberFormatterDot.format(value),
 *     parse: (text) => NumberFormatterDot.parse(text.replaceAll(' ', ''))
 * };
 * registerFormatter('money', money);
 *
 * // the options name it: plain JSON, they can come from a backend
 * const datasource = new Datasource({
 *     fields: { price: { type: 'number', formatter: 'money' } },
 *     formatters: { date: 'dateDDMMYYYY' } // a built-in, the default for every date field
 * });
 * datasource.getFormatter('price').format(12345.6); // '12 345.60'
 * ```
 */
export function registerFormatter(id: string, formatter: Formatter): void {
    // plain js can pass anything: say so now, not when a cell is rendered
    if (typeof id !== 'string' || id === '') {
        throw new TypeError(`registerFormatter: the id must be a text, got ${JSON.stringify(id)}`);
    }
    if (typeof formatter?.format !== 'function' || typeof formatter.parse !== 'function') {
        throw new TypeError(`registerFormatter: the formatter of '${id}' must have a format() and a parse() method`);
    }
    registry.set(id, formatter);
}

/**
 * @internal
 * The formatter registered under an id, for the datasource's options.
 * @param id the id from the options
 * @param where what the id was given for, for the message: `field 'price'`, `formatters.date`
 * @throws when the id is not registered, or is not a text - a formatter object, as the options took
 * before v6 had the registry
 */
export function getRegisteredFormatter(id: unknown, where: string): Formatter {
    if (typeof id !== 'string') {
        throw new TypeError(
            `Datasource: ${where} takes the id (a text) of a registered formatter, got ${typeof id}: registerFormatter('myId', formatter), then formatter: 'myId'`
        );
    }
    const formatter = registry.get(id);
    if (!formatter) {
        const known = Array.from(registry.keys(), (key) => `'${key}'`).join(', ');
        throw new Error(
            `Datasource: ${where} has the unknown formatter '${id}', register it with registerFormatter() before the datasource is made. Registered: ${known}`
        );
    }
    return formatter;
}
