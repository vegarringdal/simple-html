import { html, nothing, type TemplateResult } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import type { Entity } from '../../datasource/entity';
import type { FieldType } from '../../datasource/field';
import type { FilterOperator } from '../../datasource/filterExpression';
import type { TextId } from '../../texts';
import { readerOf } from '../calculatedColumns';
import {
    type ColorRule,
    colorRuleProblem,
    formulaRuleProblem,
    PALETTE_COLORS,
    type PaletteColor,
    type RuleColor,
    type RuleCondition,
    type RuleFieldOf,
    type RuleKind,
    ruleCondition,
    ruleKind,
    ruleOperatorsOf,
    ruleTakesValue
} from '../colorRules';
import { compileFormula, formulaProblemText } from '../formula';
import type { Grid } from '../grid';
import type { MenuItem } from '../gridMenus';
import { isHexColor, TEXT_CONTRAST, textContrast } from '../ruleColors';
import { defaultHeaderOperator, headerFilterType } from './columnFilterOptions';
import { contextMenuAttributes } from './contextMenuAttributes';
import { getColumnLabel } from './getColumnLabel';
import { gridText } from './gridText';
import { HEADER_OPERATOR_TEXTS } from './headerOperatorMenu';

/**
 * The *Colour rules* of a column in the grid config dialog (columnSettings.ts), under its other settings:
 * the column's `ColumnFormat.rules` (colorRules.ts) in the dialog's draft - Apply, Cancel, Reset column
 * and Reset all are the dialog's, the rules are part of the column's format.
 *
 * - **A rule** is a group of its own (*Rule 1*). Its first line: the kind of its condition - *Value*,
 *   *Conditions*, *Formula*, radio buttons - and Move up, Move down and Remove at the right.
 *   - *Value*: the operator - a picker of the operators the column's filter offers, not IN / NOT_IN,
 *     named as the header filter's menu names them - and the value typed as in the header filter: two
 *     (From, To) for Between, none for Is Blank / Is Not Blank, a checkbox *Checked* for a boolean column.
 *   - *Conditions*: a line for each condition - a picker of its field (the columns and the calculated
 *     columns, with a search), its operator and its value as for a Value on that field, Remove - then *Add
 *     condition*; with two or more, *All of them* / *Any of them* over them.
 *   - *Formula*: a formula that is true or false (formula.ts), with the `{ }` button of the templates,
 *     and whether it is true in the row of the preview.
 * - Then *Text colour* and *Background*: a row of square swatches each, *None*, the palette and a colour
 *   picker of a custom colour (`#rrggbb`) - the swatches radio buttons, one stop of Tab, the arrows pick,
 *   each named by its colour - and *Bold*.
 * - **Add rule** adds one at the end: a Value of the column's header filter operator, red text on a red
 *   background (as a spreadsheet's first highlight); the focus goes to its operator.
 * - **The first rule that matches wins**: the hint says so, the order is the list's.
 * - **Problems** are under the rule at once: no value to compare with, no condition, a condition on a
 *   field the grid does not know, a formula with a problem or that is not true / false, nothing to
 *   colour - the column is marked Error and Apply does nothing, as for the other settings
 *   (colorRulesHaveProblem). A value the column does not read (a date in another format) and a custom
 *   text colour under 4.5:1 are said too, they hold nothing back.
 */

/**
 * What the section edits and how
 */
export interface RuleSettings {
    /** the dialog: the focus is moved in it after a rule is added, moved or removed */
    dialog: HTMLElement;
    /** the column picked */
    field: string;
    /** its rules in the dialog's draft, [] for none */
    rules: readonly ColorRule[];
    /** puts the column's new rules in the draft and renders the dialog again: [] takes them out */
    write: (rules: ColorRule[]) => void;
    /** the id of an element of the dialog, unique in the page */
    idOf: (part: string) => string;
    /** the fields a condition or a formula can name, and their types (the grid's, GridInterface.__ruleFieldOf) */
    fieldOf: RuleFieldOf;
    /** the fields the picker of a condition's field lists: the columns and the calculated columns */
    fields: readonly string[];
    /** the row of the preview, for a formula's result: undefined without rows */
    row: Entity | undefined;
    /** the `{ }` button of a template: puts a field in the input of the id at its caret */
    insertButton: (inputId: string, write: (text: string) => void) => TemplateResult;
}

