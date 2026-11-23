import type { Datasource } from '../datasource/dataSource';
import type { Entity } from '../datasource/entity';
import type { FieldType } from '../datasource/field';
import { Filter, isIgnoredCondition } from '../datasource/filter';
import { type FilterCondition, type FilterOperator, isFilterOperator, operatorsFor } from '../datasource/filterExpression';
import { type Formatter, parseFilterText } from '../datasource/formatter';
import { objectFilter } from '../datasource/objectFilter';
import { fillText, TEXTS } from '../texts';
import { formulaTypeOf } from './calculatedColumns';
import type { ColumnFormat } from './columnFormat';
import { compileFormula, type FormulaProblem, formulaProblemText } from './formula';
import type { ColumnConfig } from './gridConfig';
import { columnOperators, isAlwaysCaseSensitive } from './gridFunctions/columnFilterOptions';
import type { LookupColumn } from './gridFunctions/lookupColumn';
import type { GridInterface } from './gridInterface';
import { darkModeText, isHexColor, readableOn } from './ruleColors';

/**
 * The colour rules of a column (`ColumnFormat.rules`): a cell's text colour, background and bold from
 * its row - "Balance < 0: red text", "Status = waiting: an orange background". No code: a rule is a
 * condition and a style, plain JSON in the state with the rest of the column's format. The condition is
 * one of three kinds:
 *
 * - **Value** (`operator`, `value`): the cell's own value, as the column's header filter tests it. The
 *   value is text as it is typed in the header filter, read the same way (ruleCondition): a text as it
 *   is (`*`, `%` and `_` are wildcards, case is ignored unless the column has `filterCaseSensitive`), a
 *   number or a date with the field's formatter (`parseFilter`, else `parse`), a BETWEEN's two ends each
 *   - an end left empty is open. The condition is then tested by the datasource's own Filter, the code
 *   of `datasource.filter()`: `≥ 100` or `contains late` means what it means in the header filter, 0 is
 *   blank as there. A lookup column (`ColumnConfig.editor`) compares the label its cells show, with the
 *   operators of a text - as its header filter does. IS_BLANK / IS_NOT_BLANK look at the value.
 * - **Conditions** (`conditions`, `combine`): conditions on fields of the row - the column's own or
 *   others, a calculated column too - each tested as the header filter of its field tests it; all of
 *   them (`AND`, the default) or any (`OR`).
 * - **Formula** (`expression`): a formula of the calculated columns' language (formula.ts) that is true
 *   or false - `{balance} < 0 AND {status} = "late"`, `DAYS({due}, TODAY()) > 7`. True colours the
 *   cell; false and a row where it can not be computed do not.
 *
 * **The first rule that matches wins**; a cell no rule matches has the grid's colours. **The colours**
 * are the palette (PaletteColor, css variables readable in light and dark in both themes) or a custom
 * colour `#rrggbb` (ruleColors.ts: set as a custom property, made readable in dark).
 *
 * The grid puts the classes and the custom properties of the matching rule on the cell element
 * (showCellColor.ts), the value of the detail form and the dialog's preview; the grid config dialog edits
 * the rules (columnSettingsRules.ts).
 */

/**
 * A colour of the palette of the colour rules ({@link ColorRule}): the text colour or the background
 * of a cell. Each is a css variable of the theme, a colour for light and one for dark, kept readable:
 * the text colours have 4.5:1 to the rows, the selected rows and the backgrounds of the palette, the
 * grid's text has 4.5:1 to the backgrounds. A colour of your own is a custom colour, `#rrggbb` (see
 * {@link RuleColor}). See the theming guide, "Colour rules".
 *
 * | colour | text | background |
 * | --- | --- | --- |
 * | `'red'` | dark red, light in dark mode | light red, dark in dark mode |
 * | `'orange'`, `'amber'`, `'yellow'`, `'lime'`, `'green'`, `'teal'`, `'cyan'`, `'blue'`, `'indigo'`, `'purple'`, `'pink'`, `'brown'` | the same | the same |
 * | `'grey'` | quiet text | a grey background |
 *
 * @example
 * ```ts
 * import type { ColorRule, PaletteColor } from '@simple-html/grid';
 *
 * const warning: PaletteColor = 'amber';
 * const rule: ColorRule = { operator: 'EQUAL', value: 'waiting', background: warning };
 * ```
 */
