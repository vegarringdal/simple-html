import { html, nothing, render, type TemplateResult } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import type { Datasource } from '../../datasource/dataSource';
import { isIgnoredCondition } from '../../datasource/filter';
import {
    type FilterCondition,
    type FilterExpression,
    type FilterGroup,
    type FilterOperator,
    where
} from '../../datasource/filterExpression';
import { parseFilterText } from '../../datasource/formatter';
import { TextFormatter } from '../../datasource/textFormatter';
import { findText, type TextId } from '../../texts';
import type { Grid } from '../grid';
import { asPx } from './asPx';
import { contextMenuAttributes } from './contextMenuAttributes';
import { contextMenuOperator } from './contextMenuOperator';
import { contextmenuDate } from './contextmenuDate';
import { followPointer, isPrimaryPress } from './followPointer';
import { getColumnLabel } from './getColumnLabel';
import { gridText } from './gridText';
import type { HTMLCellElement } from './HTMLCellElement';
import { rebuildHeaderColumns } from './rebuildHeaderColumns';
import { removeContextMenu } from './removeContextMenu';
import { attachTooltips, hideTooltip, tooltipsEnabled } from './tooltip';

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
 * would ignore is left out - no field or operator picked, "compare with field" without the field, a
 * date without a value - so the datasource only gets conditions that filter. Groups are kept as they
 * are, also empty ones (the filter ignores those).
 */
