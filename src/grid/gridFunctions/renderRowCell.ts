import { html, nothing, render, svg } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import { type Entity, isGroupRow } from '../../datasource/entity';
import { isMissingValue } from '../../datasource/validatorRegistry';
import type { Grid } from '../grid';
import { ariaColIndex, setAria } from './ariaGrid';
import { asPx } from './asPx';
import { cellRowKeyNavigationCellRowHandler } from './cellRowKeyNavigationCellRowHandler';
import { overrideNumberText } from './cellText';
import type { ColType } from './colType';
import { contextmenuDate } from './contextmenuDate';
import { contextmenuRow } from './contextmenuRow';
import { createElement } from './createElement';
import { DIV } from './DIV';
import { fillDownKey } from './fillDown';
import { showCellFind } from './findBar';
import { getCellType } from './getCellType';
import { getColumnLabel } from './getColumnLabel';
import { gridText } from './gridText';
import type { HTMLCellElement } from './HTMLCellElement';
import { isRepeatedValue } from './isRepeatedValue';
import { firstLine, hasLineBreak, isMultilineCell, textLines } from './multilineText';
import { rangeDeleteKey } from './rangeClipboard';
import { rangeCellFocused, rangeKeydown, showCellRange } from './rangeSelection';
import { renderRowSelectorOf } from './renderRowSelector';
import { placeRowCell } from './rowHeights';
import { showCellEdited } from './showCellEdited';
import { showCellErrors } from './showCellErrors';
import { showCellMerged } from './showCellMerged';
import { openTextEditor } from './textEditor';
import { triggerScrollEvent } from './triggerScrollEvent';
import { undoRedoKey } from './undoRedoKey';

/**
 * the marker of a multiline cell with more lines than it shows: lines of text, 10x10px like the
 * icons of the row status, in the marker's colour (--simple-html-grid-multiline-color)
 */
const MORE_ICON = svg`<svg class="simple-html-grid-cell-more-icon" viewBox="0 0 10 10" aria-hidden="true" focusable="false">
    <path d="M1 1h8v2H1zM1 4h8v2H1zM1 7h5v2H1z" />
</svg>`;

/**
 * true for a key that types a character: `key` is one character (an emoji too, two code units),
 * without Ctrl, Alt or Cmd - or with Ctrl and Alt both, AltGr on Windows (@ on a Norwegian keyboard
 * is AltGr+2). Alt alone is a shortcut on Windows and Linux; a character typed with Option on a Mac
 * is left out with it
 */
function isTypedCharacter(event: KeyboardEvent): boolean {
    return Array.from(event.key).length === 1 && !event.metaKey && event.ctrlKey === event.altKey;
}

