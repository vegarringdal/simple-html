import { html, nothing, render } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import type { TextId } from '../../texts';
import type { Grid } from '../grid';
import type { MenuItem } from '../gridMenus';
import { moveDialog, resizeHandles, showDialog } from './dialogFrame';
import { gridText } from './gridText';
import { SEARCH_ICON } from './icons';
import { isMacPlatform, type KeyTextId, keyText } from './keyText';
import { closeLookupEditor } from './lookupEditor';
import { removeContextMenu } from './removeContextMenu';
import { isTypedCharacter } from './renderRowCell';
import {
    KEY_NAMES,
    KEY_SYMBOLS,
    MAC_KEY_NAMES,
    SHORTCUT_GROUPS,
    type Shortcut,
    shortcutKeys,
    showsShortcut
} from './shortcutList';
import { closeTextEditor } from './textEditor';
import { attachTooltips, hideTooltip, tooltipsEnabled } from './tooltip';

/**
 * The keyboard shortcuts help: a modal `<dialog class="simple-html-grid filter-editor-content
 * shortcut-help">` on the body, of the filter editor's kind (dialogFrame.ts) - its title bar (drag it, ✕
 * closes), moved and resized as the other dialogs, Esc closes it and the focus goes back to where it was.
 *
 * What it shows: a search, a hint (the arrows are the caret's, Alt moves between the cells), then the
 * keys of the grid in groups (shortcutList.ts), a table each - its title the caption, a row per entry:
 * the keys as `<kbd>`s and what they do. The keys as the platform names them: on a Mac ⌘ for Ctrl, ⌥ for
 * Alt, ⇧ for Shift, in a Mac's order and without the `+` (⇧⌘Z). An entry is left out where its keys do
 * nothing - the editing keys in a readonly grid (showsShortcut). The search keeps the entries whose text,
 * keys or group title have what is typed, any case.
 *
 * Opened by `?` where the key types nothing and Ctrl+/ (Cmd+/) anywhere in the grid (shortcutHelpKeydown),
 * *Keyboard shortcuts…* in the header menu (shortcutHelpEntry) - both with `GridConfig.shortcutHelp`, the
 * default - and `gridInterface.openShortcutHelp()`.
 */

/**
 * input types a key typed in types nothing into: `?` there opens the help
 */
const NO_TEXT_INPUTS = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'image', 'color', 'range', 'file', 'hidden']);

/**
 * true when a key typed on the element types text: an input or a textarea that is not readonly or
 * disabled, or an element that is edited (contenteditable)
 */
function typesText(target: EventTarget | null): boolean {
    if (target instanceof HTMLTextAreaElement) {
        return !target.readOnly && !target.disabled;
    }
    if (target instanceof HTMLInputElement) {
        return !NO_TEXT_INPUTS.has(target.type) && !target.readOnly && !target.disabled;
    }
    return target instanceof HTMLElement && target.isContentEditable;
}

/**
 * true for the keys of the help: Ctrl+/ (Cmd+/, Ctrl+? too: with Shift the key gives `?`) anywhere, and
 * `?` - typed with or without Shift, as the layout has it - where it would type nothing: on a readonly
 * cell, a checkbox, a column header, a row number, a button. Not in a cell, a header filter or the find
 * bar's input that can be typed in. The element the key is on is the first of the event's path: in a
 * shadow root the event's target is the shadow host
 */
export function isShortcutHelpKey(event: KeyboardEvent): boolean {
    if ((event.ctrlKey || event.metaKey) && !event.altKey && (event.key === '/' || event.key === '?')) {
        return true;
    }
    return event.key === '?' && isTypedCharacter(event) && !typesText(event.composedPath()[0] ?? event.target);
}

/**
 * The keys of the help in the grid, for the grid element's keydown (createDom): opens it. A key that is
 * used already (canceled) is left alone - a character typed in a lookup cell opens its list, in a custom
 * cell its editor - and so are the keys of an input method while it composes. Nothing with
 * `GridConfig.shortcutHelp: false`
 */
