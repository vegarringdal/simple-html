import { html, nothing, render, type TemplateResult } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import type { Datasource } from '../../datasource/dataSource';
import { isIgnoredCondition } from '../../datasource/filter';
import {
    type FilterCondition,
    type FilterExpression,
    type FilterGroup,
    type FilterOperator,
    isRange
} from '../../datasource/filterExpression';
import { parseFilterText } from '../../datasource/formatter';
import { isBlank } from '../../datasource/isBlank';
import { TextFormatter } from '../../datasource/textFormatter';
import { findText, type TextId } from '../../texts';
import type { Grid } from '../grid';
import { asPx } from './asPx';
import { editorOperators, isAlwaysCaseSensitive, isClobField } from './columnFilterOptions';
import { contextMenuAttributes } from './contextMenuAttributes';
import { contextMenuOperator } from './contextMenuOperator';
import { contextmenuDate } from './contextmenuDate';
import { moveDialog, resizeHandles, showDialog } from './dialogFrame';
import type { FilterEditorHistory } from './filterEditorHistory';
import { getColumnLabel } from './getColumnLabel';
import { gridText } from './gridText';
import type { HTMLCellElement } from './HTMLCellElement';
import { keyText } from './keyText';
import { rebuildHeaderColumns } from './rebuildHeaderColumns';
import { removeContextMenu } from './removeContextMenu';
import { attachTooltips, hideTooltip, tooltipsEnabled } from './tooltip';
import { undoRedoAction } from './undoRedoKey';

/**
 * A condition while the filter editor builds it, one pick at a time: any part can still be missing.
 * `valueField` set means the value input is switched to "compare with another field" - it is `''`
 * until that field is picked.
 */
export type ConditionDraft = Partial<FilterCondition>;

/**
 * A group in the filter editor. Its conditions can be drafts, a {@link FilterGroup} is one too.
 */
export interface GroupDraft {
    group: 'AND' | 'OR';
    children: (GroupDraft | ConditionDraft)[];
}

/**
 * true for a group, the same test as isFilterGroup: a `children` array
 */
export function isGroupDraft(draft: GroupDraft | ConditionDraft): draft is GroupDraft {
    return 'children' in draft && Array.isArray(draft.children);
}

/**
 * The filter the editor applies: its groups and the conditions that are complete. A draft the filter
 * would ignore is left out - no field or operator picked, "compare with field" without the field, no
 * value, a BETWEEN without an end - so the datasource only gets conditions that filter. Groups are kept
 * as they are, also empty ones (the filter ignores those). A condition on a text field gets
 * `caseSensitive: true` when its toggle (Aa) is on, or its column always matches case; on another type
 * it is left out, it would be ignored.
 * @param alwaysCaseSensitive true for a field whose column always matches case (filterCaseSensitive)
 */
export function draftToFilter(
    draft: GroupDraft,
    datasource: Datasource,
    alwaysCaseSensitive: (field: string) => boolean = () => false
): FilterGroup {
    const children: FilterExpression[] = [];
    for (const child of draft.children) {
        if (isGroupDraft(child)) {
            children.push(draftToFilter(child, datasource, alwaysCaseSensitive));
            continue;
        }
        const { field, operator, value } = child;
        // BETWEEN takes its ends from the value, it compares with no field
        const valueField = operator === 'BETWEEN' ? undefined : child.valueField;
        if (!field || !operator || valueField === '') {
            continue;
        }
        let condition: FilterCondition = { field, operator };
        if (valueField) {
            condition = { field, operator, valueField };
        } else if (value !== undefined) {
            condition = { field, operator, value };
        }
        if (datasource.getField(field).type === 'text' && (child.caseSensitive === true || alwaysCaseSensitive(field))) {
            condition.caseSensitive = true;
        }
        if (!isIgnoredCondition(condition)) {
            children.push(condition);
        }
    }
    return { group: draft.group === 'OR' ? 'OR' : 'AND', children };
}

/**
 * The ends of a BETWEEN in the editor: its value, `[from, to]` - `[null, null]` before one is typed
 */
function rangeOf(value: unknown): [unknown, unknown] {
    return isRange(value) ? [value[0], value[1]] : [null, null];
}

