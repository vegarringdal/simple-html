import { html, render } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import type { Entity } from '../../datasource/entity';
import type { FindResult } from '../findResult';
import type { Grid } from '../grid';
import { type FindAnchor, type FindMatch, findMatches, matchAtOrAfter } from './findMatches';
import { getLayoutFields } from './getLayoutFields';
import { gridText } from './gridText';
import type { HTMLCellElement } from './HTMLCellElement';
import { bodyCellOf, focusCellInput, forEachCellOnScreen, scrollCellIntoView } from './rangeSelection';
import { triggerScrollEvent } from './triggerScrollEvent';

/**
 * Find in the grid: Ctrl+F (Cmd+F) with the focus in the grid opens a find bar over its top right
 * corner - a text input, the count ("3 of 17"), previous and next, close. The model (which cells match,
 * in which order) is findMatches.ts.
 *
 * - typing finds as it goes, FIND_DELAY_MS after the last key: the cells that show the text get the
 *   class `simple-html-cell-find-match`, the current one `simple-html-cell-find-current`, and the grid
 *   scrolls to the current one. It starts at the cell that had the focus, and stays on the current
 *   match while it still matches
 * - Enter / F3 the next match, Shift+Enter / Shift+F3 the previous, wrapping at the ends. The focus
 *   stays in the input, as in a browser
 * - Esc (or the close button) closes it: the focus goes to the cell of the current match, which is the
 *   active cell and its row the current row - else back to where it was
 * - it follows the data while it is open: rows set, filtered, sorted, grouped, values changed, the
 *   layout changed - the matches are found again, the current one kept while it still matches (else the
 *   next one after it). The grid does not scroll for that
 *
 * The bar is an element of the grid, the first child of the grid element (absolute, over the panel):
 * the theme reaches it, and it scrolls with the page. Made the first time it opens, then hidden and
 * shown. Its state is `ctx.findBar`.
 */

/** how long (ms) after the last key the text is looked for, and after the last change of the data */
export const FIND_DELAY_MS = 150;

/** the class of a cell that shows the text, and of the current match */
const MATCH_CLASS = 'simple-html-cell-find-match';
const CURRENT_CLASS = 'simple-html-cell-find-current';

/**
 * The state of the find bar of a grid, `ctx.findBar`: made the first time it opens
 */
export interface FindBar {
    /** the bar: a search region */
    element: HTMLElement;
    open: boolean;
    /** the text in the input */
    text: string;
    /** the matches, in the grid's order (findMatches) */
    matches: FindMatch[];
    /** the fields of the matches by row, for the classes of a cell */
    cells: Map<Entity, Set<string>>;
    /** the current match: an index in `matches`, -1 for none */
    index: number;
    /** where the next search looks from: the current match, else the cell that had the focus */
    anchor: FindAnchor | null;
    /** the cell that had the focus when it opened: Esc goes back to it when there is no match */
    origin: FindAnchor | null;
    /** what else in the grid had the focus when it opened - a header filter, a column header */
    returnFocus: HTMLElement | null;
    /** the search that waits for the typing or the data to stop, see scheduleFind */
    timer: ReturnType<typeof setTimeout> | null;
    /** the search that waits was the user typing: it scrolls to the current match */
    scrollWhenFound: boolean;
    /** what the last find-change sent, as JSON: it is sent when that changes */
    sent: string;
}

/**
 * Ctrl+F (Cmd+F on a Mac) by the letter the key types (`key`, Ctrl does not change it): on Dvorak the
 * key that types f. On a layout without Latin letters (Cyrillic, Greek) `key` is a letter of its own,
 * then by the key's place (`code`), where F is on a US keyboard
 */
