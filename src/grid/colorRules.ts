import type { Datasource } from '../datasource/dataSource';
import type { Entity } from '../datasource/entity';
import type { FieldType } from '../datasource/field';
import { Filter, isIgnoredCondition } from '../datasource/filter';
import { type FilterCondition, type FilterOperator, isFilterOperator, operatorsFor } from '../datasource/filterExpression';
import { type Formatter, parseFilterText } from '../datasource/formatter';
import { objectFilter } from '../datasource/objectFilter';
import type { ColumnFormat } from './columnFormat';
import type { ColumnConfig } from './gridConfig';
import { columnOperators, isAlwaysCaseSensitive } from './gridFunctions/columnFilterOptions';
import type { LookupColumn } from './gridFunctions/lookupColumn';
import type { GridInterface } from './gridInterface';

/**
 * The colour rules of a column (`ColumnFormat.rules`): a cell's text colour, background and bold from
 * its value - "Balance < 0: red text", "Status = waiting: an orange background". No code: a rule is a
 * condition (an operator and a value, as the header filter has them) and a style from a palette, plain
 * JSON in the state with the rest of the column's format.
 *
 * - **The condition is the filter's.** The value is text as it is typed in the column's header filter,
 *   read the same way (ruleCondition): a text as it is (`*`, `%` and `_` are wildcards, case is ignored
 *   unless the column has `filterCaseSensitive`), a number or a date with the field's formatter
 *   (`parseFilter`, else `parse`), a BETWEEN's two ends each - an end left empty is open. The condition
 *   is then tested by the datasource's own Filter, the code of `datasource.filter()`: `≥ 100` or
 *   `contains late` means what it means in the header filter, 0 is blank as there.
 * - **A lookup column** (`ColumnConfig.editor`) compares the label its cells show, with the operators
 *   of a text - as its header filter does. IS_BLANK / IS_NOT_BLANK look at the value.
 * - **The first rule that matches wins**; a cell no rule matches has the grid's colours.
 * - **The palette** (PaletteColor) is css variables, readable in light and dark and in both themes -
 *   not free colours: a hex colour would be one colour in light and dark, and break one of them.
 *
 * The grid puts the classes of the matching rule on the cell element (showCellColor.ts) and on the
 * value of the detail form; the grid config dialog edits the rules (columnSettingsRules.ts).
 */

/**
 * A colour of the palette of the colour rules ({@link ColorRule}): the text colour or the background
 * of a cell. Each is a css variable of the theme, a colour for light and one for dark, kept readable:
 * the text colours have 4.5:1 to the rows, the selected rows and the backgrounds of the palette, the
 * grid's text has 4.5:1 to the backgrounds. There are no free colours - a hex colour is one colour in
 * light and in dark, it can not be readable in both. See the theming guide, "Colour rules".
 *
 * | colour | text | background |
 * | --- | --- | --- |
 * | `'red'` | dark red, light in dark mode | light red, dark in dark mode |
 * | `'orange'`, `'yellow'`, `'green'`, `'blue'`, `'purple'` | the same | the same |
 * | `'grey'` | quiet text | a grey background |
 *
 * @example
 * ```ts
 * import type { ColorRule, PaletteColor } from '@simple-html/grid';
 *
 * const warning: PaletteColor = 'orange';
 * const rule: ColorRule = { operator: 'EQUAL', value: 'waiting', background: warning };
 * ```
 */
export type PaletteColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'grey';

/**
 * @internal
 * the colours of the palette, in the order of the grid config dialog
 */
export const PALETTE_COLORS: readonly PaletteColor[] = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'grey'];