export function draftToFilter(draft: GroupDraft, datasource: Datasource): FilterGroup {
    const children: FilterExpression[] = [];
    for (const child of draft.children) {
        if (isGroupDraft(child)) {
            children.push(draftToFilter(child, datasource));
            continue;
        }
        const { field, operator, value, valueField } = child;
        if (!field || !operator || valueField === '') {
            continue;
        }
        const condition: FilterCondition = valueField ? { field, operator, valueField } : where(field, operator, value);
        if (!isIgnoredCondition(condition, datasource.getField(field).type)) {
            children.push(condition);
        }
    }
    return { group: draft.group === 'OR' ? 'OR' : 'AND', children };
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
 * What it shows, top to bottom: the title bar (drag it, ✕ closes), the root group, then Cancel, Apply
 * and Apply & close. A group is a line down its left side (a bracket) with its header on top - AND / OR
 * as two buttons, the one in use filled, "+ Condition", "+ Group", then wrap and delete as icons - and
 * its conditions, then its sub groups, indented. A condition is one row: the field and the operator
 * pickers, the value (or the column it is compared with), switch value / column, delete. The row
 * wraps when the dialog is narrow. Every control is a button or an input: Tab goes through them in
 * that order, Enter and Space use them, each has a name for a screen reader.
 *
 * @param filterArg the root group, the editor's own copy: it is changed in place while editing
 */
export function renderFilterEditor(ctx: Grid, filterArg: GroupDraft) {
    hideTooltip();

    const opening = !ctx.filterEditor;
    const dialog = ctx.filterEditor ?? createFilterEditorDialog(ctx);

    const text = (id: TextId) => gridText(ctx, id);
    /** renders the editor again, after an edit of the model */
    const update = () => renderFilterEditor(ctx, structuredClone(filterArg));

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
        update();
    };

    /**
     * A button with an icon only: its tooltip is its name for a screen reader too
     */
    const iconButton = (icon: TemplateResult, label: string, onClick: () => void) =>
        html`<button type="button" class="filter-editor-icon" aria-label=${label} data-tooltip=${label} @click=${onClick}>
            ${icon}
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
     * A condition, one row: field, operator, value, switch value / column, delete
     * @param children the conditions and groups of the group it is in
     */
    const condition = (arg: ConditionDraft, children: (GroupDraft | ConditionDraft)[]) => {
        // a new condition has no field yet, it is text until one is picked
        const field = arg.field ? ctx.gridInterface.getDatasource().getField(arg.field) : null;
        const formatter = field?.formatter ?? TextFormatter;
        const isDate = field?.type === 'date' || field?.type === 'datetime';
        const valueLabel = text('filterEditor.label.value');

        /**
         * the date picker under the value input of a date condition: a click on it, or Enter. The input
         * is no cell, the picker only opens under it
         */
        const openDatePicker = (event: MouseEvent | KeyboardEvent) => {
            const input = event.target as HTMLCellElement & HTMLInputElement;
            setTimeout(() => {
                contextmenuDate(ctx, event as MouseEvent, input, parseFilterText(formatter, input.value), (value) => {
                    arg.value = value;
                    update();
                });
            }, 2);
        };

        // live(): the elements are kept between renders, what the user typed is in the input, not in lit
        let value: TemplateResult | typeof nothing = html`<input
            class="filter-editor-value"
            type="text"
            aria-label=${valueLabel}
            placeholder=${valueLabel}
            .value=${live(formatter.format(arg.value) || '')}
            @keydown=${(event: KeyboardEvent) => {
                if (event.key === 'Enter' && isDate) {
                    openDatePicker(event);
                }
            }}
            @input=${(event: Event) => (arg.value = parseFilterText(formatter, (event.target as HTMLInputElement).value))}
            @change=${(event: Event) => (arg.value = parseFilterText(formatter, (event.target as HTMLInputElement).value))}
            @click=${(event: MouseEvent) => {
                if (isDate) {
                    openDatePicker(event);
                }
            }}
        />`;

        if (arg.operator === 'IN' || arg.operator === 'NOT_IN') {
            // a value per line
            const lines = Array.isArray(arg.value)
                ? arg.value.filter((line) => line !== '').join('\n')
                : arg.value === null || arg.value === undefined
                  ? ''
                  : String(arg.value);

            value = html`<textarea
                class="filter-editor-value"
                rows="2"
                aria-label=${valueLabel}
                placeholder=${valueLabel}
                .value=${live(lines)}
                @change=${(event: Event) =>
                    (arg.value = (event.target as HTMLTextAreaElement).value.split('\n').filter((line) => line !== ''))}
            ></textarea>`;
        } else if (arg.operator === 'IS_BLANK' || arg.operator === 'IS_NOT_BLANK') {
            // they take no value: nothing to type
            value = nothing;
        }

        if (arg.valueField !== undefined) {
            // compare with another field of the row, '' until it is picked
            value = picker(
                'filter-editor-pick-column',
                valueLabel,
                arg.valueField ? getColumnLabel(ctx, arg.valueField) : undefined,
                text('filterEditor.pickValueAttribute'),
                text('filterEditor.pickValueAttribute.tooltip'),
                (button) =>
                    contextMenuAttributes(ctx, button, arg.valueField, (attribute) => {
                        arg.valueField = attribute;
                        update();
                    })
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
                    contextMenuAttributes(ctx, button, arg.field, (attribute) => {
                        // the type comes from the datasource's fields, the condition has none
                        arg.field = attribute;
                        update();
                    })
            )}
            ${picker(
                'filter-editor-pick-operator',
                text('filterEditor.label.operator'),
                arg.operator ? operatorName(arg.operator) : undefined,
                text('filterEditor.pickOperator'),
                text('filterEditor.pickOperator.tooltip'),
                (button) =>
                    contextMenuOperator(ctx, button, arg.operator, (operator) => {
                        arg.operator = operator;
                        update();
                    })
            )}
            <div class="filter-editor-value-slot">${value}</div>
            ${iconButton(
                SWAP_ICON,
                text(arg.valueField !== undefined ? 'filterEditor.useValue.tooltip' : 'filterEditor.useAttribute.tooltip'),
                () => {
                    // '' is "compare with a field" before the field is picked, undefined is a value
                    arg.valueField = arg.valueField === undefined ? '' : undefined;
                    update();
                }
            )}
            ${iconButton(TRASH_ICON, text('filterEditor.deleteCondition.tooltip'), () => removeFrom(children, arg))}
        </div>`;
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
                @click=${() => {
                    arg.group = value;
                    update();
                }}
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
                    @click=${() => {
                        // a draft, filled in one pick at a time
                        arg.children.push({});
                        update();
                    }}
                >
                    ${text('filterEditor.addCondition')}
                </button>
                <button
                    type="button"
                    class="simple-html-grid-button filter-editor-add"
                    data-tooltip=${text('filterEditor.addSubGroup.tooltip')}
                    @click=${() => {
                        arg.children.push({ group: 'AND', children: [] });
                        update();
                    }}
                >
                    ${text('filterEditor.addSubGroup')}
                </button>
                <span class="filter-editor-group-tools">
                    ${iconButton(WRAP_ICON, text('filterEditor.wrapGroup.tooltip'), () => {
                        arg.children = [{ group: 'AND', children: arg.children }];
                        update();
                    })}
                    ${iconButton(
                        TRASH_ICON,
                        text(children ? 'filterEditor.deleteGroup.tooltip' : 'filterEditor.clearAll.tooltip'),
                        () => {
                            if (children) {
                                removeFrom(children, arg);
                            } else {
                                arg.children = [];
                                update();
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
     * The header filter inputs would otherwise keep showing text the applied filter no longer has
     * (and the next header filter edit would put it back)
     */
    const applyFilter = () => {
        removeContextMenu(ctx);
        const datasource = ctx.gridInterface.getDatasource();
        const filter = draftToFilter(structuredClone(filterArg), datasource);
        datasource.filter(filter.children.length ? filter : null);
        ctx.gridInterface.__clearHeaderFilterValues();
        rebuildHeaderColumns(ctx);
    };

    /**
     * grab areas for resizing, one per edge and one per corner.
     * css `resize` only gives the bottom right corner, so these are wired up by hand.
     */
    const resizeHandles = () =>
        RESIZE_HANDLES.map(
            (handle) =>
                html`<div
                    class="simple-html-resize-handle handle-${handle.name}"
                    @pointerdown=${(event: PointerEvent) => resizeDialog(dialog, handle, event)}
                ></div>`
        );

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
            ${resizeHandles()}`,
        dialog
    );

    if (opening) {
        // rendered before it is shown: showModal() moves the focus into what is there
        dialog.showModal();
        // the focus on the dialog itself, Tab goes on into it. showModal() does that for a dialog with
        // autofocus by the HTML spec now, Chrome 131 still gives it to the first button (the ✕)
        dialog.focus();
        /**
         * position.
         * The css only gives a default size - the height follows the content - left/top are set here so
         * the dialog can be dragged and resized without fighting the browser's centering (inset: 0,
         * margin: auto). Centered on the window, once it is shown and has its size
         */
        dialog.style.left = asPx(Math.max(0, Math.round((window.innerWidth - dialog.offsetWidth) / 2)));
        dialog.style.top = asPx(Math.max(0, Math.round((window.innerHeight - dialog.offsetHeight) / 2)));
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
 * the id of the editor's title, the dialog's name
 */
function titleId(ctx: Grid) {
    return `${ctx.ariaIdPrefix}-filter-editor-title`;
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

/** a trash can: delete the condition or the group */
const TRASH_ICON = icon('M4 7h16M10 4h4M6 7l1 13h10l1-13M10 11v6M14 11v6');
/** two arrows, right and left: compare with another column / with a value */
const SWAP_ICON = icon('M4 8h15M15 4l4 4-4 4M20 16H5M9 12l-4 4 4 4');
/** square brackets: wrap the group in a new group */
const WRAP_ICON = icon('M9 4H5v16h4M15 4h4v16h-4');

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

/**
 * the resize handles, and which edges each one moves
 */
const RESIZE_HANDLES = [
    { name: 'n', north: true, south: false, west: false, east: false },
    { name: 's', north: false, south: true, west: false, east: false },
    { name: 'w', north: false, south: false, west: true, east: false },
    { name: 'e', north: false, south: false, west: false, east: true },
    { name: 'nw', north: true, south: false, west: true, east: false },
    { name: 'ne', north: true, south: false, west: false, east: true },
    { name: 'sw', north: false, south: true, west: true, east: false },
    { name: 'se', north: false, south: true, west: false, east: true }
] as const;

type ResizeHandle = (typeof RESIZE_HANDLES)[number];

/**
 * Drags a handle of the dialog (the titlebar, a resize handle) from its pointerdown until the pointer
 * is let go: `move` gets how far the pointer has moved from where it went down. Pointer events, so a
 * mouse, a finger and a pen all work (followPointer). The pointer is captured on the handle: its
 * events keep coming to it when the pointer leaves it, and the window. The handles have
 * `touch-action: none` in the css, or a finger would scroll the page instead.
 */
function dragHandle(down: PointerEvent, move: (dx: number, dy: number) => void) {
    const handle = down.currentTarget;
    // the main button (left mouse button, a finger, the pen tip), one pointer at a time
    if (!(handle instanceof HTMLElement) || !isPrimaryPress(down)) {
        return;
    }
    // no text selection while dragging
    down.preventDefault();
    hideTooltip();

    handle.setPointerCapture(down.pointerId);
    followPointer(handle, down, {
        move: (event) => move(event.clientX - down.clientX, event.clientY - down.clientY),
        up: () => {},
        // the browser took the pointer: the dialog stays where it got to
        cancel: () => {}
    });
}

/**
 * resize from any edge or corner.
 *
 * Each handle says which edges it moves: dragging a west or north edge has to move
 * left/top as well as the size, otherwise the opposite edge would walk across the screen.
 */
function resizeDialog(dialog: HTMLElement, edge: ResizeHandle, event: PointerEvent) {
    const rect = dialog.getBoundingClientRect();
    const style = window.getComputedStyle(dialog);
    const minWidth = Number.parseInt(style.minWidth, 10) || 200;
    const minHeight = Number.parseInt(style.minHeight, 10) || 120;

    dragHandle(event, (dx, dy) => {
        if (edge.east) {
            dialog.style.width = asPx(Math.max(minWidth, rect.width + dx));
        }
        if (edge.west) {
            // clamp the width first, so the left edge stops instead of pushing past it
            const width = Math.max(minWidth, rect.width - dx);
            dialog.style.width = asPx(width);
            dialog.style.left = asPx(Math.round(rect.left + (rect.width - width)));
        }
        if (edge.south) {
            dialog.style.height = asPx(Math.max(minHeight, rect.height + dy));
        }
        if (edge.north) {
            const height = Math.max(minHeight, rect.height - dy);
            dialog.style.height = asPx(height);
            dialog.style.top = asPx(Math.round(rect.top + (rect.height - height)));
        }
    });
}

/**
 * drag the dialog around by its titlebar, kept inside the window
 */
function moveDialog(dialog: HTMLElement, event: PointerEvent) {
    // let the close button in the titlebar do its own thing
    if (event.target instanceof Element && event.target.closest('.filter-editor-close')) {
        return;
    }
    const rect = dialog.getBoundingClientRect();

    dragHandle(event, (dx, dy) => {
        // keep a bit of the dialog on screen so it can always be grabbed again
        const left = Math.min(Math.max(rect.left + dx, 20 - rect.width), window.innerWidth - 40);
        const top = Math.min(Math.max(rect.top + dy, 0), window.innerHeight - 30);
        dialog.style.left = asPx(Math.round(left));
        dialog.style.top = asPx(Math.round(top));
    });
}