/**
 * the name of each operator a rule can have: the header filter's (Operator ›), Is blank and Is not blank
 * of its Blank › - one wording in the dialog, the column's filter operator above the rules has them too
 */
const RULE_OPERATOR_TEXTS: Partial<Record<FilterOperator, TextId>> = {
    ...HEADER_OPERATOR_TEXTS,
    IS_BLANK: 'filter.filter.isBlank',
    IS_NOT_BLANK: 'filter.filter.isNotBlank'
};

/** the text of each colour's name: its swatches' names and tooltips */
const COLOR_TEXTS: Readonly<Record<PaletteColor, TextId>> = {
    red: 'columnSettings.rules.color.red',
    orange: 'columnSettings.rules.color.orange',
    amber: 'columnSettings.rules.color.amber',
    yellow: 'columnSettings.rules.color.yellow',
    lime: 'columnSettings.rules.color.lime',
    green: 'columnSettings.rules.color.green',
    teal: 'columnSettings.rules.color.teal',
    cyan: 'columnSettings.rules.color.cyan',
    blue: 'columnSettings.rules.color.blue',
    indigo: 'columnSettings.rules.color.indigo',
    purple: 'columnSettings.rules.color.purple',
    pink: 'columnSettings.rules.color.pink',
    brown: 'columnSettings.rules.color.brown',
    grey: 'columnSettings.rules.color.grey'
};

/** the kinds of a rule's condition, in the order of their radio buttons */
const KINDS: readonly RuleKind[] = ['value', 'conditions', 'formula'];

/**
 * What is wrong with a rule in the dialog, whatever the row - Apply does nothing while a rule has one:
 * colorRuleProblem's, a condition on a field the grid does not know, a formula's problem (formula.ts)
 * @returns the text id of the problem and its values, null for none
 */
function ruleProblem(
    rule: ColorRule,
    fieldOf: RuleFieldOf,
    text: (id: string, values: Record<string, unknown>) => string
): string | null {
    const problem = colorRuleProblem(rule);
    if (problem) {
        return text(`columnSettings.rules.problem.${problem}`, {});
    }
    const unknown = rule.conditions?.find((condition) => !fieldOf(condition.field));
    if (unknown) {
        return text('columnSettings.formula.problem.unknownField', { field: `{${unknown.field}}` });
    }
    if (rule.expression !== undefined) {
        const formula = formulaRuleProblem(rule.expression, fieldOf);
        return formula ? formulaProblemText(formula, text) : null;
    }
    return null;
}

/**
 * true when a column's rules in the dialog have a problem (ruleProblem): Apply does nothing while one has
 * @param fieldOf the fields a condition or a formula can name
 */
export function colorRulesHaveProblem(rules: readonly ColorRule[] | undefined, fieldOf: RuleFieldOf): boolean {
    return !!rules?.some((rule) => ruleProblem(rule, fieldOf, (id) => id) !== null);
}

/**
 * A rule as the state keeps it: its parts in the order of ColorRule, the ones left out not there - a
 * saved state reads the same whatever was changed first
 */
function tidyRule(rule: ColorRule): ColorRule {
    const tidy: ColorRule = {};
    if (rule.operator !== undefined) {
        tidy.operator = rule.operator;
    }
    if (rule.value !== undefined) {
        tidy.value = rule.value;
    }
    if (rule.conditions !== undefined) {
        tidy.conditions = rule.conditions.map((condition) => {
            const each: RuleCondition = { field: condition.field, operator: condition.operator };
            if (condition.value !== undefined) {
                each.value = condition.value;
            }
            return each;
        });
    }
    if (rule.combine === 'OR') {
        tidy.combine = 'OR';
    }
    if (rule.expression !== undefined) {
        tidy.expression = rule.expression;
    }
    if (rule.color) {
        tidy.color = rule.color;
    }
    if (rule.background) {
        tidy.background = rule.background;
    }
    if (rule.bold) {
        tidy.bold = true;
    }
    return tidy;
}