function isFindKey(event: KeyboardEvent): boolean {
    const letter = /^[a-z]$/i.test(event.key) ? event.key.toLowerCase() === 'f' : event.code === 'KeyF';
    return (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && letter;
}

/**
 * The grid element's keydown, for every key in the grid (createDom): Ctrl+F / Cmd+F opens the find bar
 * (and selects its text when it is open) instead of the browser's find; F3 / Shift+F3 while it is open
 * go to the next / previous match. A key already used (canceled) is left alone. Outside the grid -
 * the menus, the editors, the filter editor are on the body - Ctrl+F is the browser's
 */
export function findKeydown(ctx: Grid, event: KeyboardEvent) {
    if (event.defaultPrevented) {
        return;
    }
    if (isFindKey(event)) {
        event.preventDefault();
        openFind(ctx, { focus: true });
        return;
    }
    if (ctx.findBar?.open && event.key === 'F3' && !event.ctrlKey && !event.altKey && !event.metaKey) {
        event.preventDefault();
        findStep(ctx, event.shiftKey ? -1 : 1);
    }
}

/**
 * Does an element of the find bar have the focus: the wheel and a swipe leave it there
 * (addScrollEventListeners), Esc and the close button move it into the grid
 */
export function findBarHasFocus(ctx: Grid): boolean {
    const root = ctx.element.getRootNode() as Partial<DocumentOrShadowRoot>;
    return !!ctx.findBar?.open && ctx.findBar.element.contains(root.activeElement ?? null);
}

/**
 * Opens the find bar, for Ctrl+F, `gridInterface.find()` and `openFind()`. When it was closed, the
 * cell with the focus is where the search starts, and where Esc goes back to without a match (Ctrl+F
 * from another cell while it is open: there). Nothing before the dom is made.
 * @param options.text the text to find, else the one it had
 * @param options.focus the focus into the input, its text selected - as Ctrl+F does
 */
export function openFind(ctx: Grid, options: { text?: string; focus: boolean }) {
    if (!ctx.domCreated) {
        return;
    }
    const bar = ctx.findBar ?? makeFindBar(ctx);
    if (!bar.open) {
        rememberFocus(ctx, bar);
        bar.anchor = bar.origin;
        bar.open = true;
        bar.element.hidden = false;
    } else if (options.focus && !findBarHasFocus(ctx)) {
        // Ctrl+F again from a cell: Esc without a match goes back there. The search goes on from the
        // current match
        rememberFocus(ctx, bar);
    }
    if (options.text !== undefined) {
        bar.text = options.text;
    }
    // now, not after a wait: the count is returned, and Ctrl+F shows what the text finds right away
    runFind(ctx, true);
    if (options.focus) {
        const input = findInput(bar);
        input.focus({ preventScroll: true });
        input.select();
    }
}

/**
 * Closes the find bar: the matches are not shown any more, the text is kept for the next time. When
 * the focus was in the bar (Esc, the close button) it goes to the cell of the current match - the
 * active cell now, its row the current row - else back to the cell (or what else in the grid) it came
 * from. `find-change` is sent.
 * @param moveFocus false: the focus is left where it is - the grid leaves the page (disconnectElement)
 */
export function closeFind(ctx: Grid, moveFocus = true) {
    const bar = ctx.findBar;
    if (!bar?.open) {
        return;
    }
    const hadFocus = moveFocus && findBarHasFocus(ctx);
    if (hadFocus && bar.timer !== null) {
        // a search waits (the typing, a sort): the rows of the matches are the ones displayed now
        runFind(ctx, false);
    }
    const match = bar.matches[bar.index];

    clearTimeout(bar.timer ?? undefined);
    bar.timer = null;
    bar.open = false;
    bar.matches = [];
    bar.cells = new Map();
    bar.index = -1;

    if (hadFocus) {
        focusAfterClose(ctx, bar, match);
    }
    bar.element.hidden = true;
    forEachCellOnScreen(ctx, (cell) => showCellFindOf(ctx, cell));
    renderFindBar(ctx, bar);
    sendChange(ctx, bar);
}

/**
 * The next (`step` 1) or previous (-1) match, wrapping at the ends: it is the current one, the grid
 * scrolls to it. A search that waits for the typing to stop is done first, and shows its first match.
 * @returns the cell of the current match, null without one
 */
export function findStep(ctx: Grid, step: 1 | -1): FindResult['current'] {
    const bar = ctx.findBar;
    if (!bar?.open) {
        return null;
    }
    if (bar.timer !== null) {
        // what was typed is not looked for yet: its first match is the one to see now
        runFind(ctx, true);
        return getFindResult(ctx).current;
    }
    if (!bar.matches.length) {
        return null;
    }
    bar.index = (bar.index + step + bar.matches.length) % bar.matches.length;
    const match = bar.matches[bar.index];
    bar.anchor = { entity: match.entity, field: match.field, row: match.row };
    showCurrent(ctx, bar, true);
    return getFindResult(ctx).current;
}

/**
 * The data changed (Grid.rebuild, an upsert, values set - see GridInterface): the matches are found
 * again when the changes stop, FIND_DELAY_MS after the last one. Nothing while the bar is closed
 */
export function findDataChanged(ctx: Grid) {
    if (ctx.findBar?.open) {
        scheduleFind(ctx, false);
    }
}

/**
 * What the find has found now, for `gridInterface.getFind()` and `find-change`
 */
export function getFindResult(ctx: Grid): FindResult {
    const bar = ctx.findBar;
    if (!bar) {
        return { open: false, text: '', count: 0, position: 0, current: null };
    }
    const match = bar.matches[bar.index];
    return {
        open: bar.open,
        text: bar.text,
        count: bar.matches.length,
        position: bar.index + 1,
        current: match ? { row: match.row, field: match.field } : null
    };
}

/**
 * Shows whether a body cell shows the text searched for: the classes, for renderRowCell - the cells are
 * reused while scrolling, the classes follow the row and field the cell shows. A group row's cell and
 * an empty cell under the last field of a column are no match.
 * @param entity the row the cell shows, null for a group row
 * @param field the field of the cell, null for an empty cell
 */
export function showCellFind(ctx: Grid, cell: HTMLElement, entity: Entity | null, field: string | null) {
    const bar = ctx.findBar;
    const match = !!(bar?.open && entity && field && bar.cells.get(entity)?.has(field));
    const current = match && bar?.matches[bar.index];
    cell.classList.toggle(MATCH_CLASS, match);
    cell.classList.toggle(CURRENT_CLASS, !!current && current.entity === entity && current.field === field);
}

/**
 * showCellFind for a cell element, from what it shows (its `$` fields): for the cells on screen when
 * the matches changed, without rendering them
 */
function showCellFindOf(ctx: Grid, cell: HTMLCellElement) {
    const entity = ctx.gridInterface.getDatasource().getRow(cell.$row) ?? null;
    showCellFind(ctx, cell, entity, cell.$attribute);
}

/**
 * The bar, made the first time it opens: a search region with its name, the first child of the grid
 * element. Rendered by renderFindBar
 */
function makeFindBar(ctx: Grid): FindBar {
    const element = document.createElement('div');
    element.className = 'simple-html-grid-find';
    element.setAttribute('role', 'search');
    element.hidden = true;
    // Esc in the input or on a button closes it. Canceled: a modal dialog the grid is in stays open
    element.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !event.isComposing && !event.defaultPrevented) {
            event.preventDefault();
            closeFind(ctx);
        }
    });
    ctx.element.prepend(element);
    ctx.findBar = {
        element,
        open: false,
        text: '',
        matches: [],
        cells: new Map(),
        index: -1,
        anchor: null,
        origin: null,
        returnFocus: null,
        timer: null,
        scrollWhenFound: false,
        sent: ''
    };
    return ctx.findBar;
}