export function shortcutHelpKeydown(ctx: Grid, event: KeyboardEvent) {
    if (event.defaultPrevented || event.isComposing || !ctx.gridInterface.__getGridConfig().shortcutHelp) {
        return;
    }
    if (isShortcutHelpKey(event)) {
        event.preventDefault();
        openShortcutHelp(ctx);
    }
}

/**
 * The entry of the header menu, `header.shortcuts`: opens the help. Its hint the key that opens it
 * anywhere in the grid, Ctrl+/ (⌘/ on a Mac). Not shown with `GridConfig.shortcutHelp: false`
 */
export function shortcutHelpEntry(ctx: Grid): MenuItem {
    return {
        id: 'header.shortcuts',
        label: gridText(ctx, 'header.shortcuts'),
        hint: keyText(ctx, 'header.shortcuts.hint'),
        visible: () => ctx.gridInterface.__getGridConfig().shortcutHelp,
        action: () => openShortcutHelp(ctx)
    };
}

/**
 * Opens the help. A key opened it (the last input was a key, `ctx.keyboardUsed`): the focus goes into its
 * search, to type in at once. Else to the dialog itself, as the other dialogs do - a focused input would
 * open the keyboard of a phone. Open already: the focus goes to it
 */
export function openShortcutHelp(ctx: Grid) {
    if (ctx.shortcutHelp) {
        ctx.shortcutHelp.focus();
        return;
    }
    // a modal dialog: the editors and the menu would be inert under it. The text of an editor is saved,
    // as a click outside it does. The menu gives the focus back to where it was opened from first: the
    // dialog gives it back there when it closes
    closeTextEditor(ctx);
    closeLookupEditor(ctx);
    removeContextMenu(ctx);

    const dialog = createDialog(ctx);
    renderShortcutHelp(ctx, dialog, '');
    // the focus on the dialog itself, centered on the window (dialogFrame.ts)
    showDialog(dialog);
    if (ctx.keyboardUsed) {
        dialog.querySelector<HTMLElement>('.shortcut-help-search')?.focus();
    }
}

/**
 * Closes the help and takes it off the page. Does nothing when it is not open. Used by its ✕, after
 * Esc, and when the grid leaves the page
 */
export function closeShortcutHelp(ctx: Grid) {
    const dialog = ctx.shortcutHelp;
    if (!dialog) {
        return;
    }
    ctx.shortcutHelp = null;
    hideTooltip();
    // close() before remove(): closing a modal dialog gives the focus back to the element that had it
    // when the dialog opened
    dialog.close();
    dialog.remove();
}

/**
 * the id of an element of the help, unique in the page: a page can have several grids
 */
function idOf(ctx: Grid, part: string) {
    return `${ctx.ariaIdPrefix}-shortcut-help-${part}`;
}

/**
 * Makes the help's dialog and puts it on the body, closed: openShortcutHelp renders it and shows it
 */
function createDialog(ctx: Grid): HTMLDialogElement {
    const dialog = document.createElement('dialog');
    dialog.classList.add('simple-html-grid', 'filter-editor-content', 'shortcut-help');
    // showModal() moves the focus to the dialog itself (autofocus), Tab goes on into it
    dialog.setAttribute('autofocus', '');
    dialog.tabIndex = -1;
    // its name: the title in its title bar
    dialog.setAttribute('aria-labelledby', idOf(ctx, 'title'));
    if (tooltipsEnabled(ctx)) {
        dialog.classList.add('simple-html-grid-tooltips');
        attachTooltips(dialog);
    }
    // Esc: the browser closes the dialog (cancel, then close). After the ✕, ctx.shortcutHelp is not this
    // dialog anymore
    dialog.addEventListener('close', () => {
        if (ctx.shortcutHelp === dialog) {
            closeShortcutHelp(ctx);
        }
    });
    document.body.appendChild(dialog);
    ctx.shortcutHelp = dialog;
    return dialog;
}

/**
 * The name of a key as the help shows it: its text (KEY_NAMES, a modifier's text for a Mac on a Mac), an
 * arrow's symbol, else the key as it is written - a letter, F2, `?`
 */
function keyName(ctx: Grid, key: string): string {
    const id = KEY_NAMES[key];
    if (id) {
        return MAC_KEY_NAMES.has(id) ? keyText(ctx, id as KeyTextId) : gridText(ctx, id);
    }
    return KEY_SYMBOLS[key] ?? key;
}

