import { html, nothing, type TemplateResult } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import type { FilterOperator } from '../../datasource/filterExpression';
import type { TextId } from '../../texts';
import {
    type ColorRule,
    colorRuleProblem,
    PALETTE_COLORS,
    type PaletteColor,
    ruleCondition,
    ruleOperatorsOf,
    ruleTakesValue
} from '../colorRules';
import type { Grid } from '../grid';
import type { MenuItem } from '../gridMenus';
import { defaultHeaderOperator, headerFilterType } from './columnFilterOptions';
import { gridText } from './gridText';
import { HEADER_OPERATOR_TEXTS } from './headerOperatorMenu';

/**
 * The *Colour rules* of a column in the grid config dialog (columnSettings.ts), under its other settings:
 * the column's `ColumnFormat.rules` (colorRules.ts) in the dialog's draft - Apply, Cancel, Reset column
 * and Reset all are the dialog's, the rules are part of the column's format.
 *
 * - **A rule** is a group of its own (*Rule 1*): the operator - a picker of the operators the column's
 *   filter offers, not IN / NOT_IN, named as the header filter's menu names them - and the value typed as in the
 *   header filter: two (From, To) for Between, none for Is Blank / Is Not Blank, a checkbox *Checked*
 *   for a boolean column. Then *Text colour* and *Background*: a row of square swatches each, the
 *   palette and *None* - radio buttons, one stop of Tab, the arrows pick, each named by its colour - and
 *   *Bold*. Move up, Move down and Remove at the right of the condition.
 * - **Add rule** adds one at the end: the column's header filter operator, red text on a red background
 *   (as a spreadsheet's first highlight); the focus goes to its operator.
 * - **The first rule that matches wins**: the hint says so, the order is the list's.
 * - **Problems** are under the rule at once: no value to compare with, nothing to colour - the column
 *   is marked Error and Apply does nothing, as for the other settings (colorRuleProblem). A value the
 *   column does not read (a date in another format) is said too, it holds nothing back: the rule
 *   colours no cell, as the header filter filters nothing with it.
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
    yellow: 'columnSettings.rules.color.yellow',
    green: 'columnSettings.rules.color.green',
    blue: 'columnSettings.rules.color.blue',
    purple: 'columnSettings.rules.color.purple',
    grey: 'columnSettings.rules.color.grey'
};

/**
 * true when a column's rules in the dialog have a problem (colorRuleProblem): Apply does nothing while
 * one has
 */
export function colorRulesHaveProblem(rules: readonly ColorRule[] | undefined): boolean {
    return !!rules?.some((rule) => colorRuleProblem(rule) !== null);
}

/**
 * A rule as the state keeps it: its parts in the order of ColorRule, the ones left out not there - a
 * saved state reads the same whatever was changed first
 */