/**
 * The filter editor: a modal `<dialog class="simple-html-grid filter-editor-content">` on the body,
 * opened with showModal(). Modal, as the grey layer over the page was before it: the grid behind can
 * not be used while it is open. The browser puts it in the top layer, makes the page behind it inert,
 * moves the focus into it (to the dialog itself, it has `autofocus`), closes it on Esc and gives the
 * focus back to where it was when it closes.
 *
 * Every edit renders it again from the start, in the same dialog: lit keeps the elements, so the
 * dialog stays where the user put it and as big as they made it, and the focus stays where it is.
 *
 * What it shows, top to bottom: the title bar (drag it, ✕ closes), the root group, then Undo and Redo,
 * Cancel, Apply and Apply & close. A group is a line down its left side (a bracket) with its header on
 * top - AND / OR as two buttons, the one in use filled, "+ Condition", "+ Group", then wrap and delete
 * as icons - and its conditions, then its sub groups, indented. A condition is one row: the field and
 * the operator pickers, the value (or the column it is compared with), switch value / column, delete.
 * The row wraps when the dialog is narrow. Every control is a button or an input: Tab goes through
 * them in that order, Enter and Space use them, each has a name for a screen reader.
 *
 * Every edit of the draft is a step of the editor's undo history, see FilterEditorHistory: the Undo
 * and Redo buttons and the keys (undoRedoKeydown) take it back and do it again.
 *
 * @param filterArg the root group, the editor's own copy: it is changed in place while editing
 * @param history the editor's undo history: a new one when it opens (openFilterEditor), the same one
 * for every render after
 */
