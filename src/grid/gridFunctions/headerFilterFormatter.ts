import type { Formatter } from '../../datasource/formatter';
import { type ColumnFormat, type DateFormat, type FormatTexts, formatTexts } from '../columnFormat';
import { asShownFormatter, filtersAsShown, periodOf } from '../filterAsShown';
import type { Grid } from '../grid';
import type { DateRange } from './contextmenuDate';
import { filterCallback } from './filterCallback';
import { gridText } from './gridText';
import { rebuildHeaderColumns } from './rebuildHeaderColumns';

/**
 * Filter as shown in the grid (filterAsShown.ts has the rules): which header filters take their text as
 * the cells show it, the formatter they read and write it with, and running them again when the format
 * of their column changes.
 */

/** the texts the dates of the grid are written with: its `texts`, else the page's */
function textsOf(ctx: Grid): FormatTexts {
    return formatTexts(ctx.gridInterface.__getGridConfig().texts);
}

/**
 * The format of a column whose header filter takes the text as the cells show it (filtersAsShown), else
 * null: a format with no date or number part, `filterAsShown: false`, a format that is no period of time
 * (`weekday`, `time`) - and a lookup column, its header filter finds the labels
 * @param format the column's format - `ColumnConfig.format`, the grid config dialog's draft for its own
 * preview
 */
export function asShownFormat(ctx: Grid, field: string, format: ColumnFormat | undefined): ColumnFormat | null {
    if (!format || ctx.gridInterface.__getLookupColumn(field)) {
        return null;
    }
    return filtersAsShown(format, textsOf(ctx)) ? format : null;
}

/**
 * The formatter a column's header filter reads and writes its text with: the field's formatter, or -
 * filtering as shown (asShownFormat) - one that writes and reads the text in the display format
 * (asShownFormatter: `2026-W47`, `1 234,5`), whose placeholder is an example of it: today in the format,
 * the text `filter.placeholder.daysUntil` for `daysUntil`. Used by the cell, the placeholder, the range
 * block of the filter menu, the date pickers and filterCallback
 * @param format the column's format, see asShownFormat
 */
export function headerFilterFormatter(ctx: Grid, field: string, format: ColumnFormat | undefined): Formatter {
    const fieldFormatter = ctx.gridInterface.getDatasource().getField(field).formatter;
    const shown = asShownFormat(ctx, field, format);
    if (!shown) {
        return fieldFormatter;
    }
    const formatter = asShownFormatter(fieldFormatter, shown, textsOf(ctx), () => new Date());
    return shown.date === 'daysUntil' ? { ...formatter, placeholder: gridText(ctx, 'filter.placeholder.daysUntil') } : formatter;
}

/**
 * The date format a column's header filter filters as shown with - its conditions are of the period
 * typed (dateConditions) - else null: a number format reads the number only, the conditions are as
 * without it
 */
export function asShownDateFormat(ctx: Grid, field: string): { format: DateFormat; texts: FormatTexts } | null {
    const date = asShownFormat(ctx, field, ctx.gridInterface.__getGridConfig().columns[field]?.format)?.date;
    return date ? { format: date, texts: textsOf(ctx) } : null;
}

/**
 * From and To for a range picker opened on a BETWEEN of a column that filters a date as shown: From the
 * start of its period, To the last day of its - `2026-W40..2026-W47` opens on Monday of week 40 to Sunday
 * of week 47. A column that does not: the range as it is
 * @param range the `[from, to]` the header filter's formatter read: the start of each period
 */
export function pickerRange(ctx: Grid, field: string, range: [unknown, unknown]): DateRange {
    const asDate = (value: unknown) => (value instanceof Date && !Number.isNaN(value.getTime()) ? value : null);
    const shown = asShownDateFormat(ctx, field);
    const to = asDate(range[1]);
    const period = shown && to ? periodOf(to, shown.format, shown.texts, new Date()) : null;
    if (!period) {
        return [asDate(range[0]), to];
    }
    const last = new Date(period.next.getTime());
    last.setDate(last.getDate() - 1);
    return [asDate(range[0]), last];
}

/**
 * the part of a column's format that decides how its header filter reads its text: '' when it does not
 * filter as shown, else the date or number format
 */
function asShownKey(ctx: Grid, field: string, format: ColumnFormat | undefined): string {
    const shown = asShownFormat(ctx, field, format);
    return shown ? JSON.stringify([shown.date ?? null, shown.number ?? null]) : '';
}

/**
 * After the user changed the formats of columns - Format › in the header menu, Apply of the grid config
 * dialog: each header filter with a value whose column now reads its text in another way (another date
 * format filtered as shown, filter as shown turned on or off) runs again with its value, as the cell
 * shows it now - the cell and the rows stay one: `2026-W47` switched to `month` shows `2026-11` and
 * filters on November. The header is rendered again when one ran
 * @param before the formats of the state before the change, `getState().formats`
 */
export function refilterChangedFormats(ctx: Grid, before: Record<string, ColumnFormat>) {
    const columns = ctx.gridInterface.__getGridConfig().columns;
    let ran = false;
    for (const field of Object.keys(columns)) {
        const value = ctx.gridInterface.__getHeaderFilter(field)?.value;
        if (value === null || value === undefined) {
            continue;
        }
        if (asShownKey(ctx, field, before[field]) !== asShownKey(ctx, field, columns[field]?.format)) {
            filterCallback(ctx, value, field);
            ran = true;
        }
    }
    if (ran) {
        rebuildHeaderColumns(ctx);
    }
}