/**
 * A colour rule of a column, `ColumnFormat.rules`: when the cell's value matches `operator` and
 * `value`, the cell has the rule's text colour, background and bold. The first rule of the list that
 * matches wins.
 *
 * The condition is the one the column's header filter makes of the same operator and text: `value` is
 * text as it is typed there - `'100'`, `'late'`, `'2026-11-22'` - read with the field's formatter (a
 * number, a date), a text with its wildcards (`*`, `%`, `_`), case ignored unless the column has
 * `filterCaseSensitive`. A lookup column (`editor`) compares the label its cells show. 0 is blank, as in
 * the filter.
 *
 * | rule | colours |
 * | --- | --- |
 * | `{ operator: 'LESS_THAN', value: '0', color: 'red' }` | a negative number, red text |
 * | `{ operator: 'EQUAL', value: 'waiting', background: 'orange' }` | the text `waiting` (any case) |
 * | `{ operator: 'CONTAINS', value: 'late', color: 'red', bold: true }` | a text with `late` in it |
 * | `{ operator: 'BETWEEN', value: ['10', '20'], background: 'yellow' }` | 10 to 20, both included |
 * | `{ operator: 'BETWEEN', value: ['2026-01-01', ''], color: 'green' }` | from 2026-01-01 on |
 * | `{ operator: 'IS_BLANK', background: 'grey' }` | an empty cell, or 0 |
 * | `{ operator: 'EQUAL', value: 'true', color: 'blue' }` | a checked checkbox (a boolean column) |
 *
 * `operator` is one the column's type offers (see {@link operatorsFor}), not `IN` / `NOT_IN`: a rule
 * compares one value - give each value a rule. A rule without the value its operator needs, one that
 * colours nothing (no `color`, `background` or `bold`), a colour that is not in the palette throw a
 * `TypeError`. A value the field's formatter can not read (a date in another format) matches no cell.
 *
 * @example
 * ```ts
 * import type { ColorRule, GridConfig } from '@simple-html/grid';
 *
 * const negative: ColorRule = { operator: 'LESS_THAN', value: '0', color: 'red' };
 * const columns: GridConfig['columns'] = {
 *     balance: { format: { rules: [negative] } },
 *     status: {
 *         format: {
 *             rules: [
 *                 { operator: 'EQUAL', value: 'waiting', background: 'orange' },
 *                 { operator: 'EQUAL', value: 'done', color: 'green', bold: true }
 *             ]
 *         }
 *     }
 * };
 * ```
 */
export interface ColorRule {
    /**
     * how the cell's value is compared with `value`: an operator of the column's type, not `IN` /
     * `NOT_IN`. A lookup column takes a text's, it compares its labels
     */
    operator: FilterOperator;
    /**
     * what the value is compared with, as it is typed in the header filter: `'100'`, `'late'`,
     * `'2026-11-22'`, `'true'` / `'false'` for a boolean column. `[from, to]` for `BETWEEN` - an end
     * `''` is open. Left out for `IS_BLANK` / `IS_NOT_BLANK`, they take none
     */
    value?: string | [string, string];
    /** the colour of the cell's text, see {@link PaletteColor}. Left out: the grid's */
    color?: PaletteColor;
    /** the background of the cell, see {@link PaletteColor}. Left out: the row's */
    background?: PaletteColor;
    /** `true`: the cell's text is bold */
    bold?: boolean;
}

/** the keys of a rule, for the check of one from plain JavaScript or JSON */
const RULE_KEYS: readonly (keyof ColorRule)[] = ['operator', 'value', 'color', 'background', 'bold'];

/** the class a cell with a text colour has, besides the colour's: its text takes the cell's colour */
export const RULE_TEXT_CLASS = 'simple-html-grid-cell-text';

/** the class a cell with a background has, besides the colour's */
export const RULE_BACKGROUND_CLASS = 'simple-html-grid-cell-bg';

/** the class of a cell whose text is bold */
export const RULE_BOLD_CLASS = 'simple-html-grid-cell-bold';

/**
 * @internal
 * every class a rule can give a cell: a cell drops the ones its rule does not give (the grid reuses the
 * cell elements while scrolling)
 */
export const COLOR_RULE_CLASSES: readonly string[] = [
    RULE_TEXT_CLASS,
    RULE_BACKGROUND_CLASS,
    RULE_BOLD_CLASS,
    ...PALETTE_COLORS.flatMap((color) => [`${RULE_TEXT_CLASS}-${color}`, `${RULE_BACKGROUND_CLASS}-${color}`])
];