export function renderFilterEditor(ctx: Grid, filterArg: GroupDraft, history: FilterEditorHistory) {
    hideTooltip();

    const opening = !ctx.filterEditor;
    const dialog = ctx.filterEditor ?? createFilterEditorDialog(ctx);
    // what the keys of the dialog undo, see undoRedoKeydown
    editors.set(dialog, { draft: filterArg, history });

    const text = (id: TextId) => gridText(ctx, id);
    /** renders the editor again, after an edit of the model */
    const update = () => renderFilterEditor(ctx, structuredClone(filterArg), history);

    /**
     * An edit of the draft: `change` changes it, the editor renders again. A step of the undo history,
     * unless it changed nothing
     * @param control the button the edit was made with - a picker for what was picked in its menu, the
     * value input for a date picked: the focus goes back there after an undo from the keyboard
     */
    const edit = (control: Element, change: () => void) => {
        const before = structuredClone(filterArg);
        change();
        history.record(before, filterArg, editorControls(dialog).indexOf(control as HTMLElement));
        update();
    };

    /**
     * A key typed in a value input: `write` puts its text in the draft. The editor is not rendered again
     * - that would put the formatted value into what is being typed - so Undo and Redo are updated here.
     * What is typed in it from when it got the focus is one step, see FilterEditorHistory.typed
     */
    const typed = (input: HTMLInputElement | HTMLTextAreaElement, write: () => void) => {
        const before = structuredClone(filterArg);
        write();
        history.typed(input, before, filterArg, editorControls(dialog).indexOf(input));
        showUndoRedo(dialog, history);
    };

    /**
     * the name of an operator. An operator of plain js that is not one is shown as it is
     */
    const operatorName = (operator: FilterOperator) =>
        findText(`filterEditor.operator.${operator}`, ctx.gridInterface.__getGridConfig().texts) ?? operator;

    /** takes `child` out of the group it is in */
    const removeFrom = (children: (GroupDraft | ConditionDraft)[], child: GroupDraft | ConditionDraft) => {
        const index = children.indexOf(child);
        if (index !== -1) {
            children.splice(index, 1);
        }
    };

    /**
     * A button with an icon only that edits the draft: its tooltip is its name for a screen reader too
     */
    const iconButton = (icon: TemplateResult, label: string, change: () => void) =>
        html`<button
            type="button"
            class="filter-editor-icon"
            aria-label=${label}
            data-tooltip=${label}
            @click=${(event: MouseEvent) => edit(event.currentTarget as HTMLElement, change)}
        >
            ${icon}
        </button>`;

    /**
     * Undo or Redo, at the left end of the footer: an icon, its name and its tooltip with the key (⌘Z on
     * a Mac, keyText). Greyed out with `aria-disabled` when there is nothing to undo / redo
     * (showUndoRedo), not `disabled`: a disabled button loses the focus - to the body - when the last
     * step is undone with it, and has no tooltip. The focus stays on it
     */
    const undoRedoButton = (action: 'undo' | 'redo') =>
        html`<button
            type="button"
            class=${`filter-editor-icon filter-editor-${action}`}
            aria-label=${text(action === 'undo' ? 'filterEditor.undo' : 'filterEditor.redo')}
            aria-keyshortcuts=${action === 'undo' ? 'Control+Z Meta+Z' : 'Control+Y Control+Shift+Z Meta+Y Meta+Shift+Z'}
            data-tooltip=${keyText(ctx, action === 'undo' ? 'filterEditor.undo.tooltip' : 'filterEditor.redo.tooltip')}
            @click=${() => undoRedo(ctx, action, false)}
        >
            ${action === 'undo' ? UNDO_ICON : REDO_ICON}
        </button>`;

    /**
     * A picker: a button framed as a select, with a chevron. It shows what is picked, or `placeholder`
     * (quiet) while nothing is, and opens a menu under it. Its name for a screen reader is
     * "label: what is picked", the label alone while nothing is
     */
    const picker = (
        className: string,
        label: string,
        picked: string | undefined,
        placeholder: string,
        tooltip: string,
        open: (button: HTMLElement) => void
    ) =>
        html`<button
            type="button"
            class=${`filter-editor-pick ${className}${picked === undefined ? ' filter-editor-pick-empty' : ''}`}
            aria-haspopup="menu"
            aria-label=${picked === undefined ? label : `${label}: ${picked}`}
            data-tooltip=${tooltip}
            @click=${(event: MouseEvent) => open(event.currentTarget as HTMLElement)}
        >
            <span class="filter-editor-pick-text">${picked ?? placeholder}</span>
        </button>`;

    /**
     * A condition, one row: field, operator, value, match case (a text field), switch value / column,
     * delete
     * @param children the conditions and groups of the group it is in
     */
    const condition = (arg: ConditionDraft, children: (GroupDraft | ConditionDraft)[]) => {
        // a new condition has no field yet, it is text until one is picked
        const field = arg.field ? ctx.gridInterface.getDatasource().getField(arg.field) : null;
        const formatter = field?.formatter ?? TextFormatter;
        const isDate = field?.type === 'date' || field?.type === 'datetime';
        const valueLabel = text('filterEditor.label.value');

        /**
         * A value input: the value as the field's formatter shows it, what is typed parsed with it
         * (parseFilter) - an empty input is no value, null: the number formatter would read it as 0. A
         * date field's opens the date picker under it on a click or Enter - the input is no cell, the
         * picker only opens under it
         * @param name its name for a screen reader, and its placeholder
         * @param current the value it shows
         * @param write puts a value typed or picked in the draft
         */
        const valueInput = (name: string, current: unknown, write: (value: unknown) => void) => {
            const openDatePicker = (event: MouseEvent | KeyboardEvent) => {
                const input = event.target as HTMLCellElement & HTMLInputElement;
                setTimeout(() => {
                    contextmenuDate(ctx, event as MouseEvent, input, parseFilterText(formatter, input.value), (value) =>
                        edit(input, () => write(value))
                    );
                }, 2);
            };

            /**
             * the text of the input in the draft: on every key (one step of the undo history from when it
             * got the focus) and on change. Losing the focus or the change event ends the step
             */
            const typedValue = (event: Event) => {
                const input = event.target as HTMLInputElement;
                typed(input, () => write(input.value.trim() === '' ? null : parseFilterText(formatter, input.value)));
            };

            // live(): the elements are kept between renders, what the user typed is in the input, not in lit
            return html`<input
                class="filter-editor-value"
                type="text"
                aria-label=${name}
                placeholder=${name}
                .value=${live(formatter.format(current) || '')}
                @keydown=${(event: KeyboardEvent) => {
                    if (event.key === 'Enter' && isDate) {
                        openDatePicker(event);
                    }
                }}
                @input=${typedValue}
                @change=${(event: Event) => {
                    typedValue(event);
                    history.endTyping(event.target as HTMLInputElement);
                }}
                @blur=${(event: FocusEvent) => history.endTyping(event.target as HTMLInputElement)}
                @click=${(event: MouseEvent) => {
                    if (isDate) {
                        openDatePicker(event);
                    }
                }}
            />`;
        };

        let value: TemplateResult | typeof nothing = valueInput(valueLabel, arg.value, (written) => {
            arg.value = written;
        });

        if (arg.operator === 'BETWEEN') {
            // two inputs, from and to: an end left empty is open
            const [from, to] = rangeOf(arg.value);
            value = html`${valueInput(text('filterEditor.label.from'), from, (written) => {
                arg.value = [written, rangeOf(arg.value)[1]];
            })}${valueInput(text('filterEditor.label.to'), to, (written) => {
                arg.value = [rangeOf(arg.value)[0], written];
            })}`;
        } else if (arg.operator === 'IN' || arg.operator === 'NOT_IN') {
            // a value per line
            const lines = Array.isArray(arg.value)
                ? arg.value.filter((line) => line !== '').join('\n')
                : arg.value === null || arg.value === undefined
                  ? ''
                  : String(arg.value);
            /** the lines in the draft, as typedValue */
            const typedLines = (event: Event) => {
                const textarea = event.target as HTMLTextAreaElement;
                typed(textarea, () => {
                    arg.value = textarea.value.split('\n').filter((line) => line !== '');
                });
            };

            value = html`<textarea
                class="filter-editor-value"
                rows="2"
                aria-label=${valueLabel}
                placeholder=${valueLabel}
                .value=${live(lines)}
                @input=${typedLines}
                @change=${(event: Event) => {
                    typedLines(event);
                    history.endTyping(event.target as HTMLTextAreaElement);
                }}
                @blur=${(event: FocusEvent) => history.endTyping(event.target as HTMLTextAreaElement)}
            ></textarea>`;
        } else if (arg.operator === 'IS_BLANK' || arg.operator === 'IS_NOT_BLANK') {
            // they take no value: nothing to type
            value = nothing;
        }

        if (arg.valueField !== undefined && arg.operator !== 'BETWEEN') {
            // compare with another field of the row, '' until it is picked
            value = picker(
                'filter-editor-pick-column',
                valueLabel,
                arg.valueField ? getColumnLabel(ctx, arg.valueField) : undefined,
                text('filterEditor.pickValueAttribute'),
                text('filterEditor.pickValueAttribute.tooltip'),
                (button) =>
                    contextMenuAttributes(
                        ctx,
                        button,
                        arg.valueField,
                        (attribute) =>
                            edit(button, () => {
                                arg.valueField = attribute;
                            }),
                        // a field with clobType is compared with a value only (FieldConfig.clobType)
                        Object.keys(ctx.gridInterface.__getGridConfig().columns).filter(
                            (name) => !isClobField(ctx.gridInterface, name)
                        )
                    )
            );
        }

        return html`<div class="filter-editor-condition">
            ${picker(
                'filter-editor-pick-field',
                text('filterEditor.label.field'),
                arg.field ? getColumnLabel(ctx, arg.field) : undefined,
                text('filterEditor.pickAttribute'),
                text('filterEditor.pickAttribute.tooltip'),
                (button) =>
                    contextMenuAttributes(ctx, button, arg.field, (attribute) =>
                        edit(button, () => {
                            // the type comes from the datasource's fields, the condition has none. An
                            // operator the new field does not offer is taken away: pick another
                            if (
                                attribute !== arg.field &&
                                arg.operator &&
                                !editorOperators(ctx.gridInterface, attribute).includes(arg.operator)
                            ) {
                                arg.operator = undefined;
                            }
                            // a field with clobType compares with a value only
                            if (isClobField(ctx.gridInterface, attribute)) {
                                arg.valueField = undefined;
                            }
                            arg.field = attribute;
                        })
                    )
            )}
            ${picker(
                'filter-editor-pick-operator',
                text('filterEditor.label.operator'),
                arg.operator ? operatorName(arg.operator) : undefined,
                text('filterEditor.pickOperator'),
                text('filterEditor.pickOperator.tooltip'),
                (button) =>
                    contextMenuOperator(ctx, button, arg.operator, editorOperators(ctx.gridInterface, arg.field), (operator) =>
                        edit(button, () => pickOperator(arg, operator))
                    )
            )}
            <div class="filter-editor-value-slot">${value}</div>
            ${caseToggle(arg)}
            ${
                // BETWEEN compares with its two values, not with a field; a field with clobType with a value
                arg.operator === 'BETWEEN' || (arg.field !== undefined && isClobField(ctx.gridInterface, arg.field))
                    ? ICON_SPACE
                    : iconButton(
                          SWAP_ICON,
                          text(
                              arg.valueField !== undefined ? 'filterEditor.useValue.tooltip' : 'filterEditor.useAttribute.tooltip'
                          ),
                          () => {
                              // '' is "compare with a field" before the field is picked, undefined is a value
                              arg.valueField = arg.valueField === undefined ? '' : undefined;
                          }
                      )
            }
            ${iconButton(TRASH_ICON, text('filterEditor.deleteCondition.tooltip'), () => removeFrom(children, arg))}
        </div>`;
    };

    /**
     * Match case, the toggle of a condition on a text field (not IS_BLANK / IS_NOT_BLANK, they compare
     * nothing): "Aa", pressed (aria-pressed) while the condition matches case - the room of it, empty, on
     * the others (ICON_SPACE). A column that always matches case (filterCaseSensitive) has it pressed and
     * greyed out - aria-disabled, so it keeps the focus and its tooltip - and a click changes nothing
     */
    const caseToggle = (arg: ConditionDraft) => {
        const field = arg.field ? ctx.gridInterface.getDatasource().getField(arg.field) : null;
        if (field?.type !== 'text' || arg.operator === 'IS_BLANK' || arg.operator === 'IS_NOT_BLANK') {
            return ICON_SPACE;
        }
        const always = isAlwaysCaseSensitive(
            ctx.gridInterface.__getGridConfig().columns[field.name],
            field.type,
            field.caseSensitive
        );
        const tooltip = text(always ? 'filterEditor.matchCaseAlways.tooltip' : 'filterEditor.matchCase.tooltip');
        return html`<button
            type="button"
            class="filter-editor-icon filter-editor-case"
            aria-pressed=${String(always || arg.caseSensitive === true)}
            aria-disabled=${always ? 'true' : nothing}
            aria-label=${tooltip}
            data-tooltip=${tooltip}
            @click=${(event: MouseEvent) => {
                if (!always) {
                    edit(event.currentTarget as HTMLElement, () => {
                        arg.caseSensitive = arg.caseSensitive !== true;
                    });
                }
            }}
        >
            ${text('filterEditor.matchCase')}
        </button>`;
    };

    /**
     * A group: its header, then its conditions and its sub groups (the conditions first), indented
     * behind a line - a bracket. The root group with nothing in it says so
     * @param children the conditions and groups of the group it is in, null for the root group
     */
    const group = (arg: GroupDraft, children: (GroupDraft | ConditionDraft)[] | null): TemplateResult => {
        // (condition/group only change children from click handlers, so reading it once is the same)
        const conditions: TemplateResult[] = [];
        const groups: TemplateResult[] = [];
        for (const child of arg.children) {
            if (isGroupDraft(child)) {
                groups.push(group(child, arg.children));
            } else {
                conditions.push(condition(child, arg.children));
            }
        }

        // AND or OR, the one in use pressed (filled). Anything but OR is AND, as the filter runs it
        const isOr = arg.group === 'OR';
        const segment = (value: 'AND' | 'OR') => {
            const and = value === 'AND';
            return html`<button
                type="button"
                class="filter-editor-segment-button"
                aria-pressed=${String(and !== isOr)}
                data-tooltip=${text(and ? 'filterEditor.operatorAnd.tooltip' : 'filterEditor.operatorOr.tooltip')}
                @click=${(event: MouseEvent) =>
                    edit(event.currentTarget as HTMLElement, () => {
                        arg.group = value;
                    })}
            >
                ${text(and ? 'filterEditor.operatorAnd' : 'filterEditor.operatorOr')}
            </button>`;
        };

        return html`<div class="filter-editor-group">
            <div class="filter-editor-group-header">
                <div class="filter-editor-segment">${segment('AND')}${segment('OR')}</div>
                <button
                    type="button"
                    class="simple-html-grid-button filter-editor-add"
                    data-tooltip=${text('filterEditor.addCondition.tooltip')}
                    @click=${(event: MouseEvent) =>
                        edit(event.currentTarget as HTMLElement, () => {
                            // a draft, filled in one pick at a time
                            arg.children.push({});
                        })}
                >
                    ${text('filterEditor.addCondition')}
                </button>
                <button
                    type="button"
                    class="simple-html-grid-button filter-editor-add"
                    data-tooltip=${text('filterEditor.addSubGroup.tooltip')}
                    @click=${(event: MouseEvent) =>
                        edit(event.currentTarget as HTMLElement, () => {
                            arg.children.push({ group: 'AND', children: [] });
                        })}
                >
                    ${text('filterEditor.addSubGroup')}
                </button>
                <span class="filter-editor-group-tools">
                    ${iconButton(WRAP_ICON, text('filterEditor.wrapGroup.tooltip'), () => {
                        arg.children = [{ group: 'AND', children: arg.children }];
                    })}
                    ${iconButton(
                        TRASH_ICON,
                        text(children ? 'filterEditor.deleteGroup.tooltip' : 'filterEditor.clearAll.tooltip'),
                        () => {
                            if (children) {
                                removeFrom(children, arg);
                            } else {
                                arg.children = [];
                            }
                        }
                    )}
                </span>
            </div>
            <div class="filter-editor-group-body">
                ${!children && !arg.children.length ? html`<div class="filter-editor-empty">${text('filterEditor.empty')}</div>` : nothing}
                ${conditions}${groups}
            </div>
        </div>`;
    };

    /**
     * closes the dialog, used by the titlebar ✕ and the Cancel button
     */
    const closeEditor = () => closeFilterEditor(ctx);

    /**
     * Applies the conditions that are complete, see draftToFilter. A copy: the dialog can stay open
     * and keep editing its own. Nothing left ("clear all") is no filter, like "Clear All Filters".
     * A header filter cell whose column's conditions were changed is emptied: it would otherwise show
     * text the applied filter no longer has (and the next header filter edit would put it back). One
     * whose conditions are as they were keeps its text
     */
    const applyFilter = () => {
        removeContextMenu(ctx);
        const datasource = ctx.gridInterface.getDatasource();
        const before = datasource.getFilter();
        const columns = ctx.gridInterface.__getGridConfig().columns;
        const filter = draftToFilter(structuredClone(filterArg), datasource, (field) =>
            isAlwaysCaseSensitive(columns[field], datasource.getField(field).type, datasource.getField(field).caseSensitive)
        );
        datasource.filter(filter.children.length ? filter : null);
        ctx.gridInterface.__clearChangedHeaderFilters(before, datasource.getFilter());
        rebuildHeaderColumns(ctx);
    };

    // the titlebar: drag the dialog around by it. Its title is the dialog's name (aria-labelledby)
    render(
        html`<div class="filter-editor-titlebar" @pointerdown=${(event: PointerEvent) => moveDialog(dialog, event)}>
                <span class="filter-editor-title" id=${titleId(ctx)} data-tooltip=${text('filterEditor.title.tooltip')}
                    >${text('filterEditor.title')}</span
                >
                <button
                    type="button"
                    class="filter-editor-close"
                    aria-label=${text('filterEditor.close.tooltip')}
                    data-tooltip=${text('filterEditor.close.tooltip')}
                    @click=${closeEditor}
                >
                    ✕
                </button>
            </div>
            <div class="filter-editor-body simple-html-dialog-scroller">${group(filterArg, null)}</div>
            <div class="filter-editor-footer">
                <span class="filter-editor-undo-redo">${undoRedoButton('undo')}${undoRedoButton('redo')}</span>
                <button
                    type="button"
                    class="simple-html-grid-button"
                    data-tooltip=${text('filterEditor.closeButton.tooltip')}
                    @click=${closeEditor}
                >
                    ${text('filterEditor.closeButton')}
                </button>
                <button
                    type="button"
                    class="simple-html-grid-button"
                    data-tooltip=${text('filterEditor.filterOnly.tooltip')}
                    @click=${applyFilter}
                >
                    ${text('filterEditor.filterOnly')}
                </button>
                <button
                    type="button"
                    class="simple-html-grid-button simple-html-grid-button-primary"
                    data-tooltip=${text('filterEditor.filterAndClose.tooltip')}
                    @click=${() => {
                        closeEditor();
                        applyFilter();
                    }}
                >
                    ${text('filterEditor.filterAndClose')}
                </button>
            </div>
            ${resizeHandles(dialog)}`,
        dialog
    );
    showUndoRedo(dialog, history);

    if (opening) {
        // the focus on the dialog itself, centered on the window (dialogFrame.ts)
        showDialog(dialog);
        return;
    }

    // grown with a condition or a group: its bottom is kept in the window, it moves up as far as it has to
    const rect = dialog.getBoundingClientRect();
    if (rect.bottom > window.innerHeight) {
        dialog.style.top = asPx(Math.max(0, Math.round(window.innerHeight - rect.height)));
    }
    // the button that had the focus is gone (a condition or group deleted): the dialog gets it, Tab goes
    // on from its start. Left on the body, the next Tab would start there
    if (!dialog.contains(document.activeElement)) {
        dialog.focus({ preventScroll: true });
    }
}