export type PaletteColor =
    | 'red'
    | 'orange'
    | 'amber'
    | 'yellow'
    | 'lime'
    | 'green'
    | 'teal'
    | 'cyan'
    | 'blue'
    | 'indigo'
    | 'purple'
    | 'pink'
    | 'brown'
    | 'grey';

/**
 * @internal
 * the colours of the palette, in the order of the grid config dialog
 */
export const PALETTE_COLORS: readonly PaletteColor[] = [
    'red',
    'orange',
    'amber',
    'yellow',
    'lime',
    'green',
    'teal',
    'cyan',
    'blue',
    'indigo',
    'purple',
    'pink',
    'brown',
    'grey'
];

/**
 * A colour of a colour rule: a colour of the palette ({@link PaletteColor}), or a custom colour - `#` and
 * six hex digits, `'#ff8800'`, nothing else.
 *
 * A custom colour is the same in light and in dark, so the grid keeps it readable: a custom background
 * without a text colour gets black or white text, whichever reads better on it; a custom text colour is
 * the colour picked in light mode and made lighter in dark mode until it has 4.5:1 to the rows. The grid
 * config dialog warns when a custom text colour has less than 4.5:1 to the light rows or to its custom
 * background. It reaches the page as the value of a css custom property, never as css text.
 *
 * @example
 * ```ts
 * import type { ColorRule, RuleColor } from '@simple-html/grid';
 *
 * const brand: RuleColor = '#0f766e';
 * const rule: ColorRule = { operator: 'EQUAL', value: 'vip', background: brand }; // white text on it
 * ```
 */
export type RuleColor = PaletteColor | `#${string}`;

/**
 * A condition of a colour rule of the kind *Conditions* (`ColorRule.conditions`): a field of the row - the
 * column's own, another, a calculated column - an operator and a value, tested as the header filter of
 * that field tests what is typed in it (the field's type, its formatter, a lookup column's label, its
 * `filterCaseSensitive`).
 *
 * @example
 * ```ts
 * import type { RuleCondition } from '@simple-html/grid';
 *
 * const late: RuleCondition = { field: 'status', operator: 'EQUAL', value: 'late' };
 * const big: RuleCondition = { field: 'balance', operator: 'GREATER_THAN', value: '1000' };
 * ```
 */
export interface RuleCondition {
    /** the field: a field of the datasource, a column of the grid, a calculated column */
    field: string;
    /** an operator the field's type offers, not `IN` / `NOT_IN` - a lookup column takes a text's */
    operator: FilterOperator;
    /** the value as typed in the field's header filter, `[from, to]` for `BETWEEN`, none for `IS_BLANK` / `IS_NOT_BLANK` */
    value?: string | [string, string];
}