/**
 * @internal
 * The classes of a rule, for the element of a cell (or the detail form's value, the dialog's preview):
 * `simple-html-grid-cell-text simple-html-grid-cell-text-red`, `simple-html-grid-cell-bg
 * simple-html-grid-cell-bg-orange`, `simple-html-grid-cell-bold`. None for null: no rule matches
 */
export function colorRuleClasses(rule: ColorRule | null): string[] {
    const classes: string[] = [];
    if (rule?.color) {
        classes.push(RULE_TEXT_CLASS, `${RULE_TEXT_CLASS}-${rule.color}`);
    }
    if (rule?.background) {
        classes.push(RULE_BACKGROUND_CLASS, `${RULE_BACKGROUND_CLASS}-${rule.background}`);
    }
    if (rule?.bold) {
        classes.push(RULE_BOLD_CLASS);
    }
    return classes;
}

/**
 * @internal
 * The operators a colour rule can have on a column of a type: the type's (operatorsFor), not IN and
 * NOT_IN - a rule compares one value. The type of a lookup column is `'text'`, it compares its labels
 */
export function ruleOperatorsFor(type: FieldType): FilterOperator[] {
    return operatorsFor(type).filter((operator) => operator !== 'IN' && operator !== 'NOT_IN');
}

/**
 * @internal
 * The operators the grid config dialog offers for a column's rules: the ones its filter offers
 * (columnOperators: its type's, its `filterOperators`), not IN and NOT_IN
 */
export function ruleOperatorsOf(column: ColumnConfig | undefined, type: FieldType): FilterOperator[] {
    return columnOperators(column, type).filter((operator) => operator !== 'IN' && operator !== 'NOT_IN');
}

/**
 * @internal
 * true for an operator that compares with a value: not IS_BLANK / IS_NOT_BLANK
 */
export function ruleTakesValue(operator: FilterOperator): boolean {
    return operator !== 'IS_BLANK' && operator !== 'IS_NOT_BLANK';
}

/** text that is more than spaces */
const isText = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';

/**
 * @internal
 * What is wrong with a rule, whatever the row - for assertColorRules and the grid config dialog. null
 * when nothing:
 * - `'value'`: an operator that compares (not IS_BLANK / IS_NOT_BLANK) without its value - `''`, a
 *   BETWEEN with neither end
 * - `'style'`: no text colour, no background, not bold - it would show nothing
 */
export function colorRuleProblem(rule: ColorRule): 'value' | 'style' | null {
    if (ruleTakesValue(rule.operator)) {
        const ends = rule.operator === 'BETWEEN' && Array.isArray(rule.value) ? rule.value : [rule.value];
        if (!ends.some(isText)) {
            return 'value';
        }
    }
    return rule.color || rule.background || rule.bold ? null : 'style';
}

/** a plain object, not null or an array */
const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * @internal
 * Throws when a column's colour rules do not fit it - TypeScript catches neither a typo nor an operator
 * of another type in a config from plain JavaScript or JSON (a saved state), and a rule that is wrong
 * would colour nothing without a word:
 * - a list of rules, each an object of `operator`, `value`, `color`, `background`, `bold`
 * - `operator` one of the type's (ruleOperatorsFor), a text's for a lookup column - not IN / NOT_IN
 * - `value` text for an operator that compares, `[from, to]` of text for BETWEEN (one end at least),
 *   none for IS_BLANK / IS_NOT_BLANK
 * - `color` and `background` a colour of the palette, `bold` true or false, one of them at least
 * @param type the type of the column's field
 * @param lookup the column is a lookup column (`editor`): it compares its labels, as a text
 * @param name how the message names it: `GridConfig: columns.balance.format.rules`
 * @throws a `TypeError` naming the rule, what it has and what it takes
 */