/**
 * the input of the bar
 */
function findInput(bar: FindBar): HTMLInputElement {
    return bar.element.querySelector('input') as HTMLInputElement;
}

/**
 * Where the focus is when the bar opens: a body cell is where the search starts and where Esc goes back
 * to; anything else in the grid (a header filter, a column header) is focused again. The focus outside
 * the grid (an API call from a button of the page) is not taken back
 */
function rememberFocus(ctx: Grid, bar: FindBar) {
    const root = ctx.element.getRootNode() as Partial<DocumentOrShadowRoot>;
    const active = root.activeElement ?? null;
    const cell = bodyCellOf(ctx, active);
    const entity = cell ? ctx.gridInterface.getDatasource().getRow(cell.$row) : null;
    bar.origin = cell && entity ? { entity, field: cell.$attribute as string, row: cell.$row } : null;
    // not the hidden input the wheel takes the focus with (createDom), nor the bar itself
    const inGrid = active instanceof HTMLElement && ctx.element.contains(active) && active !== ctx.focusElement;
    bar.returnFocus = !cell && inGrid && !bar.element.contains(active) ? active : null;
}

/**
 * After Esc or the close button: the cell of the current match gets the focus and its row is the
 * current row, as moving to a cell with the keys makes it. Without a match the cell the bar was opened
 * from, if its row is still displayed, or the element of the grid it was opened from
 */