/**
 * An operator picked for a condition. To BETWEEN: the value it had is its start (`[from, null]`), a
 * list is no start; it compares with its values, not a field. From BETWEEN: its first end is the
 * value. Another operator keeps the value
 */
function pickOperator(arg: ConditionDraft, operator: FilterOperator) {
    if (operator === 'BETWEEN' && arg.operator !== 'BETWEEN') {
        arg.value = [Array.isArray(arg.value) || arg.value === undefined ? null : arg.value, null];
        arg.valueField = undefined;
    } else if (operator !== 'BETWEEN' && arg.operator === 'BETWEEN') {
        const [from, to] = rangeOf(arg.value);
        arg.value = isBlank(from) ? (isBlank(to) ? undefined : to) : from;
    }
    arg.operator = operator;
}

/**
 * the id of the editor's title, the dialog's name
 */
function titleId(ctx: Grid) {
    return `${ctx.ariaIdPrefix}-filter-editor-title`;
}

/**
 * What an open editor's dialog edits: the draft of its last render and its undo history. Its key
 * listener, added once when the dialog is made, finds them here (undoRedoKeydown). Gone with the dialog
 */
const editors = new WeakMap<HTMLDialogElement, { draft: GroupDraft; history: FilterEditorHistory }>();

/**
 * The controls of the editor's groups and conditions, in the order they are shown: an edit is made
 * with one of them. A step of the undo history keeps the place of its control in this list, see
 * FilterEditorStep. Not the menus of the pickers: they are in the dialog, not in its body
 */
