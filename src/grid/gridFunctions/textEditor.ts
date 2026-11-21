import { html, render } from 'lit-html';
import type { Entity } from '../../datasource/entity';
import type { Formatter } from '../../datasource/formatter';
import type { Grid } from '../grid';
import { asPx } from './asPx';
import { createElement } from './createElement';
import { DIV } from './DIV';
import { getColumnLabel } from './getColumnLabel';
import { getElementByClassName } from './getElementByClassName';
import { gridText } from './gridText';
import { normalizeLineBreaks } from './multilineText';
import { removeContextMenu } from './removeContextMenu';
import { moveMenu, popoverParent } from './showMenu';
import { triggerScrollEvent } from './triggerScrollEvent';

/**
 * The editor of a multiline cell (multilineText.ts): a textarea in a popover over the cell. The
 * grid's one open editor is `ctx.textEditor`.
 */

/**
 * the editor's least width in px: a narrow column still gets room to write in. It is at least as
 * wide as the cell
 */
const MIN_WIDTH = 300;

/**
 * the lines of text the textarea shows (its `rows`). It can be resized
 */
const ROWS = 6;

/**
 * The open editor, `ctx.textEditor`
 */
export interface TextEditor {
    /** the popover */
    element: HTMLElement;
    /**
     * Closes it. Does nothing when it is closed already
     * @param save write the text to the row: once, when it changed. Not in a readonly editor
     * @param returnFocus the focus goes back to the cell when it was in the editor - not for a click
     * outside it, the click puts the focus where it is
     */
    close(save: boolean, returnFocus: boolean): void;
}

/**
 * The cell an editor is opened for
 */
export interface TextEditorCell {
    /** the cell element: the editor is put over it */
    cell: HTMLElement;
    /** the cell's row */
    row: Entity;
    /** the cell's field */
    field: string;
    /** the formatter the cell shows its value with: `format` gives the text, `parse` what is saved */
    formatter: Formatter;
    /** shows the text only: the grid or the cell is readonly, or the column is `allowPasteClearOnly` */
    readonly: boolean;
    /** the cell's Tab, called with the Tab's keydown once the editor is closed: the next cell */
    tab: (event: KeyboardEvent) => void;
}

/**
 * Opens the editor over a cell, the focus in it - and closes the one that is open, saving it, and
 * the open menu. The textarea has the cell's text, the caret at its end. Its label is the column's.
 *
 * - Esc closes it, the value as it was. Ctrl+Enter (Cmd+Enter) saves and closes. Enter is a new line
 * - Tab saves and closes, and goes on to the next cell as Tab in the cell does (Shift+Tab back)
 * - a click outside it saves and closes it, and so does scrolling the grid (the wheel, a swipe, the
 *   scrollbars) or opening a menu
 * - after Esc, Ctrl+Enter and Tab the focus is back in the cell
 *
 * Saving writes the row once, with the text's line breaks as LF, when the text changed: one step of
 * the undo history, validated as an edit. Then the rows are rendered again.
 *
 * A popover (`popover="manual"`, the top layer) like the menus, in the dialog or popover the grid is
 * in (popoverParent). Kept in the window: moved left at the right edge, up at the bottom.
 * @param typed a character typed in the cell that opened it: put at the end of the text
 */