function focusAfterClose(ctx: Grid, bar: FindBar, match: FindMatch | undefined) {
    const datasource = ctx.gridInterface.getDatasource();
    if (match) {
        focusCell(ctx, match.row, match.field);
        if (datasource.currentEntity !== match.entity) {
            datasource.setRowAsCurrentEntity(match.row);
        }
        return;
    }
    const row = bar.origin ? datasource.getRows().indexOf(bar.origin.entity) : -1;
    if (bar.origin && row !== -1) {
        focusCell(ctx, row, bar.origin.field);
    } else if (bar.returnFocus?.isConnected) {
        bar.returnFocus.focus({ preventScroll: true });
    }
}

/**
 * Scrolls a cell into view - in the middle when it is out of view, as a browser's find does - and
 * renders the rows and columns there now: a jump far away would else wait for the scrolling to stop
 * (see verticalScrollHandler). The scroll events that follow find them rendered
 */
function scrollToCell(ctx: Grid, row: number, field: string) {
    if (scrollCellIntoView(ctx, row, field, true)) {
        triggerScrollEvent(ctx);
    }
}

/**
 * focuses a cell's input, after scrolling it into view
 */
function focusCell(ctx: Grid, row: number, field: string) {
    scrollToCell(ctx, row, field);
    focusCellInput(ctx, { row, field });
}

/**
 * The search waits until the typing (or the changes of the data) stop: FIND_DELAY_MS after the last
 * call. A large grid takes a while to search, it is done once
 * @param scroll it is the user typing: the grid scrolls to the current match when it is found
 */
function scheduleFind(ctx: Grid, scroll: boolean) {
    const bar = ctx.findBar;
    if (!bar) {
        return;
    }
    bar.scrollWhenFound = bar.scrollWhenFound || scroll;
    clearTimeout(bar.timer ?? undefined);
    bar.timer = setTimeout(() => runFind(ctx, bar.scrollWhenFound), FIND_DELAY_MS);
}

/**
 * Finds the text now: the matches, the current one at or after the anchor (the current match, or the
 * cell the bar was opened from), the classes of the cells on screen, the count and `find-change`
 * @param scroll scroll to the current match: not when the data changed, the user may be typing in a
 * cell somewhere
 */
function runFind(ctx: Grid, scroll: boolean) {
    const bar = ctx.findBar;
    if (!bar?.open) {
        return;
    }
    clearTimeout(bar.timer ?? undefined);
    bar.timer = null;
    bar.scrollWhenFound = false;

    bar.matches = findMatches(ctx, bar.text);
    bar.cells = new Map();
    for (const match of bar.matches) {
        const fields = bar.cells.get(match.entity) ?? new Set<string>();
        fields.add(match.field);
        bar.cells.set(match.entity, fields);
    }
    const rows = ctx.gridInterface.getDatasource().getRows();
    bar.index = matchAtOrAfter(bar.matches, rows, getLayoutFields(ctx.gridInterface), bar.anchor);
    const match = bar.matches[bar.index];
    if (match) {
        bar.anchor = { entity: match.entity, field: match.field, row: match.row };
    }
    showCurrent(ctx, bar, scroll);
}