function editorControls(dialog: HTMLDialogElement): HTMLElement[] {
    return Array.from(
        dialog.querySelectorAll<HTMLElement>(
            '.filter-editor-body button, .filter-editor-body input, .filter-editor-body textarea'
        )
    );
}

/**
 * Undo and Redo greyed out - `aria-disabled="true"` - while there is nothing to undo / redo. After
 * every render, and after a key typed in a value input (the editor is not rendered again then)
 */
function showUndoRedo(dialog: HTMLDialogElement, history: FilterEditorHistory) {
    const show = (selector: string, can: boolean) => {
        const button = dialog.querySelector(selector);
        if (can) {
            button?.removeAttribute('aria-disabled');
        } else {
            button?.setAttribute('aria-disabled', 'true');
        }
    };
    show('.filter-editor-undo', history.canUndo());
    show('.filter-editor-redo', history.canRedo());
}

/**
 * Undo or redo in the open filter editor: the draft of the step is rendered. A menu open in it closes
 * first - a pick in it would write into the draft it was opened for.
 *
 * The focus: from the keyboard it goes to the control the edit was made with - the draft is rendered
 * as it was then, the control is at its place again - or the dialog when it is not there any more (a
 * condition deleted again by a redo). A button keeps it: Undo again is the next Enter.
 * @param focusControl true for the keys: the focus goes to the control of the step
 */