/**
 * A colour rule of a column, `ColumnFormat.rules`: when its condition is true for a row, the cell has
 * the rule's text colour, background and bold. The first rule of the list that matches wins.
 *
 * The condition is one of three kinds - a rule has one of them:
 *
 * - **Value**, `operator` and `value`: the cell's own value, compared as the column's header filter
 *   compares the same operator and text. `value` is text as it is typed there - `'100'`, `'late'`,
 *   `'2026-11-22'` - read with the field's formatter (a number, a date), a text with its wildcards (`*`,
 *   `%`, `_`), case ignored unless the column has `filterCaseSensitive`. A lookup column (`editor`)
 *   compares the label its cells show. 0 is blank, as in the filter.
 * - **Conditions**, `conditions` and `combine`: conditions on fields of the row, each tested as its
 *   field's header filter tests it - see {@link RuleCondition}. `combine: 'AND'` (the default) colours
 *   when all of them are true, `'OR'` when one is.
 * - **Formula**, `expression`: a formula of the language of the calculated columns that is true or false
 *   - `'{balance} < 0 AND {status} = "late"'`, `'DAYS({due}, TODAY()) > 7'` (see the guide "Calculated
 *   columns"). True colours the cell; a row where it can not be computed is not coloured.
 *
 * | rule | colours |
 * | --- | --- |
 * | `{ operator: 'LESS_THAN', value: '0', color: 'red' }` | a negative number, red text |
 * | `{ operator: 'EQUAL', value: 'waiting', background: 'orange' }` | the text `waiting` (any case) |
 * | `{ operator: 'BETWEEN', value: ['10', '20'], background: 'yellow' }` | 10 to 20, both included |
 * | `{ operator: 'IS_BLANK', background: 'grey' }` | an empty cell, or 0 |
 * | `{ conditions: [{ field: 'status', operator: 'EQUAL', value: 'late' }, { field: 'balance', operator: 'GREATER_THAN', value: '0' }], background: 'red' }` | late and owing |
 * | `{ conditions: [...], combine: 'OR', color: 'blue' }` | one of the conditions |
 * | `{ expression: 'DAYS({due}, TODAY()) > 7', background: '#fde68a' }` | more than a week late, a custom background |
 *
 * Checked when the grid is made, or `updateConfig()` or `setState()` is given it - a `TypeError` for: no
 * kind or two of them, an `operator` the field's type does not offer, `IN` / `NOT_IN` (a rule compares
 * one value - give each value a rule), a rule without the value its operator needs, a condition on a
 * field the grid does not know, a formula with a problem or that is not true / false, a rule that
 * colours nothing (no `color`, `background` or `bold`), a colour that is no colour of the palette and no
 * `#rrggbb`. A value the field's formatter can not read (a date in another format) matches no cell.
 *
 * @example
 * ```ts
 * import type { ColorRule, GridConfig } from '@simple-html/grid';
 *
 * const negative: ColorRule = { operator: 'LESS_THAN', value: '0', color: 'red' };
 * const columns: GridConfig['columns'] = {
 *     balance: { format: { rules: [negative] } },
 *     name: {
 *         format: {
 *             rules: [
 *                 // the name of a late customer who owes: conditions on other fields
 *                 {
 *                     conditions: [
 *                         { field: 'status', operator: 'EQUAL', value: 'late' },
 *                         { field: 'balance', operator: 'GREATER_THAN', value: '0' }
 *                     ],
 *                     background: 'red',
 *                     bold: true
 *                 },
 *                 // a formula
 *                 { expression: 'DAYS({due}, TODAY()) > 30', color: '#7c3aed' }
 *             ]
 *         }
 *     }
 * };
 * ```
 */
export interface ColorRule {
    /**
     * the kind *Value*: how the cell's value is compared with `value` - an operator of the column's type,
     * not `IN` / `NOT_IN`. A lookup column takes a text's, it compares its labels
     */
    operator?: FilterOperator;
    /**
     * the kind *Value*: what the value is compared with, as it is typed in the header filter: `'100'`,
     * `'late'`, `'2026-11-22'`, `'true'` / `'false'` for a boolean column. `[from, to]` for `BETWEEN` - an
     * end `''` is open. Left out for `IS_BLANK` / `IS_NOT_BLANK`, they take none
     */
    value?: string | [string, string];
    /** the kind *Conditions*: conditions on fields of the row, one at least, see {@link RuleCondition} */
    conditions?: RuleCondition[];
    /** with `conditions`: `'AND'` (the default) all of them are true, `'OR'` one of them is */
    combine?: 'AND' | 'OR';
    /** the kind *Formula*: a formula that is true or false, `'{balance} < 0 AND {status} = "late"'` */
    expression?: string;
    /** the colour of the cell's text, see {@link RuleColor}. Left out: the grid's (black or white on a custom background) */
    color?: RuleColor;
    /** the background of the cell, see {@link RuleColor}. Left out: the row's */
    background?: RuleColor;
    /** `true`: the cell's text is bold */
    bold?: boolean;
}

/** the kind of the condition of a rule: its value, conditions on fields, a formula */
export type RuleKind = 'value' | 'conditions' | 'formula';

/** the keys of a rule, for the check of one from plain JavaScript or JSON */
const RULE_KEYS: readonly (keyof ColorRule)[] = [
    'operator',
    'value',
    'conditions',
    'combine',
    'expression',
    'color',
    'background',
    'bold'
];

/** the keys of a condition */
const CONDITION_KEYS: readonly (keyof RuleCondition)[] = ['field', 'operator', 'value'];

/** the most conditions a rule may have */
export const MAX_RULE_CONDITIONS = 20;

/** the class a cell with a text colour has, besides the colour's: its text takes the cell's colour */
export const RULE_TEXT_CLASS = 'simple-html-grid-cell-text';

/** the class a cell with a background has, besides the colour's */
export const RULE_BACKGROUND_CLASS = 'simple-html-grid-cell-bg';

/** the class of a cell whose text is bold */
export const RULE_BOLD_CLASS = 'simple-html-grid-cell-bold';