/**
 * Renders the help: again for every change of the search, in the same dialog - lit keeps the elements,
 * the search keeps the focus and its caret
 * @param search what is typed in the search
 */
function renderShortcutHelp(ctx: Grid, dialog: HTMLDialogElement, search: string) {
    const text = (id: TextId) => gridText(ctx, id);
    const mac = isMacPlatform();
    const config = ctx.gridInterface.__getGridConfig();
    const query = search.trim().toLowerCase();

    /** the keys of a combination as the platform names them: on a Mac in its order, without the `+` */
    const names = (combination: string) => shortcutKeys(combination, mac).map((key) => keyName(ctx, key));

    /** true when the entry has the search: in its text, its keys - as shown and as written - or its group's title */
    const matches = (shortcut: Shortcut, title: string) =>
        [title, text(shortcut.text), ...shortcut.keys, ...shortcut.keys.flatMap(names)].join(' ').toLowerCase().includes(query);

    const groups = SHORTCUT_GROUPS.map((group) => {
        const title = text(group.title);
        const shortcuts = group.shortcuts.filter((shortcut) => showsShortcut(shortcut, config, mac) && matches(shortcut, title));
        return { title, shortcuts };
    }).filter((group) => group.shortcuts.length);

    /** a combination: a `<kbd>` of the `<kbd>` of each key, `+` between them - not on a Mac (⇧⌘Z) */
    const combination = (keys: string) =>
        html`<kbd class="shortcut-help-keys"
            >${names(keys).map((name, index) => html`${index && !mac ? '+' : nothing}<kbd>${name}</kbd>`)}</kbd
        >`;

    /** the keys of an entry, ` / ` between them */
    const keysOf = (shortcut: Shortcut) =>
        shortcut.keys.map(
            (keys, index) => html`${index ? html`<span class="shortcut-help-or"> / </span>` : nothing}${combination(keys)}`
        );

    render(
        html`<div class="filter-editor-titlebar" @pointerdown=${(event: PointerEvent) => moveDialog(dialog, event)}>
                <span class="filter-editor-title" id=${idOf(ctx, 'title')} data-tooltip=${text('shortcuts.title.tooltip')}
                    >${text('shortcuts.title')}</span
                >
                <button
                    type="button"
                    class="filter-editor-close"
                    aria-label=${text('shortcuts.close')}
                    data-tooltip=${text('shortcuts.close')}
                    @click=${() => closeShortcutHelp(ctx)}
                >
                    ✕
                </button>
            </div>
            <div class="shortcut-help-top">
                <label class="simple-html-grid-chooser-search">
                    ${SEARCH_ICON}
                    <input
                        class="simple-html-grid-menu-item-input shortcut-help-search"
                        type="text"
                        spellcheck="false"
                        autocomplete="off"
                        .value=${live(search)}
                        placeholder=${text('shortcuts.search')}
                        aria-label=${text('shortcuts.search')}
                        aria-describedby=${idOf(ctx, 'hint')}
                        @input=${(event: Event) => renderShortcutHelp(ctx, dialog, (event.target as HTMLInputElement).value)}
                    />
                </label>
                <div class="shortcut-help-hint" id=${idOf(ctx, 'hint')}>${keyText(ctx, 'shortcuts.hint')}</div>
                <div class="shortcut-help-none" role="status">${groups.length ? '' : text('shortcuts.none')}</div>
            </div>
            <div class="filter-editor-body simple-html-dialog-scroller shortcut-help-body">
                ${groups.map(
                    (group) =>
                        html`<table class="shortcut-help-group">
                            <caption>
                                ${group.title}
                            </caption>
                            <tbody>
                                ${group.shortcuts.map(
                                    (shortcut) =>
                                        html`<tr>
                                            <th scope="row">${keysOf(shortcut)}</th>
                                            <td>${text(shortcut.text)}</td>
                                        </tr>`
                                )}
                            </tbody>
                        </table>`
                )}
            </div>
            ${resizeHandles(dialog)}`,
        dialog
    );
}