function tidyRule(rule: ColorRule): ColorRule {
    const tidy: ColorRule = { operator: rule.operator };
    if (rule.value !== undefined) {
        tidy.value = rule.value;
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
 * The value a rule has after its operator changed, as the filter editor keeps a condition's: to Between
 * the value it had is From; from Between to another the end that has a value; to Is Blank / Is Not
 * Blank none; from them an empty one
 */
function valueFor(rule: ColorRule, operator: FilterOperator): ColorRule['value'] {
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
    const { dialog, field, rules, idOf } = settings;
    /** the rules in the draft, each tidy */
    const write = (next: ColorRule[]) => settings.write(next.map(tidyRule));
    const text = (id: TextId, values?: Readonly<Record<string, unknown>>) => gridText(ctx, id, values);
    const gridInterface = ctx.gridInterface;
    const column = gridInterface.__getGridConfig().columns[field];
    // a lookup column compares its labels, as a text
    const type = headerFilterType(gridInterface, field);
    const offered = ruleOperatorsOf(column, type);
    const formatter = gridInterface.getDatasource().getField(field).formatter;
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
        const start = defaultHeaderOperator(column, type);
        const operator = offered.includes(start) ? start : (offered[0] ?? start);
        const rule: ColorRule = { operator, color: 'red', background: 'red' };
        if (ruleTakesValue(operator)) {
            rule.value = operator === 'BETWEEN' ? ['', ''] : type === 'boolean' ? 'true' : '';
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

    /** the name of an operator: the header filter's, the filter editor's for one it has not */
    const operatorName = (operator: FilterOperator) =>
        text(RULE_OPERATOR_TEXTS[operator] ?? (`filterEditor.operator.${operator}` as TextId));

    /**
     * The menu of a rule's operator picker: the operators the column's filter offers, the one picked with
     * a ✓ - a menu of the grid, the keyboard as in the others
     */
    const operatorMenu = (button: HTMLElement, index: number) => {
        const items = offered.map(
            (operator): MenuItem => ({
                id: RULE_OPERATOR_TEXTS[operator] ?? `filterEditor.operator.${operator}`,
                label: operatorName(operator),
                selected: () => rules[index]?.operator === operator,
                action: () =>
                    change(index, (next) => {
                        // a boolean column's value is a checkbox: checked when it had none
                        const value =
                            type === 'boolean' && !ruleTakesValue(next.operator) && ruleTakesValue(operator)
                                ? 'true'
                                : valueFor(next, operator);
                        next.operator = operator;
                        if (value === undefined) {
                            delete next.value;
                        } else {
                            next.value = value;
                        }
                    })
            })
        );
        gridInterface.openMenu(button, items);
    };

    /** an icon button at the right of a rule: Move up, Move down, Remove */
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
     * A row of swatches: a radio group of None and the palette, each a square of its colour named by it.
     * One stop of Tab, the arrows pick (the browser's radio buttons)
     * @param kind `color` the text colour, `background`
     */
    const swatches = (index: number, kind: 'color' | 'background', picked: PaletteColor | undefined) => {
        const labelId = idOf(`rule-${index}-${kind}-label`);
        const name = idOf(`rule-${index}-${kind}`);
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
                @change=${() =>
                    change(index, (rule) => {
                        if (color) {
                            rule[kind] = color;
                        } else {
                            delete rule[kind];
                        }
                    })}
            />`;
        };
        return html`<div class="column-settings-rule-style">
            <span class="column-settings-rule-style-label" id=${labelId}
                >${text(kind === 'color' ? 'columnSettings.rules.textColor' : 'columnSettings.rules.background')}</span
            >
            <div class="column-settings-swatches" role="radiogroup" aria-labelledby=${labelId}>
                ${swatch(undefined)} ${PALETTE_COLORS.map((color) => swatch(color))}
            </div>
        </div>`;
    };

    /**
     * The value of a rule: an input of the text as it is typed in the header filter - From and To for a
     * Between, a checkbox for a boolean column, none for Is Blank / Is Not Blank
     */
    const valueInputs = (rule: ColorRule, index: number, describedBy: string, invalid: boolean) => {
        if (!ruleTakesValue(rule.operator)) {
            return nothing;
        }
        if (type === 'boolean') {
            return html`<label class="column-settings-check">
                <input
                    type="checkbox"
                    id=${idOf(`rule-${index}-value`)}
                    .checked=${live(rule.value === 'true')}
                    @change=${(event: Event) =>
                        change(index, (next) => {
                            next.value = (event.target as HTMLInputElement).checked ? 'true' : 'false';
                        })}
                /><span>${text('columnSettings.rules.checked')}</span>
            </label>`;
        }
        const input = (part: string, label: string, value: string, set: (written: string) => void) =>
            html`<input
                id=${idOf(`rule-${index}-${part}`)}
                class="filter-editor-value"
                type="text"
                spellcheck="false"
                autocomplete="off"
                aria-label=${label}
                placeholder=${label}
                aria-describedby=${describedBy}
                aria-invalid=${invalid ? 'true' : 'false'}
                .value=${live(value)}
                @input=${(event: Event) => set((event.target as HTMLInputElement).value)}
            />`;
        if (rule.operator === 'BETWEEN') {
            const [from, to] = Array.isArray(rule.value) ? rule.value : ['', ''];
            return html`<span class="filter-editor-value-slot column-settings-rule-value">
                ${input('from', text('filterEditor.label.from'), from, (written) =>
                    change(index, (next) => {
                        next.value = [written, to];
                    })
                )}${input('to', text('filterEditor.label.to'), to, (written) =>
                    change(index, (next) => {
                        next.value = [from, written];
                    })
                )}
            </span>`;
        }
        return html`<span class="filter-editor-value-slot column-settings-rule-value">
            ${input('value', text('filterEditor.label.value'), typeof rule.value === 'string' ? rule.value : '', (written) =>
                change(index, (next) => {
                    next.value = written;
                })
            )}
        </span>`;
    };

    /** a rule: its condition and buttons, its colours, Bold, its problems */
    const ruleTemplate = (rule: ColorRule, index: number) => {
        const problem = colorRuleProblem(rule);
        // a value the column does not read: no condition - it holds nothing back, it is said
        const unread = !problem && ruleTakesValue(rule.operator) && !ruleCondition(rule, field, type, formatter, false);
        const problemId = idOf(`rule-${index}-problem`);
        const operatorLabel = text('filterEditor.label.operator');
        const values = Array.isArray(rule.value) ? rule.value.filter((end) => end.trim() !== '').join('..') : rule.value;
        return html`<div
            class="column-settings-rule"
            role="group"
            aria-label=${text('columnSettings.rules.rule', { number: index + 1 })}
            data-rule=${String(index)}
        >
            <div class="column-settings-rule-condition">
                <button
                    type="button"
                    id=${idOf(`rule-${index}-operator`)}
                    class="filter-editor-pick column-settings-rule-operator"
                    aria-haspopup="menu"
                    aria-label=${`${operatorLabel}: ${operatorName(rule.operator)}`}
                    data-tooltip=${operatorLabel}
                    @click=${(event: MouseEvent) => operatorMenu(event.currentTarget as HTMLElement, index)}
                >
                    <span class="filter-editor-pick-text">${operatorName(rule.operator)}</span>
                </button>
                ${valueInputs(rule, index, problemId, problem === 'value')}
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
            ${swatches(index, 'color', rule.color)} ${swatches(index, 'background', rule.background)}
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
                ${problem ? html`<div class="column-settings-problem">${text(`columnSettings.rules.problem.${problem}`)}</div>` : nothing}
                ${unread ? html`<div class="column-settings-problem">${text('columnSettings.rules.unread', { value: values })}</div>` : nothing}
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