/**
 * the custom properties of a custom colour (ruleColors.ts): the text colour in light and in dark, the
 * background. grid.css reads them on a cell with the class `-custom`
 */
export const RULE_TEXT_LIGHT = '--simple-html-grid-rule-text-light';
export const RULE_TEXT_DARK = '--simple-html-grid-rule-text-dark';
export const RULE_BACKGROUND = '--simple-html-grid-rule-bg';

/** the name of the custom colours in the classes: `simple-html-grid-cell-text-custom` */
const CUSTOM = 'custom';

/**
 * @internal
 * every class a rule can give a cell: a cell drops the ones its rule does not give (the grid reuses the
 * cell elements while scrolling)
 */
export const COLOR_RULE_CLASSES: readonly string[] = [
    RULE_TEXT_CLASS,
    RULE_BACKGROUND_CLASS,
    RULE_BOLD_CLASS,
    ...[...PALETTE_COLORS, CUSTOM].flatMap((color) => [`${RULE_TEXT_CLASS}-${color}`, `${RULE_BACKGROUND_CLASS}-${color}`])
];

/** @internal every custom property a rule can give a cell */
export const COLOR_RULE_PROPERTIES: readonly string[] = [RULE_TEXT_LIGHT, RULE_TEXT_DARK, RULE_BACKGROUND];

/** the name of a colour in a class: the palette's, `custom` for `#rrggbb` */
const classColor = (color: RuleColor) => (isHexColor(color) ? CUSTOM : color);

/**
 * @internal
 * The classes of a rule, for the element of a cell (or the detail form's value, the dialog's preview):
 * `simple-html-grid-cell-text simple-html-grid-cell-text-red`, `simple-html-grid-cell-bg
 * simple-html-grid-cell-bg-orange`, `simple-html-grid-cell-bold`; `-custom` for a custom colour - a
 * custom background without a text colour has the custom text too (black or white). None for null: no
 * rule matches. Its custom colours are colorRuleStyle's
 */
export function colorRuleClasses(rule: ColorRule | null): string[] {
    const classes: string[] = [];
    const autoText = !rule?.color && isHexColor(rule?.background);
    if (rule?.color || autoText) {
        classes.push(RULE_TEXT_CLASS, `${RULE_TEXT_CLASS}-${rule?.color ? classColor(rule.color) : CUSTOM}`);
    }
    if (rule?.background) {
        classes.push(RULE_BACKGROUND_CLASS, `${RULE_BACKGROUND_CLASS}-${classColor(rule.background)}`);
    }
    if (rule?.bold) {
        classes.push(RULE_BOLD_CLASS);
    }
    return classes;
}

/**
 * @internal
 * The custom properties of a rule's custom colours (ruleColors.ts), by name - {} for a rule of the
 * palette's colours and for null. Set with `style.setProperty()`, the values are `#rrggbb` only:
 * - a custom background: RULE_BACKGROUND; without a text colour the text is black or white on it
 * - a custom text colour: on a custom background as picked; else as picked in light and lighter in dark
 */
export function colorRuleStyle(rule: ColorRule | null): Record<string, string> {
    const style: Record<string, string> = {};
    const background = isHexColor(rule?.background) ? rule.background : null;
    const color = isHexColor(rule?.color) ? rule.color : null;
    if (background) {
        style[RULE_BACKGROUND] = background;
    }
    if (color) {
        style[RULE_TEXT_LIGHT] = color;
        style[RULE_TEXT_DARK] = background ? color : darkModeText(color);
    } else if (background && !rule?.color) {
        const text = readableOn(background);
        style[RULE_TEXT_LIGHT] = text;
        style[RULE_TEXT_DARK] = text;
    }
    return style;
}

/**
 * @internal
 * The kind of a rule: Formula with `expression`, Conditions with `conditions`, else Value
 */