/**
 * The value a rule (or a condition) has after its operator changed, as the filter editor keeps a
 * condition's: to Between the value it had is From; from Between to another the end that has a value; to
 * Is Blank / Is Not Blank none; from them an empty one
 */
function valueFor(rule: { value?: ColorRule['value'] }, operator: FilterOperator): ColorRule['value'] {
    if (!ruleTakesValue(operator)) {
        return undefined;
    }
    const ends = Array.isArray(rule.value) ? rule.value : [rule.value ?? '', ''];
    if (operator === 'BETWEEN') {
        return [ends[0], ends[1]];
    }
    return Array.isArray(rule.value) ? (ends.find((end) => end.trim() !== '') ?? '') : (rule.value ?? '');
}

/**
 * The section: its heading and hint, the rules, Add rule
 */
export function colorRuleSettings(ctx: Grid, settings: RuleSettings): TemplateResult {
    const { dialog, field, rules, idOf, fieldOf } = settings;
    /** the rules in the draft, each tidy */
    const write = (next: ColorRule[]) => settings.write(next.map(tidyRule));
    const text = (id: TextId, values?: Readonly<Record<string, unknown>>) => gridText(ctx, id, values);
    const anyText = (id: string, values: Record<string, unknown>) => gridText(ctx, id as TextId, values);
    const gridInterface = ctx.gridInterface;
    const columns = gridInterface.__getGridConfig().columns;
    /** the type a condition on a field compares as: a lookup column's label is a text */
    const typeOf = (name: string): FieldType => headerFilterType(gridInterface, name);
    /** the operators a rule can have on a field: the ones its filter offers, not IN / NOT_IN */
    const offeredFor = (name: string) => ruleOperatorsOf(columns[name], typeOf(name));
    /** the operator a new condition on a field starts with: its header filter's */
    const startOperator = (name: string) => {
        const start = defaultHeaderOperator(columns[name], typeOf(name));
        const offered = offeredFor(name);
        return offered.includes(start) ? start : (offered[0] ?? start);
    };
    /** the value a new condition on a field starts with: checked for a boolean, empty for the others */
    const startValue = (name: string, operator: FilterOperator): ColorRule['value'] =>
        !ruleTakesValue(operator) ? undefined : operator === 'BETWEEN' ? ['', ''] : typeOf(name) === 'boolean' ? 'true' : '';
    const headingId = idOf('rules-heading');
    const hintId = idOf('rules-hint');

    /** the rules with one of them changed, written */
    const change = (index: number, edit: (rule: ColorRule) => void) => {
        const next = structuredClone([...rules]);
        edit(next[index]);
        write(next);
    };
    /** the focus on an element of the dialog after a render, by its id */
    const focus = (id: string) => dialog.querySelector<HTMLElement>(`#${id}`)?.focus();

    const add = () => {
        const operator = startOperator(field);
        const rule: ColorRule = { operator, color: 'red', background: 'red' };
        const value = startValue(field, operator);
        if (value !== undefined) {
            rule.value = value;
        }
        write([...structuredClone([...rules]), rule]);
        focus(idOf(`rule-${rules.length}-operator`));
    };
    const move = (index: number, step: -1 | 1) => {
        const to = index + step;
        if (to < 0 || to >= rules.length) {
            return;
        }
        const next = structuredClone([...rules]);
        [next[index], next[to]] = [next[to], next[index]];
        write(next);
        // the button pressed, on the rule moved
        focus(idOf(`rule-${to}-${step === -1 ? 'up' : 'down'}`));
    };
    const remove = (index: number) => {
        write(rules.filter((_, i) => i !== index).map((rule) => structuredClone(rule)));
        // the next rule's Remove, else the one before's, else Add rule
        const next = Math.min(index, rules.length - 2);
        focus(next >= 0 ? idOf(`rule-${next}-remove`) : idOf('rules-add'));
    };

    /**
     * A rule of another kind: a Value from the column's own condition of Conditions (else its header
     * filter's operator); Conditions from the Value (else one condition on the column); a Formula empty
     */
    const setKind = (index: number, kind: RuleKind) =>
        change(index, (rule) => {
            const own = rule.operator
                ? { field, operator: rule.operator, value: rule.value }
                : rule.conditions?.find((condition) => condition.field === field);
            delete rule.operator;
            delete rule.value;
            delete rule.conditions;
            delete rule.combine;
            delete rule.expression;
            if (kind === 'value') {
                rule.operator = own?.operator ?? startOperator(field);
                const value = own ? own.value : startValue(field, rule.operator);
                if (value !== undefined) {
                    rule.value = value;
                }
            } else if (kind === 'conditions') {
                const operator = own?.operator ?? startOperator(field);
                const condition: RuleCondition = { field, operator };
                const value = own ? own.value : startValue(field, operator);
                if (value !== undefined) {
                    condition.value = value;
                }
                rule.conditions = [condition];
            } else {
                rule.expression = '';
            }
        });

    /** the name of an operator: the header filter's, the filter editor's for one it has not */
    const operatorName = (operator: FilterOperator) =>
        text(RULE_OPERATOR_TEXTS[operator] ?? (`filterEditor.operator.${operator}` as TextId));

    /**
     * The picker of an operator: a menu of the operators a field's filter offers, the one picked with a ✓ -
     * a menu of the grid, the keyboard as in the others
     * @param on the field the operator is for
     * @param picked the operator now
     * @param pick sets the one picked
     */
    const operatorPicker = (id: string, on: string, picked: FilterOperator, pick: (operator: FilterOperator) => void) => {
        const operatorLabel = text('filterEditor.label.operator');
        return html`<button
            type="button"
            id=${id}
            class="filter-editor-pick column-settings-rule-operator"
            aria-haspopup="menu"
            aria-label=${`${operatorLabel}: ${operatorName(picked)}`}
            data-tooltip=${operatorLabel}
            @click=${(event: MouseEvent) => {
                const items = offeredFor(on).map(
                    (operator): MenuItem => ({
                        id: RULE_OPERATOR_TEXTS[operator] ?? `filterEditor.operator.${operator}`,
                        label: operatorName(operator),
                        selected: () => picked === operator,
                        action: () => pick(operator)
                    })
                );
                gridInterface.openMenu(event.currentTarget as HTMLElement, items);
            }}
        >
            <span class="filter-editor-pick-text">${operatorName(picked)}</span>
        </button>`;
    };

    /** an icon button at the right of a rule or a condition: Move up, Move down, Remove */
    const iconButton = (id: string, label: TextId, glyph: string, disabled: boolean, action: () => void) =>
        html`<button
            type="button"
            id=${id}
            class="filter-editor-icon column-settings-rule-button"
            aria-label=${text(label)}
            aria-disabled=${disabled ? 'true' : nothing}
            data-tooltip=${text(label)}
            @click=${() => {
                if (!disabled) {
                    action();
                }
            }}
        >
            ${glyph}
        </button>`;

    /**
     * A row of swatches: a radio group of None and the palette, each a square of its colour named by it -
     * one stop of Tab, the arrows pick (the browser's radio buttons) - and after it the colour picker of a
     * custom colour (`<input type="color">`, its own stop of Tab): picked, the swatches have none checked
     * @param kind `color` the text colour, `background`
     */
    const swatches = (index: number, kind: 'color' | 'background', picked: RuleColor | undefined) => {
        const labelId = idOf(`rule-${index}-${kind}-label`);
        const name = idOf(`rule-${index}-${kind}`);
        const set = (color: RuleColor | undefined) =>
            change(index, (rule) => {
                if (color) {
                    rule[kind] = color;
                } else {
                    delete rule[kind];
                }
            });
        const swatch = (color: PaletteColor | undefined) => {
            const label = text(color ? COLOR_TEXTS[color] : 'columnSettings.rules.none');
            const look = color
                ? `column-settings-swatch-${kind === 'color' ? 'text' : 'bg'}-${color}`
                : 'column-settings-swatch-none';
            return html`<input
                type="radio"
                class=${`column-settings-swatch ${look}`}
                name=${name}
                aria-label=${label}
                data-tooltip=${label}
                data-color=${color ?? ''}
                .checked=${live(picked === color)}
                @change=${() => set(color)}
            />`;
        };
        const custom = isHexColor(picked);
        const customLabel = text('columnSettings.rules.custom');
        return html`<div class="column-settings-rule-style">
            <span class="column-settings-rule-style-label" id=${labelId}
                >${text(kind === 'color' ? 'columnSettings.rules.textColor' : 'columnSettings.rules.background')}</span
            >
            <div class="column-settings-swatches">
                <span class="column-settings-swatch-group" role="radiogroup" aria-labelledby=${labelId}>
                    ${swatch(undefined)} ${PALETTE_COLORS.map((color) => swatch(color))}
                </span>
                <span class="column-settings-swatch-custom-box" data-tooltip=${customLabel}>
                    <span aria-hidden="true">+</span>
                    <input
                        type="color"
                        id=${idOf(`rule-${index}-${kind}-custom`)}
                        class=${`column-settings-swatch-custom${custom ? ' column-settings-swatch-custom-picked' : ''}`}
                        aria-label=${`${customLabel}${custom ? `: ${picked}` : ''}`}
                        .value=${live(custom ? picked.toLowerCase() : '#000000')}
                        @input=${(event: Event) => {
                            const value = (event.target as HTMLInputElement).value;
                            // the browser gives #rrggbb; anything else is not set
                            if (isHexColor(value)) {
                                set(value);
                            }
                        }}
                    />
                </span>
            </div>
        </div>`;
    };

    /**
     * The value of a condition: an input of the text as it is typed in the header filter - From and To for
     * a Between, a checkbox for a boolean field, none for Is Blank / Is Not Blank
     * @param part the part of the ids of its inputs: `rule-0`, `rule-0-condition-1`
     * @param on the field it is on
     * @param set writes the new value
     */
    const valueInputs = (
        condition: { operator?: FilterOperator; value?: ColorRule['value'] },
        part: string,
        on: string,
        describedBy: string,
        invalid: boolean,
        set: (value: ColorRule['value']) => void
    ) => {
        if (!condition.operator || !ruleTakesValue(condition.operator)) {
            return nothing;
        }
        if (typeOf(on) === 'boolean') {
            return html`<label class="column-settings-check">
                <input
                    type="checkbox"
                    id=${idOf(`${part}-value`)}
                    .checked=${live(condition.value === 'true')}
                    @change=${(event: Event) => set((event.target as HTMLInputElement).checked ? 'true' : 'false')}
                /><span>${text('columnSettings.rules.checked')}</span>
            </label>`;
        }
        const input = (end: string, label: string, value: string, written: (value: string) => void) =>
            html`<input
                id=${idOf(`${part}-${end}`)}
                class="filter-editor-value"
                type="text"
                spellcheck="false"
                autocomplete="off"
                aria-label=${label}
                placeholder=${label}
                aria-describedby=${describedBy}
                aria-invalid=${invalid ? 'true' : 'false'}
                .value=${live(value)}
                @input=${(event: Event) => written((event.target as HTMLInputElement).value)}
            />`;
        if (condition.operator === 'BETWEEN') {
            const [from, to] = Array.isArray(condition.value) ? condition.value : ['', ''];
            return html`<span class="filter-editor-value-slot column-settings-rule-value">
                ${input('from', text('filterEditor.label.from'), from, (value) => set([value, to]))}${input(
                    'to',
                    text('filterEditor.label.to'),
                    to,
                    (value) => set([from, value])
                )}
            </span>`;
        }
        return html`<span class="filter-editor-value-slot column-settings-rule-value">
            ${input('value', text('filterEditor.label.value'), typeof condition.value === 'string' ? condition.value : '', set)}
        </span>`;
    };

    /** the operator of a rule or condition picked: its value kept as the filter editor keeps one */
    const withOperator = (
        target: { operator?: FilterOperator; value?: ColorRule['value'] },
        on: string,
        operator: FilterOperator
    ) => {
        // a boolean field's value is a checkbox: checked when it had none
        const value =
            typeOf(on) === 'boolean' && !(target.operator && ruleTakesValue(target.operator)) && ruleTakesValue(operator)
                ? 'true'
                : valueFor(target, operator);
        target.operator = operator;
        if (value === undefined) {
            delete target.value;
        } else {
            target.value = value;
        }
    };

    /** a value the field does not read (a date of another format): said, it holds nothing back */
    const unreadOf = (condition: { operator?: FilterOperator; value?: ColorRule['value'] }, on: string) => {
        const formatter = gridInterface.getDatasource().getField(on).formatter;
        if (!condition.operator || !ruleTakesValue(condition.operator)) {
            return null;
        }
        const values = Array.isArray(condition.value)
            ? condition.value.filter((end) => end.trim() !== '').join('..')
            : (condition.value ?? '');
        if (values.trim() === '' || ruleCondition(condition, on, typeOf(on), formatter, false)) {
            return null;
        }
        return values;
    };

    /** the kind of a rule: three radio buttons on a line */
    const kindChoice = (rule: ColorRule, index: number) => {
        const labelId = idOf(`rule-${index}-kind-label`);
        const picked = ruleKind(rule);
        return html`<span class="column-settings-rule-kind" role="radiogroup" aria-labelledby=${labelId}>
            <span class="column-settings-rule-style-label" id=${labelId}>${text('columnSettings.rules.kind')}</span>
            ${KINDS.map(
                (kind) =>
                    html`<label class="column-settings-check">
                        <input
                            type="radio"
                            name=${idOf(`rule-${index}-kind`)}
                            id=${idOf(`rule-${index}-kind-${kind}`)}
                            value=${kind}
                            .checked=${live(picked === kind)}
                            @change=${() => setKind(index, kind)}
                        /><span>${text(`columnSettings.rules.kind.${kind}`)}</span>
                    </label>`
            )}
        </span>`;
    };

    /** Conditions: All of them / Any of them, the conditions, Add condition */
    const conditionsTemplate = (rule: ColorRule, index: number, problemId: string, invalid: boolean) => {
        const conditions = rule.conditions ?? [];
        const combineLabel = text('columnSettings.rules.combine.tooltip');
        const combine = rule.combine === 'OR' ? 'OR' : 'AND';
        const combinePicker =
            conditions.length > 1
                ? html`<div class="column-settings-input-row">
                      <button
                          type="button"
                          id=${idOf(`rule-${index}-combine`)}
                          class="filter-editor-pick column-settings-rule-combine"
                          aria-haspopup="menu"
                          aria-label=${`${combineLabel}: ${text(`columnSettings.rules.combine.${combine}`)}`}
                          data-tooltip=${combineLabel}
                          @click=${(event: MouseEvent) =>
                              gridInterface.openMenu(
                                  event.currentTarget as HTMLElement,
                                  (['AND', 'OR'] as const).map(
                                      (each): MenuItem => ({
                                          id: `columnSettings.rules.combine.${each}`,
                                          label: text(`columnSettings.rules.combine.${each}`),
                                          selected: () => combine === each,
                                          action: () =>
                                              change(index, (next) => {
                                                  next.combine = each;
                                              })
                                      })
                                  )
                              )}
                      >
                          <span class="filter-editor-pick-text">${text(`columnSettings.rules.combine.${combine}`)}</span>
                      </button>
                  </div>`
                : nothing;
        const conditionTemplate = (condition: RuleCondition, number: number) => {
            const part = `rule-${index}-condition-${number}`;
            const fieldLabel = text('columnSettings.rules.condition.field');
            const known = !!fieldOf(condition.field);
            const shown = known ? getColumnLabel(ctx, condition.field) : `{${condition.field}}`;
            /** the condition changed, written */
            const edit = (apply: (next: RuleCondition) => void) =>
                change(index, (next) => {
                    apply((next.conditions as RuleCondition[])[number]);
                });
            return html`<div
                class="column-settings-rule-condition"
                role="group"
                aria-label=${text('columnSettings.rules.condition', { number: number + 1 })}
            >
                <button
                    type="button"
                    id=${idOf(`${part}-field`)}
                    class="filter-editor-pick column-settings-rule-field"
                    aria-haspopup="menu"
                    aria-label=${`${fieldLabel}: ${shown}`}
                    data-tooltip=${fieldLabel}
                    @click=${(event: MouseEvent) =>
                        contextMenuAttributes(
                            ctx,
                            event.currentTarget as HTMLElement,
                            condition.field,
                            (picked) => {
                                edit((next) => {
                                    const typeChanged = typeOf(picked) !== typeOf(next.field);
                                    next.field = picked;
                                    // a field of another type, or an operator it does not offer: as a new
                                    // condition on it - its header filter's operator, no value yet
                                    if (typeChanged || !offeredFor(picked).includes(next.operator)) {
                                        next.operator = startOperator(picked);
                                        const value = startValue(picked, next.operator);
                                        if (value === undefined) {
                                            delete next.value;
                                        } else {
                                            next.value = value;
                                        }
                                    } else if (typeOf(picked) === 'boolean' && ruleTakesValue(next.operator)) {
                                        next.value = 'true';
                                    }
                                });
                                focus(idOf(`${part}-field`));
                            },
                            [...settings.fields]
                        )}
                >
                    <span class="filter-editor-pick-text">${shown}</span>
                </button>
                ${operatorPicker(idOf(`${part}-operator`), condition.field, condition.operator, (operator) =>
                    edit((next) => withOperator(next, condition.field, operator))
                )}
                ${valueInputs(condition, part, condition.field, problemId, invalid, (value) =>
                    edit((next) => {
                        next.value = value;
                    })
                )}
                <span class="column-settings-rule-buttons">
                    ${iconButton(idOf(`${part}-remove`), 'columnSettings.rules.condition.remove', '✕', false, () => {
                        change(index, (next) => {
                            next.conditions = (next.conditions ?? []).filter((_, i) => i !== number);
                        });
                        focus(idOf(`rule-${index}-condition-add`));
                    })}
                </span>
            </div>`;
        };
        return html`${combinePicker} ${conditions.map(conditionTemplate)}
            <div class="column-settings-input-row">
                <button
                    type="button"
                    id=${idOf(`rule-${index}-condition-add`)}
                    class="simple-html-grid-button column-settings-rule-condition-add"
                    @click=${() => {
                        change(index, (next) => {
                            const operator = startOperator(field);
                            const condition: RuleCondition = { field, operator };
                            const value = startValue(field, operator);
                            if (value !== undefined) {
                                condition.value = value;
                            }
                            next.conditions = [...(next.conditions ?? []), condition];
                        });
                        focus(idOf(`rule-${index}-condition-${conditions.length}-field`));
                    }}
                >
                    ${text('columnSettings.rules.condition.add')}
                </button>
            </div>`;
    };

    /** Formula: the input with its `{ }` button, its result in the row of the preview */
    const formulaTemplate = (rule: ColorRule, index: number, problemId: string, invalid: boolean) => {
        const inputId = idOf(`rule-${index}-expression`);
        const set = (expression: string) =>
            change(index, (next) => {
                next.expression = expression;
            });
        let result: TemplateResult | typeof nothing = nothing;
        if (!invalid && settings.row && rule.expression?.trim()) {
            const compiled = compileFormula(rule.expression, (name) => {
                const known = fieldOf(name);
                return known ? { type: known.type === 'datetime' ? 'date' : known.type } : undefined;
            });
            if ('formula' in compiled) {
                const evaluated = compiled.formula.evaluate(
                    readerOf(settings.row, { has: (name) => gridInterface.__isCalculated(name) })
                );
                const shown =
                    'problem' in evaluated
                        ? formulaProblemText(evaluated.problem, anyText)
                        : text(
                              evaluated.value === true
                                  ? 'columnSettings.rules.formula.true'
                                  : 'columnSettings.rules.formula.false'
                          );
                result = html`<div class="column-settings-hint column-settings-rule-result">${shown}</div>`;
            }
        }
        return html`<div class="column-settings-input-row">
                <input
                    id=${inputId}
                    class="filter-editor-value column-settings-template column-settings-rule-expression"
                    type="text"
                    spellcheck="false"
                    autocomplete="off"
                    aria-label=${text('columnSettings.rules.kind.formula')}
                    placeholder=${text('columnSettings.rules.formula.placeholder')}
                    aria-describedby=${problemId}
                    aria-invalid=${invalid ? 'true' : 'false'}
                    .value=${live(rule.expression ?? '')}
                    @input=${(event: Event) => set((event.target as HTMLInputElement).value)}
                />
                ${settings.insertButton(inputId, set)}
            </div>
            ${result}`;
    };

    /** a rule: its kind and buttons, its condition, its colours, Bold, its problems */
    const ruleTemplate = (rule: ColorRule, index: number) => {
        const kind = ruleKind(rule);
        const problem = ruleProblem(rule, fieldOf, anyText);
        const problemId = idOf(`rule-${index}-problem`);
        // a value a field does not read: no condition - it holds nothing back, it is said
        const unread = problem
            ? []
            : kind === 'value'
              ? [unreadOf(rule, field)]
              : kind === 'conditions'
                ? (rule.conditions ?? []).map((condition) => unreadOf(condition, condition.field))
                : [];
        const contrast = textContrast(rule.color, rule.background);
        const lowContrast = contrast !== null && contrast < TEXT_CONTRAST;
        const condition =
            kind === 'value'
                ? html`<div class="column-settings-rule-condition">
                      ${operatorPicker(idOf(`rule-${index}-operator`), field, rule.operator as FilterOperator, (operator) =>
                          change(index, (next) => withOperator(next, field, operator))
                      )}
                      ${valueInputs(rule, `rule-${index}`, field, problemId, problem !== null, (value) =>
                          change(index, (next) => {
                              next.value = value;
                          })
                      )}
                  </div>`
                : kind === 'conditions'
                  ? conditionsTemplate(rule, index, problemId, problem !== null)
                  : formulaTemplate(rule, index, problemId, problem !== null);
        return html`<div
            class="column-settings-rule"
            role="group"
            aria-label=${text('columnSettings.rules.rule', { number: index + 1 })}
            data-rule=${String(index)}
            data-kind=${kind}
        >
            <div class="column-settings-rule-head">
                ${kindChoice(rule, index)}
                <span class="column-settings-rule-buttons">
                    ${iconButton(idOf(`rule-${index}-up`), 'columnSettings.rules.moveUp', '↑', index === 0, () => move(index, -1))}
                    ${iconButton(
                        idOf(`rule-${index}-down`),
                        'columnSettings.rules.moveDown',
                        '↓',
                        index === rules.length - 1,
                        () => move(index, 1)
                    )}
                    ${iconButton(idOf(`rule-${index}-remove`), 'columnSettings.rules.remove', '✕', false, () => remove(index))}
                </span>
            </div>
            ${condition} ${swatches(index, 'color', rule.color)} ${swatches(index, 'background', rule.background)}
            <label class="column-settings-check">
                <input
                    type="checkbox"
                    id=${idOf(`rule-${index}-bold`)}
                    .checked=${live(rule.bold === true)}
                    @change=${(event: Event) =>
                        change(index, (next) => {
                            if ((event.target as HTMLInputElement).checked) {
                                next.bold = true;
                            } else {
                                delete next.bold;
                            }
                        })}
                /><span>${text('columnSettings.rules.bold')}</span>
            </label>
            <div class="column-settings-problems" id=${problemId} aria-live="polite">
                ${problem ? html`<div class="column-settings-problem">${problem}</div>` : nothing}
                ${unread.map((value) =>
                    value === null
                        ? nothing
                        : html`<div class="column-settings-problem">${text('columnSettings.rules.unread', { value })}</div>`
                )}
                ${
                    lowContrast
                        ? html`<div class="column-settings-problem">
                              ${text(
                                  isHexColor(rule.background)
                                      ? 'columnSettings.rules.contrast.background'
                                      : 'columnSettings.rules.contrast.rows',
                                  {
                                      ratio: (contrast as number).toFixed(1)
                                  }
                              )}
                          </div>`
                        : nothing
                }
            </div>
        </div>`;
    };

    return html`<div class="column-settings-field column-settings-rules" role="group" aria-labelledby=${headingId} aria-describedby=${hintId}>
        <span class="column-settings-label" id=${headingId}>${text('columnSettings.rules')}</span>
        <div class="column-settings-hint" id=${hintId}>${text('columnSettings.rules.hint')}</div>
        ${rules.length ? rules.map(ruleTemplate) : html`<div class="column-settings-rules-empty">${text('columnSettings.rules.empty')}</div>`}
        <div class="column-settings-input-row">
            <button type="button" id=${idOf('rules-add')} class="simple-html-grid-button column-settings-rules-add" @click=${add}>
                ${text('columnSettings.rules.add')}
            </button>
        </div>
    </div>`;
}