export function openTextEditor(ctx: Grid, target: TextEditorCell, typed = '') {
    ctx.textEditor?.close(true, true);
    removeContextMenu(ctx);

    const { cell, row, field, formatter, readonly } = target;
    // the cell input, it gets the focus back
    const returnFocus = document.activeElement;
    // the cell counts as being edited while the editor is open: a merge (datasource.upsert) does not
    // overwrite it, a server value for it is a conflict - see History.startEditing
    const history = ctx.gridInterface.getDatasource().getDataContainer().__history;

    const element = createElement(DIV, 'simple-html-grid');
    element.classList.add('simple-html-grid-reset', 'simple-html-grid-popover', 'simple-html-grid-text-editor');
    element.popover = 'manual';
    const hintId = `${ctx.ariaIdPrefix}-text-editor-hint`;
    render(
        html`<textarea
                class="simple-html-grid-text-editor-input"
                rows=${ROWS}
                aria-label=${getColumnLabel(ctx, field)}
                aria-describedby=${hintId}
                .readOnly=${readonly}
            ></textarea>
            <div class="simple-html-grid-text-editor-hint" id=${hintId}>
                ${gridText(ctx, readonly ? 'cell.multiline.hintReadonly' : 'cell.multiline.hint')}
            </div>`,
        element
    );
    const textarea = element.querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = formatter.format(row[field]);
    // read back: a browser gives the line breaks as LF. Unchanged is what it gives back now
    const original = textarea.value;
    if (typed && !readonly) {
        textarea.value = original + typed;
    }

    const cellRect = cell.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    textarea.style.width = asPx(Math.min(Math.max(cellRect.width, MIN_WIDTH), viewportWidth));

    popoverParent(cell).appendChild(element);
    element.showPopover();
    placeTextEditor(element, cellRect);

    // the listeners of this editor, removed when it closes
    const abort = new AbortController();
    const signal = abort.signal;

    const editor: TextEditor = {
        element,
        close(save, focusCell) {
            if (ctx.textEditor !== editor) {
                return;
            }
            ctx.textEditor = null;
            abort.abort();

            const text = textarea.value;
            const hadFocus = element.contains(document.activeElement);
            element.remove();

            if (save && !readonly && text !== original) {
                // one write: one step of the undo history, the field is validated
                row[field] = formatter.parse(normalizeLineBreaks(text));
                triggerScrollEvent(ctx);
            }
            if (!readonly) {
                history.endTyping();
            }
            if (focusCell && hadFocus && returnFocus instanceof HTMLElement && returnFocus.isConnected) {
                returnFocus.focus({ preventScroll: true });
            }
        }
    };
    ctx.textEditor = editor;

    textarea.addEventListener(
        'keydown',
        (event) => {
            // the keys of an input method (IME) while it composes are its own
            if (event.isComposing) {
                return;
            }
            if (event.key === 'Escape') {
                // canceled: a modal dialog the grid is in does not close on it
                event.preventDefault();
                editor.close(false, true);
            } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                editor.close(true, true);
            } else if (event.key === 'Tab' && !event.ctrlKey && !event.altKey && !event.metaKey) {
                editor.close(true, true);
                target.tab(event);
            }
        },
        { signal }
    );

    // a click outside it saves - on the press, before the click moves the focus. The path and not the
    // target: in a shadow root the document gets the shadow host as the target
    document.addEventListener(
        'mousedown',
        (event) => {
            if (!event.composedPath().includes(element)) {
                editor.close(true, false);
            }
        },
        { capture: true, signal }
    );
    // scrolling the grid: the cell is moving away. The two scrollers are what scrolls, the wheel, a
    // swipe and the scrollbars move them (addScrollEventListeners). Not the views of the rows: they
    // follow the scrollers, and the browser scrolls them too, to show a cell that gets the focus. The
    // wheel takes the focus from the cell (the grid's own wheel listener), also where the grid does
    // not scroll any further
    for (const scroller of ['simple-html-grid-body-scroller', 'simple-html-grid-middle-scroller']) {
        getElementByClassName(ctx.element, scroller).addEventListener('scroll', () => editor.close(true, false), { signal });
    }
    ctx.element.addEventListener('wheel', () => editor.close(true, false), { passive: true, signal });

    textarea.focus({ preventScroll: true });
    // after the focus: the cell input's blur ended the editing of the cell (endTyping)
    if (!readonly) {
        history.startEditing(row, field);
    }
    // setting the value put the caret at the end, set it there anyway: the focus does not move it
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    textarea.scrollTop = textarea.scrollHeight;
}

/**
 * Closes the grid's editor, when one is open
 * @param save write the text to the row, when it changed
 */
export function closeTextEditor(ctx: Grid, save = true) {
    ctx.textEditor?.close(save, true);
}

/**
 * Puts the editor over the cell, its top left corner on the cell's - and keeps it in the window:
 * moved left when it sticks out on the right, and up when it sticks out at the bottom, its bottom
 * edge on the cell's then
 */
function placeTextEditor(element: HTMLElement, cellRect: DOMRect) {
    moveMenu(element, cellRect.left, cellRect.top);
    const rect = element.getBoundingClientRect();
    // the window without its scrollbars
    const width = document.documentElement.clientWidth;
    const height = document.documentElement.clientHeight;
    const left = cellRect.left + rect.width > width ? Math.max(0, width - rect.width) : cellRect.left;
    const top = cellRect.top + rect.height > height ? Math.max(0, cellRect.bottom - rect.height) : cellRect.top;
    moveMenu(element, left, top);
}