export function assertColorRules(rules: unknown, type: FieldType, lookup: boolean, name: string): void {
    if (!Array.isArray(rules)) {
        throw new TypeError(
            `${name} is ${JSON.stringify(rules)}, it is a list of rules: [{ operator: 'LESS_THAN', value: '0', color: 'red' }]`
        );
    }
    const operators = ruleOperatorsFor(lookup ? 'text' : type);
    const quoted = (list: readonly string[]) => list.map((each) => `'${each}'`).join(', ');
    rules.forEach((rule: unknown, index) => {
        const at = `${name}[${index}]`;
        if (!isObject(rule)) {
            throw new TypeError(
                `${at} is ${JSON.stringify(rule)}, it is a rule: { operator, value?, color?, background?, bold? }`
            );
        }
        for (const key of Object.keys(rule)) {
            if (!RULE_KEYS.some((known) => known === key)) {
                throw new TypeError(`${at} has '${key}', a rule has ${RULE_KEYS.join(', ')}`);
            }
        }
        const { operator, value, color, background, bold } = rule;
        if (!isFilterOperator(operator) || !operators.includes(operator)) {
            const why =
                operator === 'IN' || operator === 'NOT_IN'
                    ? ': a rule compares one value, give each value a rule. A rule takes'
                    : lookup
                      ? ': a lookup column compares its labels, it takes'
                      : `, a ${type} column takes`;
            throw new TypeError(`${at}.operator is ${JSON.stringify(operator)}${why} ${quoted(operators)}`);
        }
        if (!ruleTakesValue(operator)) {
            if (value !== undefined) {
                throw new TypeError(`${at} has a value, ${operator} takes none`);
            }
        } else if (operator === 'BETWEEN') {
            if (!Array.isArray(value) || value.length !== 2 || value.some((end) => typeof end !== 'string')) {
                throw new TypeError(
                    `${at}.value is ${JSON.stringify(value)}, BETWEEN takes [from, to]: text as typed in the header filter, an end '' is open - ['10', '20']`
                );
            }
        } else if (typeof value !== 'string') {
            throw new TypeError(
                `${at}.value is ${JSON.stringify(value)}, it is text as typed in the header filter: '100', 'late', '2026-11-22'`
            );
        }
        for (const [key, picked] of [
            ['color', color],
            ['background', background]
        ] as const) {
            if (picked !== undefined && !PALETTE_COLORS.some((known) => known === picked)) {
                throw new TypeError(
                    `${at}.${key} is ${JSON.stringify(picked)}, it is a colour of the palette: ${quoted(PALETTE_COLORS)} - no hex colours, the palette is readable in light and dark`
                );
            }
        }
        if (bold !== undefined && typeof bold !== 'boolean') {
            throw new TypeError(`${at}.bold is ${JSON.stringify(bold)}, it is true or false`);
        }
        // the parts are of the right kind now
        switch (colorRuleProblem(rule as unknown as ColorRule)) {
            case 'value':
                throw new TypeError(`${at} has no value: ${operator} compares with one - '' is none`);
            case 'style':
                throw new TypeError(`${at} colours nothing: give it a color, a background or bold: true`);
        }
    });
}

/**
 * one value typed into a header filter, read as the header filter reads it (filterCallback): `''` is no
 * value; a number, date and datetime are parsed with the field's formatter (parseFilter, else parse),
 * a boolean is `'true'` / `'false'`, a text is taken as it is. null for no value, and for what the
 * formatter gives that the filter can not compare (an object)
 */
function ruleValue(text: string, type: FieldType, formatter: Formatter): string | number | boolean | Date | null {
    if (text.trim() === '') {
        return null;
    }
    if (type === 'boolean') {
        return text === 'true' ? true : text === 'false' ? false : null;
    }
    if (type === 'text') {
        return text;
    }
    const value = parseFilterText(formatter, text.trim());
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value instanceof Date) {
        return value;
    }
    return null;
}