function undoRedo(ctx: Grid, action: 'undo' | 'redo', focusControl: boolean) {
    const dialog = ctx.filterEditor;
    const editor = dialog && editors.get(dialog);
    if (!dialog || !editor) {
        return;
    }
    const step = action === 'undo' ? editor.history.undo(editor.draft) : editor.history.redo(editor.draft);
    if (!step) {
        return;
    }
    removeContextMenu(ctx);
    renderFilterEditor(ctx, step.draft, editor.history);
    if (focusControl) {
        (editorControls(dialog)[step.control] ?? dialog).focus();
    }
}

/**
 * The undo and redo keys in the editor's dialog - Ctrl+Z / Cmd+Z, Ctrl+Y / Ctrl+Shift+Z / Cmd+Shift+Z
 * (undoRedoAction): the editor's undo and redo, wherever the focus is in it, an open menu of a picker
 * too (it closes). Canceled also when there is nothing to undo: the browser's own undo is the page's,
 * not the input's - Ctrl+Z on a button of the dialog undoes the typing in a value input and moves the
 * focus there (Chrome 131).
 *
 * The keys are the input's own (the browser's undo of the typing):
 * - in a value input the user typed in since it got the focus - Ctrl+Z until the typing is undone
 *   back to where it started, then it is the editor's (see FilterEditorHistory.ownKey)
 * - in a text box of an open menu while it has text: the field menu's search box
 *
 * The grid behind the dialog does not get them: its undo is in the keydown of its cells, the dialog is
 * not in the grid's element, and the page behind a modal dialog is inert
 */