export function ruleKind(rule: ColorRule): RuleKind {
    return rule.expression !== undefined ? 'formula' : rule.conditions !== undefined ? 'conditions' : 'value';
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

/** true when an operator that compares has no value to compare with: `''`, a BETWEEN with neither end */
function lacksValue(operator: FilterOperator, value: ColorRule['value']): boolean {
    if (!ruleTakesValue(operator)) {
        return false;
    }
    const ends = operator === 'BETWEEN' && Array.isArray(value) ? value : [value];
    return !ends.some(isText);
}

/**
 * @internal
 * What is wrong with a rule, whatever the row - for assertColorRules and the grid config dialog. null
 * when nothing:
 * - `'value'`: an operator that compares (not IS_BLANK / IS_NOT_BLANK) without its value - `''`, a
 *   BETWEEN with neither end - its own or one of its conditions'
 * - `'conditions'`: the kind Conditions without a condition
 * - `'expression'`: the kind Formula without a formula (its problems are formulaRuleProblem's)
 * - `'style'`: no text colour, no background, not bold - it would show nothing
 */
export function colorRuleProblem(rule: ColorRule): 'value' | 'conditions' | 'expression' | 'style' | null {
    switch (ruleKind(rule)) {
        case 'formula':
            if (!isText(rule.expression)) {
                return 'expression';
            }
            break;
        case 'conditions':
            if (!rule.conditions?.length) {
                return 'conditions';
            }
            if (rule.conditions.some((condition) => lacksValue(condition.operator, condition.value))) {
                return 'value';
            }
            break;
        default:
            if (rule.operator && lacksValue(rule.operator, rule.value)) {
                return 'value';
            }
    }
    return rule.color || rule.background || rule.bold ? null : 'style';
}

/**
 * What the colour rules know of a field of the row, for a condition and a formula: the type a condition
 * on it compares as (`lookup`: a lookup column, it compares its label as a text) - undefined for a field
 * the grid does not know
 */
export type RuleFieldOf = (field: string) => { type: FieldType; lookup: boolean } | undefined;

/**
 * @internal
 * The problem of a rule's formula (`expression`), null when it has none: a problem of the formula
 * (formula.ts), or `result` when it is not true / false
 * @param fieldOf the fields the formula can read and their types
 */
export function formulaRuleProblem(expression: string, fieldOf: RuleFieldOf): FormulaProblem | null {
    const compiled = compileFormula(expression, (field) => {
        const known = fieldOf(field);
        return known ? { type: formulaTypeOf(known.type) } : undefined;
    });
    if ('problem' in compiled) {
        return compiled.problem;
    }
    return compiled.formula.type === 'boolean'
        ? null
        : { id: 'result', values: {}, types: { got: compiled.formula.type, expected: 'boolean' } };
}

/** a plain object, not null or an array */
const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

/** a list of names as the messages write them: `'a', 'b'` */
const quoted = (list: readonly string[]) => list.map((each) => `'${each}'`).join(', ');

/**
 * the operator and value of a rule or a condition fit a field: an operator of its type, not IN / NOT_IN,
 * a value as the operator takes it
 * @param at how the message names the rule or condition
 */
function assertOperatorAndValue(operator: unknown, value: unknown, type: FieldType, lookup: boolean, at: string): void {
    const operators = ruleOperatorsFor(lookup ? 'text' : type);
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
}

/**
 * @internal
 * Throws when a column's colour rules do not fit it - TypeScript catches neither a typo nor an operator
 * of another type in a config from plain JavaScript or JSON (a saved state, hostile), and a rule that is
 * wrong would colour nothing without a word:
 * - a list of rules, each an object of `operator`, `value`, `conditions`, `combine`, `expression`,
 *   `color`, `background`, `bold` - of one kind: `operator` (Value), `conditions` (Conditions) or
 *   `expression` (Formula)
 * - Value: `operator` one of the type's (ruleOperatorsFor), a text's for a lookup column - not IN /
 *   NOT_IN; `value` text for an operator that compares, `[from, to]` of text for BETWEEN (one end at
 *   least), none for IS_BLANK / IS_NOT_BLANK
 * - Conditions: 1 to MAX_RULE_CONDITIONS of `{ field, operator, value? }`, each field one the grid knows
 *   (`fieldOf`), its operator and value as a Value's on that field; `combine` `'AND'` or `'OR'`
 * - Formula: a formula without a problem that is true or false (formulaRuleProblem)
 * - `color` and `background` a colour of the palette or `#rrggbb`, `bold` true or false, one of them at
 *   least
 * @param type the type of the column's field
 * @param lookup the column is a lookup column (`editor`): it compares its labels, as a text
 * @param name how the message names it: `GridConfig: columns.balance.format.rules`
 * @param fieldOf the fields of the row a condition or a formula can name. Left out: none but the
 * column's own - a condition or a formula on another field is checked by the grid, which knows them
 * @throws a `TypeError` naming the rule, what it has and what it takes
 */
export function assertColorRules(
    rules: unknown,
    type: FieldType,
    lookup: boolean,
    name: string,
    fieldOf: RuleFieldOf = () => undefined
): void {
    if (!Array.isArray(rules)) {
        throw new TypeError(
            `${name} is ${JSON.stringify(rules)}, it is a list of rules: [{ operator: 'LESS_THAN', value: '0', color: 'red' }]`
        );
    }
    rules.forEach((rule: unknown, index) => {
        const at = `${name}[${index}]`;
        if (!isObject(rule)) {
            throw new TypeError(
                `${at} is ${JSON.stringify(rule)}, it is a rule: { operator, value?, color?, background?, bold? }`
            );
        }
        for (const key of Object.keys(rule)) {
            if (!RULE_KEYS.some((known) => known === key)) {
                throw new TypeError(`${at} has '${key.slice(0, 70)}', a rule has ${RULE_KEYS.join(', ')}`);
            }
        }
        const { operator, value, conditions, combine, expression, color, background, bold } = rule;
        const kinds = [operator !== undefined, conditions !== undefined, expression !== undefined].filter(Boolean).length;
        if (kinds !== 1) {
            throw new TypeError(
                `${at} has ${kinds ? 'two kinds of condition' : 'no condition'}: a rule has an operator (and its value), conditions, or an expression`
            );
        }
        if (operator !== undefined) {
            assertOperatorAndValue(operator, value, type, lookup, at);
        } else if (value !== undefined) {
            throw new TypeError(`${at} has a value without an operator: the value is the operator's`);
        }
        if (conditions !== undefined) {
            if (!Array.isArray(conditions) || !conditions.length || conditions.length > MAX_RULE_CONDITIONS) {
                throw new TypeError(
                    `${at}.conditions is ${JSON.stringify(conditions)?.slice(0, 70)}, it is a list of 1 to ${MAX_RULE_CONDITIONS} conditions: [{ field: 'status', operator: 'EQUAL', value: 'late' }]`
                );
            }
            conditions.forEach((condition: unknown, number) => {
                const where = `${at}.conditions[${number}]`;
                if (!isObject(condition)) {
                    throw new TypeError(`${where} is ${JSON.stringify(condition)}, it is { field, operator, value? }`);
                }
                for (const key of Object.keys(condition)) {
                    if (!CONDITION_KEYS.some((known) => known === key)) {
                        throw new TypeError(`${where} has '${key.slice(0, 70)}', a condition has ${CONDITION_KEYS.join(', ')}`);
                    }
                }
                const known = typeof condition.field === 'string' ? fieldOf(condition.field) : undefined;
                if (!known) {
                    throw new TypeError(
                        `${where}.field is ${JSON.stringify(condition.field)?.slice(0, 70)}, it is a field of the grid: a column, a field of the datasource, a calculated column`
                    );
                }
                assertOperatorAndValue(condition.operator, condition.value, known.type, known.lookup, where);
            });
        } else if (combine !== undefined) {
            throw new TypeError(`${at} has combine without conditions`);
        }
        if (combine !== undefined && combine !== 'AND' && combine !== 'OR') {
            throw new TypeError(`${at}.combine is ${JSON.stringify(combine)}, it is 'AND' or 'OR'`);
        }
        if (expression !== undefined) {
            if (typeof expression !== 'string') {
                throw new TypeError(`${at}.expression is ${JSON.stringify(expression)}, it is a formula: '{balance} < 0'`);
            }
            const problem = expression.trim() === '' ? null : formulaRuleProblem(expression, fieldOf);
            if (problem) {
                const english = formulaProblemText(problem, (id, values) =>
                    fillText((TEXTS as Record<string, string>)[id] ?? id, values)
                );
                throw new TypeError(`${at}.expression: ${english}`);
            }
        }
        for (const [key, picked] of [
            ['color', color],
            ['background', background]
        ] as const) {
            if (picked !== undefined && !PALETTE_COLORS.some((known) => known === picked) && !isHexColor(picked)) {
                throw new TypeError(
                    `${at}.${key} is ${JSON.stringify(picked)?.slice(0, 70)}, it is a colour of the palette (${quoted(PALETTE_COLORS)}) or a custom colour '#rrggbb'`
                );
            }
        }
        if (bold !== undefined && typeof bold !== 'boolean') {
            throw new TypeError(`${at}.bold is ${JSON.stringify(bold)}, it is true or false`);
        }
        // the parts are of the right kind now
        switch (colorRuleProblem(rule as unknown as ColorRule)) {
            case 'value':
                throw new TypeError(`${at} has no value: ${operator ?? 'a condition'} compares with one - '' is none`);
            case 'expression':
                throw new TypeError(`${at}.expression is empty: write a formula that is true or false`);
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
 * The condition a rule (or a condition of one) tests a value with: what the field's header filter makes
 * of the same operator and text - see ruleValue. A BETWEEN's ends each, an end `''` is open (null). null
 * when it has no value to compare with: none, an end of neither, a value the formatter can not read (an
 * invalid date) - it matches no cell
 * @param rule its operator and value
 * @param field the field the condition is on
 * @param type the type it compares as: the field's, `'text'` for the label of a lookup column
 * @param formatter the field's formatter (`datasource.getField(field).formatter`)
 * @param caseSensitive true when a text compares with its case (the column's `filterCaseSensitive`)
 */
export function ruleCondition(
    rule: { operator?: FilterOperator; value?: ColorRule['value'] },
    field: string,
    type: FieldType,
    formatter: Formatter,
    caseSensitive: boolean
): FilterCondition | null {
    const { operator } = rule;
    if (!operator) {
        return null;
    }
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
 * What a condition on a field is tested with, the same for every row: the datasource (its fields'
 * types), the type and formatter of the values, the case, the lookup of a lookup column
 */
interface RuleContext {
    datasource: Datasource<any>;
    field: string;
    type: FieldType;
    formatter: Formatter;
    caseSensitive: boolean;
    lookup: LookupColumn | undefined;
}

/** what a condition on a field is tested with, see RuleContext */
function contextOf(gridInterface: GridInterface<any>, field: string): RuleContext {
    const datasource = gridInterface.getDatasource();
    const lookup = gridInterface.__getLookupColumn(field);
    const own = datasource.getField(field);
    const type = lookup ? 'text' : own.type;
    return {
        datasource,
        field,
        type,
        formatter: own.formatter,
        caseSensitive: isAlwaysCaseSensitive(gridInterface.__getGridConfig().columns[field], type),
        lookup
    };
}

/**
 * true when an operator and value match the value of a row's field. The datasource's Filter tests the
 * condition, as it filters the rows. A lookup column: the label of the lookup row with the value, as a
 * text (as valuesWithLabel matches the header filter's text) - a value no lookup row has matches no
 * condition that compares; IS_BLANK / IS_NOT_BLANK test the value
 */
function conditionMatches(
    rule: { operator?: FilterOperator; value?: ColorRule['value'] },
    row: Entity,
    context: RuleContext
): boolean {
    const { datasource, field, lookup, caseSensitive } = context;
    if (lookup && rule.operator && ruleTakesValue(rule.operator)) {
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
 * true when a rule's condition is true for the row: its own value (Value), its conditions on the fields
 * (Conditions, all or one), its formula (Formula: true - a formula with a problem, or a row where it can
 * not be computed, is not)
 * @param contexts the contexts of the fields, made once per call of colorRuleOf
 */
function ruleMatches(
    gridInterface: GridInterface<any>,
    rule: ColorRule,
    row: Entity,
    field: string,
    contexts: Map<string, RuleContext>
): boolean {
    const context = (name: string) => {
        let made = contexts.get(name);
        if (!made) {
            made = contextOf(gridInterface, name);
            contexts.set(name, made);
        }
        return made;
    };
    switch (ruleKind(rule)) {
        case 'formula':
            return gridInterface.__ruleFormulaMatches(rule.expression ?? '', row);
        case 'conditions': {
            const conditions = rule.conditions ?? [];
            const test = (condition: RuleCondition) => conditionMatches(condition, row, context(condition.field));
            return rule.combine === 'OR' ? conditions.some(test) : conditions.length > 0 && conditions.every(test);
        }
        default:
            return conditionMatches(rule, row, context(field));
    }
}

/**
 * @internal
 * The rule that colours a cell: the first of its column's rules (`ColumnFormat.rules`) whose condition is
 * true for the row. null when none is, and for a column without rules. Never throws
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
    const contexts = new Map<string, RuleContext>();
    return rules.find((rule) => ruleMatches(gridInterface, rule, row, field, contexts)) ?? null;
}
