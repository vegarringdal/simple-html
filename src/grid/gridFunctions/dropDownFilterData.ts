import { Filter, inListKey } from '../../datasource/filter';
import { and, type FilterExpression, isFilterGroup } from '../../datasource/filterExpression';
import type { Grid } from '../grid';
import { cellTextOf } from './cellText';
import { isHeaderFilterCaseSensitive } from './getHeaderFilterOperator';

/**
 * the most entries the value list shows, Blank not counted
 */
export const DROPDOWN_FILTER_MAX_ROWS = 100;

/**
 * One entry of the filter menu's value list: a text the cells of the column show, and the values of the
 * rows behind it
 */
export interface ValueListEntry {
    /**
     * the text as the column's cells show it (cellTextOf): the formatter's text, a lookup's label - not the
     * template of a text column (`ColumnFormat.text`), the value's own text. Values
     * shown with texts that differ in case only are one entry - `IN` compares ignoring case, it can not
     * filter them apart - with the text of the first row; not when the header filter matches case.
     * `''` for the blank entry
     */
    text: string;
    /**
     * true for "Blank": the values `IN` takes as blank (`'NULL'`, see isInListBlank) and the values whose
     * cells show no text
     */
    blank: boolean;
    /** the values behind it, once each, as an `IN` of them takes them: `'NULL'` for the blanks */
    values: unknown[];
    /** the number of rows */
    count: number;
}

/**
 * The value list of the filter menu: the entries to show and which of them start checked.
 * Excel style, see contextmenuFilter.ts `valueListBlock`
 */
export interface ValueListData {
    /** true when other filters hide rows: "Only values in filtered rows" changes the list then */
    enableAvailableOnlyOption: boolean;
    /**
     * the entries listed: Blank first (not with a search: it has no text to find), then the texts in
     * order (`localeCompare`), at most DROPDOWN_FILTER_MAX_ROWS of them
     */
    entries: ValueListEntry[];
    /** the entries checked: the ones with a row the column's own conditions let through, all without */
    checked: Set<ValueListEntry>;
    /** true when there were more texts than DROPDOWN_FILTER_MAX_ROWS: the ones after it are not listed */
    truncated: boolean;
    /** true when the list is what a search found */
    searched: boolean;
}

/**
 * The value list of a column's filter menu: the texts its cells show, with their values and number of
 * rows. For a text field and a lookup column (ColumnConfig.editor - a number field too, its cells show
 * text labels); null for the rest. When the column's header filter matches case
 * (isHeaderFilterCaseSensitive) values and texts that differ in case are entries of their own, as the
 * `IN` it applies (with `caseSensitive`) tells them apart.
 * @param availableOnly "Only values in filtered rows": only the rows the other filters let through
 * @param searchInput the search text: only the texts with it in them, ignoring case. `*` and `%` are
 * left out, they are no wildcards here
 */
export function dropDownFilterData(
    ctx: Grid,
    attribute: string,
    availableOnly: boolean,
    searchInput: string | null
): ValueListData | null {
    const datasource = ctx.gridInterface.getDatasource();
    const { type } = datasource.getField(attribute);

    if (type !== 'text' && !ctx.gridInterface.__getLookupColumn(attribute)) {
        return null;
    }

    /**
     * Excel style: the list is built from the rows every *other* filter lets through, so values
     * this column filtered away itself are still listed (unchecked) and can be checked again.
     * Using the already filtered rows made a NOT_IN computed from the list bring back values the
     * column had excluded before. The column's own conditions only decide what starts checked.
     */
    const { own, others } = splitColumnFilter(datasource.getFilter(), attribute);
    const filter = new Filter();
    const allData = datasource.getAllData();
    let availableRows = others ? filter.filter(allData, others, datasource) : allData;
    // "changed rows only" is one of the other filters (datasource.filterChangedOnly())
    if (datasource.isChangedOnly()) {
        availableRows = availableRows.filter((row) => row.__rowState !== undefined);
    }
    const data = availableOnly ? availableRows : allData;

    // rows the column's own conditions let through, null when it has none (all checked)
    const passingOwn = own.length ? new Set(filter.filter(data, and(...own), datasource)) : null;

    // the value's own text, not a template's (ColumnFormat.text): the list is of values, and a template
    // with other fields in it shows one value two ways in two rows
    const textOf = cellTextOf(ctx, attribute, { template: false });
    const formatter = datasource.getFormatter(attribute);
    // the IN of a text field matches case then, and so do the texts of the entries
    const caseSensitive = isHeaderFilterCaseSensitive(ctx, attribute);
    const textKeyOf = (text: string) => (caseSensitive ? text : text.toUpperCase());

    /**
     * The entries by the key `IN` compares a value as (inListKey), and by their text in upper case (as it
     * is when the header filter matches case). A
     * value is keyed first: its rows are in one entry, whatever text another row of it shows - an entry
     * never splits values the `IN` it applies can not tell apart. The text is read once per value
     */
    const byValue = new Map<string, ValueListEntry>();
    const byText = new Map<string, ValueListEntry>();
    const checked = new Set<ValueListEntry>();

    for (const row of data) {
        const value = row[attribute];
        const key = inListKey(value, type, formatter, caseSensitive && type === 'text');
        let entry = byValue.get(key);
        if (!entry) {
            const text = key === 'NULL' ? '' : textOf(row).text;
            // '' is the blank entry
            const textKey = textKeyOf(text);
            entry = byText.get(textKey);
            if (!entry) {
                entry = { text, blank: text === '', values: [], count: 0 };
                byText.set(textKey, entry);
            }
            entry.values.push(key === 'NULL' ? 'NULL' : value);
            byValue.set(key, entry);
        }
        entry.count++;
        if (!passingOwn || passingOwn.has(row)) {
            checked.add(entry);
        }
    }

    const search = (searchInput ?? '').replaceAll('%', '').replaceAll('*', '').toLocaleUpperCase();
    const found = Array.from(byText.values())
        .filter((entry) => !entry.blank && entry.text.toLocaleUpperCase().includes(search))
        .sort((a, b) => a.text.localeCompare(b.text));
    const blank = byText.get('');
    const entries = [...(blank && !search ? [blank] : []), ...found.slice(0, DROPDOWN_FILTER_MAX_ROWS)];

    return {
        // "Only values in filtered rows" only changes the list when other columns hide rows
        enableAvailableOnlyOption: availableRows.length !== allData.length,
        entries,
        checked: new Set(entries.filter((entry) => checked.has(entry))),
        truncated: found.length > DROPDOWN_FILTER_MAX_ROWS,
        searched: search !== ''
    };
}

/**
 * Splits the current filter into the column's own top level conditions (what the value list,
 * header filter and "is blank" put there) and everything else.
 * Only an AND root can be split - under an OR root nothing belongs to the column alone.
 * A single condition at the root is the column's own when it is on this column.
 */
function splitColumnFilter(filter: FilterExpression | null, attribute: string) {
    if (filter && isFilterGroup(filter) && filter.group !== 'OR') {
        const isOwn = (child: FilterExpression) => !isFilterGroup(child) && child.field === attribute;
        return {
            own: filter.children.filter(isOwn),
            others: and(...filter.children.filter((child) => !isOwn(child)))
        };
    }

    if (filter && !isFilterGroup(filter) && filter.field === attribute) {
        return { own: [filter], others: null };
    }

    return { own: [], others: filter };
}