function undoRedoKeydown(ctx: Grid, dialog: HTMLDialogElement, event: KeyboardEvent) {
    const action = undoRedoAction(event);
    const editor = editors.get(dialog);
    if (!action || !editor || event.defaultPrevented) {
        return;
    }
    const target = event.target;
    if (editor.history.ownKey(target, action)) {
        return;
    }
    if (target instanceof HTMLInputElement && target.value !== '' && ctx.contextMenu?.contains(target)) {
        return;
    }
    event.preventDefault();
    undoRedo(ctx, action, true);
}

/**
 * The icons of the editor's buttons, square lines in the text colour (24 x 24, drawn at 15px). The
 * button around one has its name
 */
const icon = (path: string) =>
    html`<svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="1.75"
        stroke="currentColor"
        stroke-linecap="square"
        aria-hidden="true"
        class="simple-html-grid-icon-group-svg"
    >
        <path d=${path} />
    </svg>`;

/**
 * the room of an icon a condition does not have - the toggle of a text field, the switch of a BETWEEN -
 * so the pickers and the values of the conditions of a group stay under each other
 */
const ICON_SPACE = html`<span class="filter-editor-icon-space"></span>`;

/** a trash can: delete the condition or the group */
const TRASH_ICON = icon('M4 7h16M10 4h4M6 7l1 13h10l1-13M10 11v6M14 11v6');
/** two arrows, right and left: compare with another column / with a value */
const SWAP_ICON = icon('M4 8h15M15 4l4 4-4 4M20 16H5M9 12l-4 4 4 4');
/** square brackets: wrap the group in a new group */
const WRAP_ICON = icon('M9 4H5v16h4M15 4h4v16h-4');
/** an arrow back to the left, round: undo */
const UNDO_ICON = icon('M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11');
/** an arrow on to the right, round: redo */
const REDO_ICON = icon('M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13');