/**
 * @internal
 * The condition a rule tests a cell's value with: what the column's header filter makes of the same
 * operator and text - see ruleValue. A BETWEEN's ends each, an end `''` is open (null). null when the
 * rule has no value to compare with: none, an end of neither, a value the formatter can not read (an
 * invalid date) - the rule matches no cell
 * @param field the field the condition is on
 * @param type the type it compares as: the field's, `'text'` for the label of a lookup column
 * @param formatter the field's formatter (`datasource.getField(field).formatter`)
 * @param caseSensitive true when a text compares with its case (the column's `filterCaseSensitive`)
 */
export function ruleCondition(
    rule: ColorRule,
    field: string,
    type: FieldType,
    formatter: Formatter,
    caseSensitive: boolean
): FilterCondition | null {
    const { operator } = rule;
    const options = caseSensitive ? { caseSensitive: true } : {};
    if (!ruleTakesValue(operator)) {
        return { field, operator };
    }
    const read = (text: unknown) => (typeof text === 'string' ? ruleValue(text, type, formatter) : null);
    const value = operator === 'BETWEEN' ? (Array.isArray(rule.value) ? rule.value.map(read) : null) : read(rule.value);
    const condition: FilterCondition = { field, operator, value, ...options };
    // no value, a BETWEEN without an end that is a value: the filter would ignore it - match everything
    return isIgnoredCondition(condition) ? null : condition;
}

/**
 * the filter the rules are tested with: the datasource's own, the code of `datasource.filter()`. One
 * for all grids, it keeps nothing between two calls
 */
const RULE_FILTER = new Filter();

/**
 * What a column's rules are tested with, the same for every row: the datasource (its fields' types),
 * the type and formatter of the values, the case, the lookup of a lookup column
 */
interface RuleContext {
    datasource: Datasource<any>;
    field: string;
    type: FieldType;
    formatter: Formatter;
    caseSensitive: boolean;
    lookup: LookupColumn | undefined;
}

/**
 * true when a rule matches the value of a row's field. The datasource's Filter tests the condition, as
 * it filters the rows. A lookup column: the label of the lookup row with the value, as a text (as
 * valuesWithLabel matches the header filter's text) - a value no lookup row has matches no rule that
 * compares; IS_BLANK / IS_NOT_BLANK test the value
 */
function ruleMatches(rule: ColorRule, row: Entity, context: RuleContext): boolean {
    const { datasource, field, lookup, caseSensitive } = context;
    if (lookup && ruleTakesValue(rule.operator)) {
        const condition = ruleCondition(rule, 'label', 'text', context.formatter, caseSensitive);
        const picked = lookup.lookup.rowOf(row[field]);
        if (!condition || !picked) {
            return false;
        }
        const label = { label: lookup.lookup.labelOf(picked) };
        return objectFilter(label, {
            field: 'label',
            operator: condition.operator,
            value: condition.value,
            type: 'text',
            caseSensitive
        });
    }
    const condition = ruleCondition(rule, field, context.type, context.formatter, context.caseSensitive);
    return !!condition && RULE_FILTER.filter([row], condition, datasource).length === 1;
}

/**
 * @internal
 * The rule that colours a cell: the first of its column's rules (`ColumnFormat.rules`) that matches the
 * row's value. null when none does, and for a column without rules
 * @param format the format whose rules are tested: the column's when left out - the grid config dialog
 * gives the one it edits, for its preview
 */
export function colorRuleOf(
    gridInterface: GridInterface<any>,
    field: string,
    row: Entity,
    format: ColumnFormat | undefined = gridInterface.__getGridConfig().columns[field]?.format
): ColorRule | null {
    const rules = format?.rules;
    if (!rules?.length) {
        return null;
    }
    const datasource = gridInterface.getDatasource();
    const lookup = gridInterface.__getLookupColumn(field);
    const own = datasource.getField(field);
    const type = lookup ? 'text' : own.type;
    const context: RuleContext = {
        datasource,
        field,
        type,
        formatter: own.formatter,
        caseSensitive: isAlwaysCaseSensitive(gridInterface.__getGridConfig().columns[field], type),
        lookup
    };
    return rules.find((rule) => ruleMatches(rule, row, context)) ?? null;
}