/**
 * Shows the current match: scrolls to it, the classes of the cells on screen, the count; sends
 * `find-change` when something changed
 */
function showCurrent(ctx: Grid, bar: FindBar, scroll: boolean) {
    const match = bar.matches[bar.index];
    if (scroll && match) {
        scrollToCell(ctx, match.row, match.field);
    }
    forEachCellOnScreen(ctx, (cell) => showCellFindOf(ctx, cell));
    renderFindBar(ctx, bar);
    sendChange(ctx, bar);
}

/**
 * `find-change`, when what getFind() gives is not what was sent last
 */
function sendChange(ctx: Grid, bar: FindBar) {
    const result = getFindResult(ctx);
    const json = JSON.stringify(result);
    if (json !== bar.sent) {
        bar.sent = json;
        ctx.gridInterface.__callSubscribers('find-change', result);
    }
}

/**
 * The bar: the input, the count (a status, read out when it changes - after the typing stopped, or a
 * step), previous, next and close. The buttons keep the focus where it is when they are clicked: in the
 * input, so Enter goes on from there. The texts are read on every render, a rebuild shows changed ones
 */
function renderFindBar(ctx: Grid, bar: FindBar) {
    bar.element.setAttribute('aria-label', gridText(ctx, 'find.label'));
    const count = bar.matches.length;
    const status =
        bar.text === '' || !bar.open
            ? ''
            : count
              ? gridText(ctx, 'find.count', { current: bar.index + 1, count })
              : gridText(ctx, 'find.none');
    const keepFocus = (event: MouseEvent) => event.preventDefault();
    const placeholder = gridText(ctx, 'find.placeholder');

    render(
        html`<input
                class="simple-html-grid-find-input"
                type="text"
                autocomplete="off"
                spellcheck="false"
                aria-label=${placeholder}
                placeholder=${placeholder}
                .value=${live(bar.text)}
                @input=${(event: Event) => {
                    bar.text = (event.target as HTMLInputElement).value;
                    if (bar.text === '') {
                        // nothing to wait for: no matches
                        runFind(ctx, false);
                    } else {
                        scheduleFind(ctx, true);
                    }
                }}
                @keydown=${(event: KeyboardEvent) => {
                    // Enter of an input method commits what it composes
                    if (event.key === 'Enter' && !event.isComposing && !event.ctrlKey && !event.altKey && !event.metaKey) {
                        event.preventDefault();
                        findStep(ctx, event.shiftKey ? -1 : 1);
                    }
                }}
            /><span class="simple-html-grid-find-count" role="status">${status}</span
            ><button
                type="button"
                class="simple-html-grid-find-button"
                aria-label=${gridText(ctx, 'find.previous')}
                title=${gridText(ctx, 'find.previous.tooltip')}
                @mousedown=${keepFocus}
                @click=${() => findStep(ctx, -1)}
            >
                ↑</button
            ><button
                type="button"
                class="simple-html-grid-find-button"
                aria-label=${gridText(ctx, 'find.next')}
                title=${gridText(ctx, 'find.next.tooltip')}
                @mousedown=${keepFocus}
                @click=${() => findStep(ctx, 1)}
            >
                ↓</button
            ><button
                type="button"
                class="simple-html-grid-find-button"
                aria-label=${gridText(ctx, 'find.close')}
                title=${gridText(ctx, 'find.close.tooltip')}
                @mousedown=${keepFocus}
                @click=${() => closeFind(ctx)}
            >
                ✕
            </button>`,
        bar.element
    );
}