/**
 * Makes the filter editor's dialog and puts it on the body, closed: renderFilterEditor renders it and
 * shows it.
 */
function createFilterEditorDialog(ctx: Grid): HTMLDialogElement {
    const dialog = document.createElement('dialog');
    dialog.classList.add('simple-html-grid', 'filter-editor-content');
    // showModal() moves the focus to the element with autofocus: the dialog itself, not a value field
    // (which would show the keyboard on a phone) nor the ✕. tabindex -1 makes it focusable, Tab goes
    // on into it. renderFilterEditor focuses it too, for the browsers that do not yet
    dialog.setAttribute('autofocus', '');
    dialog.tabIndex = -1;
    // its name: the title in its titlebar
    dialog.setAttribute('aria-labelledby', titleId(ctx));
    if (tooltipsEnabled(ctx)) {
        // data-tooltip is always written, this is what renders the built in tooltip for it
        dialog.classList.add('simple-html-grid-tooltips');
        attachTooltips(dialog);
    }
    // Esc: the browser closes the dialog (a cancel event, then close). Take it off the page, as the
    // buttons do. After the buttons, ctx.filterEditor is not this dialog anymore
    dialog.addEventListener('close', () => {
        if (ctx.filterEditor === dialog) {
            closeFilterEditor(ctx);
        }
    });
    // Ctrl+Z, Ctrl+Y ...: the editor's undo and redo
    dialog.addEventListener('keydown', (event) => undoRedoKeydown(ctx, dialog, event));
    document.body.appendChild(dialog);
    ctx.filterEditor = dialog;
    return dialog;
}

/**
 * Closes the filter editor and takes it off the page. Does nothing when it is not open. Used by its
 * buttons, after Esc, and when the grid leaves the page.
 */
export function closeFilterEditor(ctx: Grid) {
    const dialog = ctx.filterEditor;
    if (!dialog) {
        return;
    }
    ctx.filterEditor = null;
    // a field/operator picker or date picker of the editor is in the dialog
    removeContextMenu(ctx);
    hideTooltip();
    // close() before remove(): closing a modal dialog gives the focus back to the element that had it
    // when the dialog opened
    dialog.close();
    dialog.remove();
}