export function renderRowCell(
    ctx: Grid,
    cell: HTMLCellElement,
    row: number,
    column: number,
    celno: number,
    colType: ColType,
    cellType: string,
    attribute: string,
    rowData: Entity
) {
    const entity = ctx.gridInterface.getDatasource().getRow(row);

    // a group row has no cells, the grid hides them
    if (isGroupRow(entity)) {
        showCellErrors(ctx, cell, null, null);
        showCellEdited(ctx, cell, null, null);
        showCellMerged(ctx, cell, null, null);
        showCellRange(ctx, cell);
        showCellFind(ctx, cell, null, null);
        cell.classList.remove('simple-html-cell-deleted');
        return;
    }

    // its top and height in the row: more than a line in a row made taller (fitRows, rowHeights.ts)
    const lines = placeRowCell(ctx, cell, row, entity, colType, column, celno);
    // a cell taller than a line keeps its text on the first line: the input fills the cell (the pointer
    // finds it anywhere in it), its padding pushes the text up - the text of an input is in the middle
    // of its content box
    const config = ctx.gridInterface.__getGridConfig();
    const firstLinePadding = lines > 1 ? `padding-bottom:${asPx((lines - 1) * config.cellHeight)};` : '';

    // the cell element is the gridcell, the input in it the widget. A column with fewer fields than
    // the tallest one has empty cells under its last field: those are no cells for a screen reader
    setAria(cell, 'role', attribute ? 'gridcell' : 'none');
    setAria(cell, 'aria-colindex', attribute ? String(ariaColIndex(config, colType, column, celno)) : null);

    // a row marked for deletion: its text struck through, with the row status (GridConfig.rowStatus)
    cell.classList.toggle('simple-html-cell-deleted', config.rowStatus && entity?.__rowState === 'D');

    if (attribute) {
        const cellConfig = ctx.gridInterface.__getGridConfig().columns[attribute];
        const datasource = ctx.gridInterface.getDatasource();

        // the field's type, and the type of this cell - dynamicCellTypeColumn can change it per row
        const field = datasource.getField(attribute);
        const fieldType = field.type;
        const cellConfigType = getCellType(ctx, attribute, entity);
        const formatter = datasource.getFormatter(attribute, cellConfigType);

        // after an edit: the field was validated, show its errors and the row's, and whether it is
        // edited now. Not by rendering the cell again, that would put the formatted value back into
        // the input while the user types. Not for a multiline cell, it is edited in the text editor
        const showEdit = () => {
            showCellErrors(ctx, cell, entity, attribute);
            showCellEdited(ctx, cell, entity, attribute, formatter);
            renderRowSelectorOf(ctx, row);
        };

        // the undo history: what the user types in the cell, until the focus leaves it, is one step
        const history = datasource.getDataContainer().__history;
        const typeValue = (text: string) => {
            history.typing(() => {
                entity[attribute] = formatter.parse(text);
            });
        };

        let showPlaceHolder = true;
        if (config.placeholderRowCurrentEntityOnly) {
            if (rowData !== ctx.gridInterface.getDatasource().currentEntity) {
                showPlaceHolder = false;
            }
        }

        let dimmed = '';

        // the isReadonly hook decides, and when it gives no answer the column's readonly
        const cellReadOnly = ctx.gridInterface.__isCellReadonly(entity, attribute);

        if (!config.readonly && cellReadOnly) {
            dimmed = 'simple-html-readonly';
        }

        // the stripes of a required field while its value is missing - what the required rule fails
        // on, 0 included. Only where the user can fill it in
        const required = field.validate.some((rule) => rule.id === 'required');
        if (!config.readonly && !cellReadOnly && required && isMissingValue(entity?.[attribute])) {
            dimmed = 'simple-html-mandatory';
        }

        // a checkbox shows the raw value, every other cell the text from the field's formatter
        const checked = Boolean(entity?.[attribute]);
        const formatted = formatter.format(entity?.[attribute]);
        const value = fieldType === 'number' ? overrideNumberText(formatted, cellConfig.numberOverride) : formatted;

        // the name of the input for a screen reader: the column's label, as in the header
        const label = getColumnLabel(ctx, attribute);

        // text of several lines (multilineText.ts): the input shows the first line and is readonly,
        // the text editor edits it. `more`: there are lines after the first, the cell has a marker
        // and the whole text in its tooltip
        const multiline = isMultilineCell(field, cellConfigType, value);
        const more = multiline && hasLineBreak(value);
        // in a cell of more than a line (fitRows): the lines after the first that it has room for are
        // shown under the input. The marker only when some lines are not shown, on the last line
        const textLineList = more ? textLines(value) : [];
        const linesUnder = textLineList.slice(1, lines);
        const showMarker = more && textLineList.length > lines;

        // the validation errors: a class and a tooltip on the cell element
        showCellErrors(ctx, cell, entity, attribute, more ? value : undefined);

        // the classes of the cellClass hook, '' without one
        const cellClass = ctx.gridInterface.__getCellClass(entity, attribute);
        const backgroundClass = `${dimmed} ${cellClass.background}`;

        // dims cells that repeat the row above, resets at the start of every group
        const repeated = isRepeatedValue(ctx, row, attribute);
        const repeatedClass = repeated ? ' simple-html-grid-repeated-value' : '';

        if (cellConfigType === 'boolean') {
            render(
                html` <div style="width:100%;height:100%;">
                    <div data-attribute-dimmed=${attribute} class=${backgroundClass}></div>
                    <input
                        style=${lines > 1 ? `width:100%;height:${asPx(config.cellHeight)};bottom:auto;` : 'width:100%;'}
                        data-attribute=${attribute}
                        data-repeated-value=${repeated ? 'true' : 'false'}
                        aria-label=${label}
                        .checked=${live(checked)}
                        type="checkbox"
                        class=${`cellpos-${colType}-${row}-${column}-${celno} ${cellClass.input}${repeatedClass}`}
                        @contextmenu=${(e: MouseEvent) => {
                            e.preventDefault();
                            contextmenuRow(ctx, e, cell, row, column, celno, colType, cellType, attribute, rowData);
                        }}
                        @keydown=${(e: any) => {
                            // the ranges of cells: Alt+Shift+arrows, Esc, Delete (rangeSelection.ts)
                            if (
                                rangeKeydown(ctx, e, row, attribute) ||
                                rangeDeleteKey(ctx, e) ||
                                fillDownKey(ctx, e, row, attribute)
                            ) {
                                return;
                            }
                            if (undoRedoKey(ctx, e, entity, attribute)) {
                                return;
                            }
                            return cellRowKeyNavigationCellRowHandler(ctx, cell, row, column, celno, colType, e, '');
                        }}
                        @focus=${() => rangeCellFocused(ctx, row, attribute)}
                        @click=${(e: MouseEvent) => {
                            // Shift+click and Ctrl/Cmd+click make ranges of cells (rangeSelection.ts): the
                            // checkbox is not checked by them. Shift keeps the active cell, and its row
                            if (e.shiftKey || e.ctrlKey || e.metaKey) {
                                e.preventDefault();
                            }
                            if (e.shiftKey) {
                                return;
                            }
                            ctx.gridInterface.getDatasource().setRowAsCurrentEntity(row);
                            triggerScrollEvent(ctx);
                        }}
                        @change=${(e: any) => {
                            if (!cellReadOnly && !config.readonly) {
                                if (cellConfig.allowPasteClearOnly) {
                                    // nothing
                                } else {
                                    // booleans are not parsed, the checkbox gives the value
                                    entity[attribute] = !e.target.checked;
                                    e.target.checked = Boolean(entity[attribute]);
                                    showEdit();
                                }
                            }
                        }}
                    />
                </div>`,
                cell as any
            );
        } else {
            let skipFocus = false;

            // the column's focus button is shown in this cell (ColumnConfig.focusButton)
            const hasFocusButton = () => {
                switch (cellConfig.focusButton) {
                    case 'SHOW_IF_GRID_NOT_READONLY':
                        return !config.readonly;
                    case 'SHOW_IF_GRID_AND_CELL_NOT_READONLY':
                        return !config.readonly && !cellReadOnly;
                    case 'ALWAYS':
                        return true;
                    default:
                        return false;
                }
            };

            // the text editor of a multiline cell: readonly where the cell can not be typed in
            const editable = !config.readonly && !cellReadOnly && !cellConfig.allowPasteClearOnly;
            const openEditor = (typed?: string) =>
                openTextEditor(
                    ctx,
                    {
                        cell,
                        row: entity,
                        field: attribute,
                        formatter,
                        readonly: !editable,
                        tab: (event) => cellRowKeyNavigationCellRowHandler(ctx, cell, row, column, celno, colType, event, '')
                    },
                    typed
                );

            // the marker of a multiline cell with more lines, it describes the input for a screen
            // reader. An id per cell on screen: the row is the displayed row
            const moreId = `${ctx.ariaIdPrefix}-more-${colType}-${row}-${column}-${celno}`;

            render(
                html` <div style="width:100%;height:100%;">
                    <div data-attribute-dimmed=${attribute} class=${backgroundClass}></div>
                    ${
                        // the other lines of a multiline cell in a taller row: under the input, which is
                        // transparent and gets the pointer. A screen reader has the marker's description
                        linesUnder.length
                            ? html`<div
                                  class=${`simple-html-grid-cell-lines ${cellClass.input}${repeatedClass}`}
                                  aria-hidden="true"
                                  style=${`top:${asPx(config.cellHeight)};line-height:${asPx(config.cellHeight)};`}
                              >${linesUnder.join('\n')}</div>`
                            : nothing
                    }
                    <input
                        aria-label=${label}
                        data-attribute=${attribute}
                        data-repeated-value=${repeated ? 'true' : 'false'}
                        style=${`${cellConfigType === 'number' ? 'text-align: right;' : ''}width:100%;height:100%;${firstLinePadding}`}
                        .value=${live(multiline ? firstLine(value) : value)}
                        class=${`simple-html-grid-cell-input cellpos-${colType}-${row}-${column}-${celno}  ${cellClass.input}${repeatedClass}${more ? ' simple-html-grid-cell-multiline' : ''}`}
                        .readOnly=${multiline || !!config.readonly || cellReadOnly}
                        aria-describedby=${more ? moreId : nothing}
                        placeholder=${showPlaceHolder ? cellConfig.placeholderRow : ''}
                        @contextmenu=${(e: MouseEvent) => {
                            e.preventDefault();
                            contextmenuRow(ctx, e, cell, row, column, celno, colType, cellType, attribute, rowData);
                        }}
                        @click=${(e: any) => {
                            // Shift+click makes a range of cells from the active cell (rangeSelection.ts),
                            // which stays the active cell: its row stays the current row
                            if (e.shiftKey) {
                                return;
                            }
                            ctx.gridInterface.getDatasource().setRowAsCurrentEntity(row);
                            triggerScrollEvent(ctx);
                            // not for a Ctrl/Cmd+click: it adds a range of cells
                            if (!cellReadOnly && !config.readonly && !e.ctrlKey && !e.metaKey) {
                                setTimeout(() => {
                                    if (cellConfigType === 'date' || cellConfigType === 'datetime') {
                                        const current = entity[attribute];
                                        contextmenuDate(
                                            ctx,
                                            e,
                                            cell,
                                            // a Date as it is. Text in the data (an iso string) is read by
                                            // the formatter, anything else opens the picker on today
                                            typeof current === 'string' ? formatter.parse(current) : current,
                                            (value: Date | null) => {
                                                rowData[attribute] = value;
                                                triggerScrollEvent(ctx);
                                            }
                                        );
                                    }
                                });
                            }
                            setTimeout(() => {
                                ctx.gridInterface.__callSubscribers('cell-click', {
                                    cell,
                                    row,
                                    column,
                                    celno,
                                    colType,
                                    cellType,
                                    attribute,
                                    rowData,
                                    originalEvent: e //incase user want to reuse
                                });
                            });
                        }}
                        @dblclick=${() => {
                            if (multiline) {
                                openEditor();
                            }
                        }}
                        @mousedown=${(e: MouseEvent) => {
                            if (e.button === 2) {
                                skipFocus = true;
                            }
                        }}
                        @focus=${(e: any) => {
                            if (skipFocus) {
                                skipFocus = false;
                                return;
                            }

                            cell.$focused = true;
                            // another cell than the active one: the ranges of cells are cleared
                            rangeCellFocused(ctx, row, attribute);

                            ctx.gridInterface.__callSubscribers('cell-row-focus', {
                                cell,
                                row,
                                column,
                                celno,
                                colType,
                                cellType,
                                attribute,
                                rowData,
                                originalEvent: e //incase user want to reuse
                            });

                            const addFocusButton = () => {
                                const input = cell.getElementsByClassName('simple-html-grid-cell-input')[0] as HTMLElement;
                                if (input) {
                                    input.style.right = asPx(30);
                                }

                                const el = createElement(DIV, 'simple-html-grid-focus-button');
                                el.style.position = 'absolute';
                                el.style.top = asPx(0);
                                // on the first line of a cell taller than a line, with the text
                                if (lines > 1) {
                                    el.style.height = asPx(config.cellHeight);
                                } else {
                                    el.style.bottom = asPx(0);
                                }
                                el.style.right = asPx(0);
                                el.style.width = asPx(30);
                                el.onmousedown = (event: MouseEvent) => {
                                    // dont steal focus from the cell input - its blur removes this button
                                    // after 100ms, so a slow click (mousedown -> mouseup) lost its target
                                    event.preventDefault();
                                };
                                el.onclick = () => {
                                    ctx.gridInterface.__callSubscribers('cell-focus-button-click', {
                                        cell,
                                        row,
                                        column,
                                        celno,
                                        colType,
                                        cellType,
                                        attribute,
                                        rowData,
                                        target: e.target, // so user can set focus back to cell
                                        originalEvent: e //incase user want to reuse
                                    });
                                };

                                el.innerText = '...';
                                cell.appendChild(el);
                            };

                            if (hasFocusButton()) {
                                addFocusButton();
                            }

                            renderRowCell(ctx, cell, row, column, celno, colType, cellType, attribute, rowData);
                        }}
                        @blur=${() => {
                            // I need to delay this incase someone clicks on focus button
                            setTimeout(() => {
                                const focus = cell.getElementsByClassName('simple-html-grid-focus-button')[0];
                                if (focus) {
                                    if (focus.parentElement) {
                                        focus.parentElement.removeChild(focus);
                                    }
                                }
                                const input = cell.getElementsByClassName('simple-html-grid-cell-input')[0] as HTMLElement;
                                if (input) {
                                    // same as null, style properties turn null into ''
                                    input.style.right = '';
                                }
                            }, 100);

                            cell.$focused = false;
                            // the typing in this cell is done: typing in it again is a new step
                            history.endTyping();
                        }}
                        @keydown=${(e: any) => {
                            // the ranges of cells: Alt+Shift+arrows, Esc, Delete (rangeSelection.ts)
                            if (
                                rangeKeydown(ctx, e, row, attribute) ||
                                rangeDeleteKey(ctx, e) ||
                                fillDownKey(ctx, e, row, attribute)
                            ) {
                                return;
                            }
                            // Ctrl+Z / Ctrl+Y, unless the user is typing in the cell: then they are the input's
                            if (undoRedoKey(ctx, e, entity, attribute)) {
                                return;
                            }

                            // Space in a cell with a focus button: as a click on the button
                            const focusButtonSpace = e.code === 'Space' && hasFocusButton();
                            if (focusButtonSpace) {
                                ctx.gridInterface.__callSubscribers('cell-focus-button-click', {
                                    cell,
                                    row,
                                    column,
                                    celno,
                                    colType,
                                    cellType,
                                    attribute,
                                    rowData,
                                    target: e.target,
                                    originalEvent: e //incase user want to reuse
                                });
                            }

                            // a multiline cell: Enter and F2 open the text editor, and so does typing a
                            // character where the cell can be edited - the character goes at the end
                            if (multiline && !e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'Enter' || e.key === 'F2')) {
                                e.preventDefault();
                                openEditor();
                                return;
                            }
                            if (multiline && editable && !focusButtonSpace && isTypedCharacter(e)) {
                                e.preventDefault();
                                openEditor(e.key);
                                return;
                            }

                            let overrideKey = '';
                            if (!config.readonly && !cellReadOnly && e.code === 'Enter') {
                                overrideKey = 'ArrowDown';
                            }

                            return cellRowKeyNavigationCellRowHandler(ctx, cell, row, column, celno, colType, e, overrideKey);
                        }}
                        @input=${(e: any) => {
                            // the input of a multiline cell is readonly, and its value has no line
                            // breaks: it must never be written to the row
                            if (multiline) {
                                return;
                            }
                            if (cellConfig.allowPasteClearOnly) {
                                e.target.value = formatter.format(entity[attribute]);
                                return;
                            }

                            if (!config.readonly && !cellReadOnly) {
                                // typing ends the ranges of cells, as moving to another cell does
                                ctx.gridInterface.clearRanges();
                                typeValue(e.target.value);
                                showEdit();
                            }
                        }}
                        @change=${(e: any) => {
                            if (multiline) {
                                return;
                            }
                            if (cellConfig.allowPasteClearOnly) {
                                e.target.value = formatter.format(entity[attribute]);
                                return;
                            }

                            if (!config.readonly && !cellReadOnly) {
                                typeValue(e.target.value);
                                showEdit();
                            }
                        }}
                    />
                    ${
                        // the marker describes the input for a screen reader also when every line is
                        // shown: the input has the first line. In a taller cell it is on the last line
                        more
                            ? html`<span
                                  class="simple-html-grid-cell-more"
                                  id=${moreId}
                                  aria-hidden="true"
                                  style=${lines > 1 ? `top:${asPx((lines - 0.5) * config.cellHeight - 5)};` : nothing}
                                  >${showMarker ? MORE_ICON : nothing}<span class="simple-html-visually-hidden"
                                      >${gridText(ctx, 'cell.multiline.more')}</span
                                  ></span
                              >`
                            : nothing
                    }
                </div>`,
                cell as any
            );
        }

        // after the template: a template of another kind removes what is after it, the marker too
        showCellEdited(ctx, cell, entity, attribute, formatter);
        // the flash of a value a merge changed (upsert)
        showCellMerged(ctx, cell, entity, attribute);
    } else {
        showCellErrors(ctx, cell, entity, null);
        render(html`<div data-dimmed-emtpy class="simple-html-dimmed"></div>`, cell as any);
        showCellEdited(ctx, cell, null, null);
        showCellMerged(ctx, cell, null, null);
    }

    // in a range of cells or not: the cell is reused for other rows and fields while scrolling
    showCellRange(ctx, cell);
    // a match of Find (Ctrl+F) or not, the same
    showCellFind(ctx, cell, entity, attribute || null);
}
