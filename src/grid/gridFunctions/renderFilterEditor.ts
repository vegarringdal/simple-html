import { html, render, type TemplateResult } from 'lit-html';
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
 * @param filterArg the root group, the editor's own copy: it is changed in place while editing
 */
export function renderFilterEditor(ctx: Grid, filterArg: GroupDraft) {
    hideTooltip();

    const opening = !ctx.filterEditor;
    const dialog = ctx.filterEditor ?? createFilterEditorDialog(ctx);

    const label = (attribute: string) => getColumnLabel(ctx, attribute);
    const text = (id: TextId) => gridText(ctx, id);

    /**
     * the name of a condition's operator, the picker's text while none is picked. An operator of plain
     * js that is not one is shown as it is
     */
    const operatorName = (operator: FilterOperator | undefined) => {
        if (!operator) {
            return text('filterEditor.pickOperator');
        }
        return findText(`filterEditor.operator.${operator}`, ctx.gridInterface.__getGridConfig().texts) ?? operator;
    };

    /**
     * Icon helper
     * @param callback
     * @returns
     */
    const trashIcon = (callback: (e: any) => void) => {
        return html`<svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="simple-html-grid-icon-group-svg"
            @click=${(e: any) => callback(e)}
        >
            <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
            />
        </svg> `;
    };

    /**
     * icon helper, switch between value and aattribute input
     * @param arg
     * @param callback
     * @returns
     */
    const inputSwitchIcon = (arg: ConditionDraft, callback: (e: any) => void) => {
        return html`
            <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="simple-html-grid-icon-group-svg"
                @click=${(e: any) => {
                    // '' is "compare with a field" before the field is picked, undefined is a value
                    arg.valueField = arg.valueField === undefined ? '' : undefined;
                    callback(e);
                }}
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                />
            </svg>
        `;
    };

    /**
     * icon helper
     * @param callback
     * @returns
     */
    const addFilterConditionIcon = (callback: (e: any) => void) => {
        return html`
            <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="simple-html-grid-icon-group-svg"
                @click=${(e: any) => callback(e)}
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6"
                />
            </svg>
        `;
    };

    /**
     * icon helper
     * @param callback
     * @returns
     */
    const addFilterGroupIcon = (add: boolean, callback: (e: any) => void) => {
        if (add) {
            return html`
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="currentColor"
                    class="simple-html-grid-icon-group-svg"
                    @click=${(e: any) => callback(e)}
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M12 10.5v6m3-3H9m4.06-7.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
                    />
                </svg>
            `;
        }
        return html`
            <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="simple-html-grid-icon-group-svg"
                @click=${(e: any) => callback(e)}
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M15 13.5H9m4.06-7.19-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z"
                />
            </svg>
        `;
    };

    /**
     * generate html for condition
     * @param arg
     * @param context
     * @returns
     */
    const condition = (arg: ConditionDraft, context: (GroupDraft | ConditionDraft)[]) => {
        // a new condition has no field yet, it is text until one is picked
        const field = arg.field ? ctx.gridInterface.getDatasource().getField(arg.field) : null;
        const formatter = field?.formatter ?? TextFormatter;
        const isDate = field?.type === 'date' || field?.type === 'datetime';
        const value = formatter.format(arg.value);

        // live(): the elements are kept between renders, what the user typed is in the input, not in lit
        let filterElement = html`<input
            .value=${live(value || '')}
            @keydown=${(e: any) => {
                if (e.key === 'Enter' && isDate) {
                    setTimeout(() => {
                        contextmenuDate(
                            ctx,
                            e,
                            e.target,
                            parseFilterText(formatter, e.target.value),

                            (value: Date | null) => {
                                arg.value = value;
                                renderFilterEditor(ctx, structuredClone(filterArg));
                            }
                        );
                    }, 2);
                }
            }}
            @input=${(e: any) => (arg.value = parseFilterText(formatter, e.target.value))}
            @change=${(e: any) => (arg.value = parseFilterText(formatter, e.target.value))}
            @click=${(e: any) => {
                if (isDate) {
                    setTimeout(() => {
                        contextmenuDate(
                            ctx,
                            e,
                            e.target,
                            parseFilterText(formatter, e.target.value),

                            (value: Date | null) => {
                                arg.value = value;
                                renderFilterEditor(ctx, structuredClone(filterArg));
                            }
                        );
                    }, 2);
                }
            }}
        />`;

        if (arg.operator === 'IN' || arg.operator === 'NOT_IN') {
            const value = Array.isArray(arg.value)
                ? arg.value.filter((e) => e !== '').join('\n')
                : arg.value === null || arg.value === undefined
                  ? ''
                  : String(arg.value);

            filterElement = html`<textarea
                .value=${live(value || '')}
                @change=${(e: any) => (arg.value = e.target.value.split('\n').filter((e: string) => e !== ''))}
            ></textarea>`;
        }

        if (arg.valueField !== undefined) {
            // compare with another field of the row, '' until it is picked
            const label = arg.valueField ? getColumnLabel(ctx, arg.valueField) : '';

            // same look as the other two pickers, it opens a menu the same way
            filterElement = html`<div
                class="grid-pick grid-text-center"
                data-tooltip=${text('filterEditor.pickValueAttribute.tooltip')}
                @click=${(e: MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    contextMenuAttributes(ctx, e, e.target as HTMLCellElement, (attribute) => {
                        removeContextMenu(ctx);
                        arg.valueField = attribute;
                        renderFilterEditor(ctx, structuredClone(filterArg));
                    });
                }}
            >
                ${label || text('filterEditor.pickValueAttribute')}
            </div>`;
        }

        return html`<div>
            <div class="grid-flex-column grid-condition">
                <div class="grid-flex">
                    <div class="grid-flex-1 grid-text-label">${text('filterEditor.label.field')}</div>
                    <div class="grid-flex-1 grid-text-label">${text('filterEditor.label.operator')}</div>
                    <div class="grid-flex-1 grid-text-label">${text('filterEditor.label.value')}</div>
                </div>
                <div class="grid-flex">
                    <div
                        class="grid-flex-1 grid-text-center grid-pick"
                        data-tooltip=${text('filterEditor.pickAttribute.tooltip')}
                        @click=${(e: MouseEvent) => {
                            e.preventDefault();
                            e.stopPropagation();
                            contextMenuAttributes(ctx, e, e.target as HTMLCellElement, (attribute) => {
                                removeContextMenu(ctx);
                                // the type comes from the datasource's fields, the condition has none
                                arg.field = attribute;
                                renderFilterEditor(ctx, structuredClone(filterArg));
                            });
                        }}
                    >
                        ${arg.field ? label(arg.field) : text('filterEditor.pickAttribute')}
                    </div>

                    <div
                        class="grid-flex-1 grid-text-center grid-pick"
                        data-tooltip=${text('filterEditor.pickOperator.tooltip')}
                        @click=${(e: MouseEvent) => {
                            e.preventDefault();
                            e.stopPropagation();
                            contextMenuOperator(ctx, e, e.target as HTMLCellElement, (operator) => {
                                removeContextMenu(ctx);
                                arg.operator = operator;

                                renderFilterEditor(ctx, structuredClone(filterArg));
                            });
                        }}
                    >
                        ${operatorName(arg.operator)}
                    </div>
                    <div class="grid-flex-1 grid-text-center ">${filterElement}</div>
                </div>
                <div class="grid-flex-reverse grid-m-4">
                    <div class="grid-m-4" data-tooltip=${text('filterEditor.deleteCondition.tooltip')}>
                        ${trashIcon(() => {
                            let x: number | null = null;
                            context.forEach((row, i) => {
                                if (row === arg) {
                                    x = i;
                                }
                            });
                            // splice(null) starts at 0 too
                            context.splice(x ?? 0, 1);
                            renderFilterEditor(ctx, structuredClone(filterArg));
                        })}
                    </div>
                    <div
                        class="grid-m-4"
                        data-tooltip=${text(arg.valueField !== undefined ? 'filterEditor.useValue.tooltip' : 'filterEditor.useAttribute.tooltip')}
                    >
                        ${inputSwitchIcon(arg, () => {
                            renderFilterEditor(ctx, structuredClone(filterArg));
                        })}
                    </div>
                </div>
            </div>
        </div>`;
    };

    /**
     * generate html for group
     * @param arg
     * @param context
     * @returns
     */
    const group = (arg: GroupDraft, context: (GroupDraft | ConditionDraft)[] | null): TemplateResult<1> => {
        // the conditions first, then the sub groups
        // (condition/group only change children from click handlers, so reading it once is the same)
        const args = arg.children;
        const conditions: TemplateResult<1>[] = [];
        const groupsArgs: TemplateResult<1>[] = [];
        for (const child of args) {
            if (isGroupDraft(child)) {
                groupsArgs.push(group(child, args));
            } else {
                conditions.push(condition(child, args));
            }
        }

        return html`<div>
            <div class="grid-flex-column grid-sub-group">
                <div class="grid-flex grid-group">
                    <div class="grid-flex grid-m-4">
                        <div
                            class="grid-m-4 grid-button-small grid-text-center grid-text-label"
                            data-tooltip=${text(arg.group === 'AND' ? 'filterEditor.operatorAnd.tooltip' : 'filterEditor.operatorOr.tooltip')}
                            @click=${() => {
                                arg.group = arg.group === 'AND' ? 'OR' : 'AND';
                                renderFilterEditor(ctx, structuredClone(filterArg));
                            }}
                        >
                            <span> ${text(arg.group === 'AND' ? 'filterEditor.operatorAnd' : 'filterEditor.operatorOr')}</span>
                        </div>
                        <div class="grid-m-4" data-tooltip=${text('filterEditor.wrapGroup.tooltip')}>
                            ${addFilterGroupIcon(false, () => {
                                arg.children = [{ group: 'AND', children: arg.children }];

                                renderFilterEditor(ctx, structuredClone(filterArg));
                            })}
                        </div>
                        <div class="grid-m-4" data-tooltip=${text('filterEditor.addSubGroup.tooltip')}>
                            ${addFilterGroupIcon(true, () => {
                                arg.children.push({ group: 'AND', children: [] });

                                renderFilterEditor(ctx, structuredClone(filterArg));
                            })}
                        </div>
                        <div class="grid-m-4" data-tooltip=${text('filterEditor.addCondition.tooltip')}>
                            ${addFilterConditionIcon(() => {
                                // a draft, filled in one pick at a time
                                arg.children.push({});
                                renderFilterEditor(ctx, structuredClone(filterArg));
                            })}
                        </div>
                        <div
                            class="grid-m-4"
                            data-tooltip=${text(context ? 'filterEditor.deleteGroup.tooltip' : 'filterEditor.clearAll.tooltip')}
                        >
                            ${trashIcon(() => {
                                if (context) {
                                    let x: number | null = null;
                                    context.forEach((row, i) => {
                                        if (row === arg) {
                                            x = i;
                                        }
                                    });
                                    // splice(null) starts at 0 too
                                    context.splice(x ?? 0, 1);
                                    renderFilterEditor(ctx, structuredClone(filterArg));
                                } else {
                                    arg.children = [];
                                    renderFilterEditor(ctx, structuredClone(filterArg));
                                }
                            })}
                        </div>
                    </div>
                </div>
                <div class="grid-flex-column grid-sub-group ">${conditions}</div>
                ${groupsArgs}
            </div>
        </div>`;
    };

    /**
     * closes the dialog, used by the titlebar X and the Close button
     */
    const closeEditor = () => closeFilterEditor(ctx);

    // drag the dialog around by its titlebar
    const headerTemplate = () => html`<div
        class="grid-text-title filter-editor-titlebar"
        @pointerdown=${(event: PointerEvent) => moveDialog(dialog, event)}
    >
        <span data-tooltip=${text('filterEditor.title.tooltip')}>${text('filterEditor.title')}</span>
        <span class="filter-editor-close" data-tooltip=${text('filterEditor.close.tooltip')} @click=${() => closeEditor()}>&#10005;</span>
    </div>`;

    /**
     * header filter inputs would otherwise keep showing text the applied filter no longer has
     * (and the next header filter edit would put it back)
     */
    const clearOldValues = () => {
        ctx.gridInterface.__clearHeaderFilterValues();
    };

    /**
     * applies the conditions that are complete, see draftToFilter. A copy: the dialog can stay open
     * and keep editing its own. Nothing left ("clear all") is no filter, like "Clear All Filters"
     */
    const applyFilter = () => {
        const datasource = ctx.gridInterface.getDatasource();
        const filter = draftToFilter(structuredClone(filterArg), datasource);
        datasource.filter(filter.children.length ? filter : null);
        clearOldValues();
        rebuildHeaderColumns(ctx);
    };

    const footerTemplate = () => {
        return html`<div class="grid-flex-reverse grid-m-4 filter-editor-footer">
            <div
                class="grid-button grid-text-center grid-button-primary"
                data-tooltip=${text('filterEditor.filterAndClose.tooltip')}
                @click=${() => {
                    removeContextMenu(ctx);
                    closeEditor();
                    applyFilter();
                }}
            >
                ${text('filterEditor.filterAndClose')}
            </div>
            <div
                class="grid-button grid-text-center"
                data-tooltip=${text('filterEditor.filterOnly.tooltip')}
                @click=${() => {
                    removeContextMenu(ctx);
                    applyFilter();
                }}
            >
                ${text('filterEditor.filterOnly')}
            </div>
            <div
                class="grid-button grid-text-center"
                data-tooltip=${text('filterEditor.closeButton.tooltip')}
                @click=${() => closeEditor()}
            >
                ${text('filterEditor.closeButton')}
            </div>
        </div>`;
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

    /**
     * render dialog
     */
    render(
        html`<div class="grid-flex-column grid-w-full grid-h-full">
                ${headerTemplate()}
                <div class="grid-overflow-auto grid-flex-1 simple-html-dialog-scroller">${group(filterArg, null)}</div>
                ${footerTemplate()}
            </div>
            ${resizeHandles()}`,
        dialog
    );

    if (opening) {
        // rendered before it is shown: showModal() moves the focus into what is there
        dialog.showModal();
        /**
         * position + size.
         * The css only gives a default size, left/top are set here so the dialog can be
         * dragged and resized without fighting the browser's centering (inset: 0, margin: auto).
         * Centered on the window, once it is shown and has its size
         */
        dialog.style.left = asPx(Math.max(0, Math.round((window.innerWidth - dialog.offsetWidth) / 2)));
        dialog.style.top = asPx(Math.max(0, Math.round((window.innerHeight - dialog.offsetHeight) / 2)));
    }
}

/**
 * Makes the filter editor's dialog and puts it on the body, closed: renderFilterEditor renders it and
 * shows it.
 */
function createFilterEditorDialog(ctx: Grid): HTMLDialogElement {
    const dialog = document.createElement('dialog');
    dialog.classList.add('simple-html-grid', 'filter-editor-content');
    // showModal() moves the focus to the element with autofocus: the dialog itself, not a value field
    // (which would show the keyboard on a phone). tabindex -1 makes it focusable, Tab goes on into it
    dialog.setAttribute('autofocus', '');
    dialog.tabIndex = -1;
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
