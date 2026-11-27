import { html, nothing, render } from 'lit-html';
import type { Grid } from '../grid';
import type { MenuContext, MenuEntry, MenuPosition, MenuSubmenu } from '../gridMenus';
import { asPx } from './asPx';
import { createElement } from './createElement';
import { removeContextMenu } from './removeContextMenu';
import { attachTooltips, tooltipsEnabled } from './tooltip';

/**
 * Where a menu goes, in px from the window's left and top edges. `flipTop`: when the menu does not
 * fit below `top`, it is moved up so its bottom edge is at `flipTop`. `pointX`: where it was opened
 * (the mouse, the element's left edge) - a menu that fits neither below nor above goes next to it,
 * see {@link placeMenu}. `anchor`: the element it opens from, null for a position - the menu is put in
 * its dialog or popover, see {@link popoverParent}.
 */
export interface MenuPlace {
    left: number;
    top: number;
    flipTop: number;
    pointX: number;
    anchor: Element | null;
}

/**
 * px kept free between a menu and the edges of the window
 */
export const WINDOW_MARGIN = 4;

/**
 * The place of the grid's own menus: under the cell, around the mouse (130px wide, the mouse in the
 * middle), kept in the window.
 */
export function placeUnderCell(event: MouseEvent, cell: HTMLElement): MenuPlace {
    const rect = cell.getBoundingClientRect();
    let left = event.clientX - 65;
    if (event.clientX + 70 > window.innerWidth) {
        left = window.innerWidth - 150;
    }
    if (event.clientX - 65 < 0) {
        left = 5;
    }
    return { left, top: rect.bottom + 2, flipTop: rect.top, pointX: event.clientX, anchor: cell };
}

/**
 * The place of a menu opened with `gridInterface.openMenu()`: under an element, or with its top left
 * corner at the mouse / the position
 */
export function placeAt(at: MouseEvent | MenuPosition | HTMLElement): MenuPlace {
    if (at instanceof Element) {
        const rect = at.getBoundingClientRect();
        return { left: rect.left, top: rect.bottom + 2, flipTop: rect.top, pointX: rect.left, anchor: at };
    }
    if ('clientX' in at) {
        // a mouse event that was not dispatched (made in code) has no target
        const anchor = at.target instanceof Element ? at.target : null;
        return { left: at.clientX, top: at.clientY, flipTop: at.clientY, pointX: at.clientX, anchor };
    }
    return { left: at.x, top: at.y, flipTop: at.y, pointX: at.x, anchor: null };
}

/**
 * Where the grid puts a menu in the dom: in the dialog or popover of the page `anchor` is in, else on
 * the body. Shown, a menu is in the top layer wherever it is in the dom, but for the browser it
 * belongs to its parent:
 * - a modal dialog makes everything outside it inert - it can not be clicked or focused. A menu of the
 *   filter editor, or of a grid in a modal dialog of your own, has to be inside that dialog
 * - a click in a menu outside a `popover="auto"` of yours is a click outside it, which closes it
 *
 * Not in one of the grid's own menus (a dropdown grid in a block): those are manual popovers, a menu
 * on the body is as good, and is closed on its own when the dropdown grid leaves the page.
 */
export function popoverParent(anchor: Element | null): HTMLElement {
    return anchor?.closest<HTMLElement>('dialog, [popover]:not(.simple-html-grid-popover)') ?? document.body;
}

/**
 * Puts a menu at `left` / `top`, in px from the window's left and top edges. A menu is
 * `position: absolute` in the top layer, where that is from the top left of the page: it moves with
 * the page when the page scrolls, as it did on the body
 */
export function moveMenu(menu: HTMLElement, left: number, top: number) {
    menu.style.left = asPx(left + window.scrollX);
    menu.style.top = asPx(top + window.scrollY);
}

/**
 * Opens `menu` as the grid's menu: the menu open before is closed (one at a time), and this one is
 * put in the dom ({@link popoverParent}) and shown as a popover. Place it after, with
 * {@link placeMenu} or {@link moveMenu}: its size is known once it is shown.
 *
 * The menus are `popover="manual"`: the top layer - over everything on the page, never clipped by a
 * container with `overflow: hidden`, never behind content with a higher z-index - without the
 * browser's light dismiss. `popover="auto"` would close a menu opened by a right click on the
 * pointerup that follows, where the contextmenu event comes on the button press (macOS, Linux): that
 * pointerup is outside the menu. So the grid closes its menus itself: on a click outside and on Esc
 * (addMenuListeners), on scroll (autoRemoveContextMenuOnScrollEvent), when another menu opens and
 * when the grid leaves the page. A menu also closes the editor of a multiline cell (textEditor.ts),
 * saving it, and the editor of a lookup column (lookupEditor.ts): one popover of the grid is open at a
 * time.
 */
export function openMenuElement(ctx: Grid, menu: HTMLElement, anchor: Element | null) {
    // the editor of a multiline cell is saved and closed, the focus back in its cell first: the menu
    // gives the focus back there when it closes
    ctx.textEditor?.close(true, true);
    // the editor of a lookup column too, the value as it is
    ctx.lookupEditor?.close(true);
    removeContextMenu(ctx);
    // gets the focus back when the menu closes with the focus in it, see removeContextMenu
    const returnFocus = document.activeElement;

    // the css class undoes the browser's popover style, and hides it while it is not open
    menu.classList.add('simple-html-grid-popover');
    menu.popover = 'manual';
    menu.style.minWidth = asPx(130);
    popoverParent(anchor).appendChild(menu);
    // the tooltips of its items (MenuItem.tooltip), also where no dialog of the grid handles them
    attachTooltips(menu, () => tooltipsEnabled(ctx));
    menu.showPopover();

    ctx.contextMenu = menu;
    ctx.menuReturnFocus = returnFocus;

    // openMenu() called from a click handler: that click still bubbles up to the document, where the
    // grid closes menus on a click outside them. It must not close this one. A click is dispatched in
    // one task, the timer runs after it
    ctx.menuJustOpened = true;
    setTimeout(() => {
        ctx.menuJustOpened = false;
    });
}

/**
 * Places a menu that is shown, and keeps all of it in the window ({@link WINDOW_MARGIN} from its
 * edges) - the row menu is long:
 * - under the cell / point, or above it when there is no room below
 * - when there is room neither below nor above: next to the point, on its right - on its left when
 *   there is no room on the right - so it does not cover the cell, moved up as far as it has to
 * - moved in from the right edge, never past the left one
 * - taller than the window: as tall as the window, and it scrolls, see {@link fitWindowHeight}
 */
export function placeMenu(menu: HTMLElement, place: MenuPlace) {
    // the window, as the filter editor is placed in it (a page scrollbar can cover its last px)
    const width = window.innerWidth;
    const height = window.innerHeight;
    const rect = fitWindowHeight(menu);

    let top = place.top;
    let left = place.left;
    if (place.top + rect.height > height - WINDOW_MARGIN) {
        if (place.flipTop - rect.height >= WINDOW_MARGIN) {
            top = place.flipTop - rect.height;
        } else {
            // neither below nor above: beside the point, as near it as the window lets it be
            top = Math.max(WINDOW_MARGIN, Math.min(place.top, height - WINDOW_MARGIN - rect.height));
            const right = place.pointX + 2;
            const leftOf = place.pointX - 2 - rect.width;
            if (right + rect.width <= width - WINDOW_MARGIN) {
                left = right;
            } else if (leftOf >= WINDOW_MARGIN) {
                left = leftOf;
            }
        }
    }
    left = Math.max(WINDOW_MARGIN, Math.min(left, width - WINDOW_MARGIN - rect.width));
    moveMenu(menu, left, top);
}

/**
 * Places a submenu that is shown beside the item that opens it, kept in the window as
 * {@link placeMenu} keeps a menu:
 * - on the right of the menu the item is in, its first entry level with the item
 * - on the left of that menu when there is no room on the right. With room on neither side: moved in
 *   from the right edge (over the menu), never past the left one
 * - moved up as far as it has to when it does not fit below the item's top
 * - taller than the window: as tall as the window, and it scrolls
 * @param item the item that opens it
 * @param parent the menu the item is in: its popover
 */
export function placeSubmenu(menu: HTMLElement, item: HTMLElement, parent: HTMLElement) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const rect = fitWindowHeight(menu);
    const itemRect = item.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();

    let left = parentRect.right;
    const leftOf = parentRect.left - rect.width;
    if (left + rect.width > width - WINDOW_MARGIN && leftOf >= WINDOW_MARGIN) {
        left = leftOf;
    }
    left = Math.max(WINDOW_MARGIN, Math.min(left, width - WINDOW_MARGIN - rect.width));
    // the frame of a menu is 1px: its first item is 1px below its top
    const top = Math.max(WINDOW_MARGIN, Math.min(itemRect.top - 1, height - WINDOW_MARGIN - rect.height));
    moveMenu(menu, left, top);
}

/**
 * Measures a menu that is shown, and makes one taller than the window as tall as the window
 * ({@link WINDOW_MARGIN} from its edges): it scrolls. Only then: the scroll box would cut off the
 * menu's shadow.
 * @returns the size of the menu
 */
function fitWindowHeight(menu: HTMLElement): DOMRect {
    menu.style.maxHeight = '';
    menu.style.overflowY = '';
    // measured in the window's top left corner: near the right edge an absolutely placed element
    // shrinks to the room that is left (its text wraps), and would grow again once moved left
    moveMenu(menu, 0, 0);
    const rect = menu.getBoundingClientRect();
    const maxHeight = window.innerHeight - 2 * WINDOW_MARGIN;
    if (rect.height <= maxHeight) {
        return rect;
    }
    menu.style.maxHeight = asPx(maxHeight);
    menu.style.overflowY = 'auto';
    return menu.getBoundingClientRect();
}

/**
 * How long the pointer rests on an item before its submenu opens, or before the submenu open next to
 * it closes: in ms. Moving the pointer from an item to its open submenu crosses other items on the
 * way, they must not swap the submenu
 */
export const SUBMENU_DELAY = 150;

/**
 * An open menu of entries ({@link showMenu}) with its open submenus: on the grid (`ctx.menuTree`)
 * while it is open. The pickers of the filter editor and the date picker are menus without entries,
 * there is no tree for them.
 */
export interface MenuTree {
    /** what the menu was opened on, handed to the callbacks of the entries */
    context: MenuContext;
    /** the menu, then its open submenu, then that one's ...: one submenu open per menu */
    levels: MenuLevel[];
    /** a submenu opening or closing a while after the pointer moved, see hoverItem */
    timer: ReturnType<typeof setTimeout> | undefined;
    /** the item the pointer was on last */
    hovered: HTMLElement | null;
}

/**
 * The menu, or one of its open submenus
 */
interface MenuLevel {
    /** the popover. A submenu's is put in the menu's popover: it closes with it */
    popover: HTMLElement;
    /** the element with `role="menu"`, the entries are its children */
    menu: HTMLElement;
    /** the item that opened the submenu, null for the menu */
    opener: HTMLElement | null;
    /** it has a block: Tab is the browser's, it gets into the block, see itemKeydown */
    hasBlock: boolean;
}

/**
 * a number for the ids of the items that open a submenu: the submenu is labelled by its item
 */
let openerCount = 0;

/**
 * Opens a menu of entries: renders the entries that are visible and opens it as the grid's menu, see
 * {@link openMenuElement}. Its submenus open beside their items, see {@link openSubmenu}.
 *
 * An item click closes the menu first, then calls the item's action: an action can open another menu.
 *
 * The keyboard: opened by a key (Shift+F10, the menu key, Enter on a button that calls openMenu())
 * the menu takes the focus, on its first item - the ARIA menu pattern. Opened with the mouse the
 * focus stays where it is (the cell), as before: ArrowDown and ArrowUp move it into the menu, see
 * addMenuListeners. The keys in the menu: {@link itemKeydown}.
 */
export function showMenu(ctx: Grid, entries: MenuEntry[], context: MenuContext, place: MenuPlace) {
    const tree: MenuTree = { context, levels: [], timer: undefined, hovered: null };
    const level = renderLevel(ctx, tree, visibleEntries(entries, context), 0, null);

    openMenuElement(ctx, level.popover, place.anchor);
    placeMenu(level.popover, place);
    tree.levels.push(level);
    ctx.menuTree = tree;

    if (ctx.keyboardUsed) {
        focusItem(menuItems(level.menu)[0]);
    }
}

/**
 * The entries to show: those whose `visible` callback does not return false, in the submenus too. A
 * submenu with no item, submenu or block left is left out, a submenu of lines and headers only too.
 * A submenu shown is a copy with its visible entries
 */
function visibleEntries(entries: MenuEntry[], context: MenuContext): MenuEntry[] {
    const shown: MenuEntry[] = [];
    for (const entry of entries) {
        if (!(entry.visible?.(context) ?? true)) {
            continue;
        }
        if (entry.type === 'submenu') {
            const inner = visibleEntries(entry.entries, context);
            if (inner.some((child) => child.type !== 'section' && child.type !== 'separator')) {
                shown.push({ ...entry, entries: inner });
            }
        } else {
            shown.push(entry);
        }
    }
    return shown;
}

/**
 * Renders the menu, or a submenu (`depth` 1 and more), into a popover element of its own: a
 * `role="menu"` element with the entries in it. The entries are the visible ones already
 * (visibleEntries); `disabled` and `selected` are called here, when the menu or submenu opens.
 *
 * - An item is a `menuitem`, a `menuitemcheckbox` with `aria-checked` when it has a `selected`
 *   callback, `aria-disabled` when it is disabled. It is not a stop of Tab (`tabindex="-1"`) but for
 *   one item per menu, the one the keyboard was on last (a roving tabindex): Shift+Tab from a block
 *   gets back to it.
 * - An item that opens a submenu has `aria-haspopup="menu"` and `aria-expanded`, and an id: the
 *   submenu is labelled by it.
 * - A section header and its line have no role: the keyboard passes them by. A separator is an `hr`,
 *   a `separator`.
 *
 * A mousedown on an item is canceled: an item does not take the focus from the mouse, it stays on the
 * cell the menu was opened from (the filter editor, opened from an item, gives it back there when it
 * closes) - or on the item the keyboard is on.
 */
function renderLevel(ctx: Grid, tree: MenuTree, entries: MenuEntry[], depth: number, opener: HTMLElement | null): MenuLevel {
    const popover = createElement('div', 'simple-html-grid');
    popover.classList.add('simple-html-grid-reset');
    const context = tree.context;
    const noFocus = (event: MouseEvent) => event.preventDefault();

    const entryTemplate = (entry: MenuEntry) => {
        switch (entry.type) {
            case 'section':
                return html`<div class="simple-html-grid-menu-section" role="none" data-menu-id=${entry.id}>${entry.label}</div>
                    <hr class="hr-solid" role="none" />`;
            case 'separator':
                return html`<hr class="hr-dashed" data-menu-id=${entry.id} />`;
            case 'block':
                // lit puts the element itself in the menu
                return entry.element;
            case 'submenu':
                return html`<div
                    class="simple-html-grid-menu-item"
                    role="menuitem"
                    tabindex="-1"
                    id=${`${ctx.ariaIdPrefix}-menu-${++openerCount}`}
                    data-menu-id=${entry.id}
                    aria-haspopup="menu"
                    aria-expanded="false"
                    @mousedown=${noFocus}
                    @mousemove=${(event: MouseEvent) => hoverItem(ctx, tree, depth, event.currentTarget as HTMLElement, entry)}
                    @click=${(event: MouseEvent) => openSubmenu(ctx, tree, depth, event.currentTarget as HTMLElement, entry, false)}
                    @keydown=${(event: KeyboardEvent) => itemKeydown(ctx, tree, depth, event, entry)}
                >
                    ${entry.label}
                </div>`;
            default: {
                const disabled = entry.disabled?.(context) ?? false;
                const selected = entry.selected?.(context) ?? false;
                let classes = 'simple-html-grid-menu-item';
                if (selected) {
                    classes += ' simple-html-grid-menu-item-selected';
                }
                if (disabled) {
                    classes += ' simple-html-grid-menu-item-disabled';
                }
                return html`<div
                    class=${classes}
                    role=${entry.selected ? 'menuitemcheckbox' : 'menuitem'}
                    tabindex="-1"
                    data-menu-id=${entry.id}
                    aria-checked=${entry.selected ? String(selected) : nothing}
                    aria-disabled=${disabled ? 'true' : nothing}
                    data-tooltip=${entry.tooltip ?? nothing}
                    aria-description=${entry.tooltip ?? nothing}
                    @mousedown=${noFocus}
                    @mousemove=${(event: MouseEvent) => hoverItem(ctx, tree, depth, event.currentTarget as HTMLElement)}
                    @click=${() => {
                        if (!disabled) {
                            removeContextMenu(ctx);
                            entry.action(context);
                        }
                    }}
                    @keydown=${(event: KeyboardEvent) => itemKeydown(ctx, tree, depth, event)}
                >
                    ${entry.label}${entry.hint ? html` <i>(${entry.hint})</i>` : nothing}
                </div>`;
            }
        }
    };

    render(html`<div class="simple-html-grid-menu" role="menu">${entries.map((entry) => entryTemplate(entry))}</div>`, popover);
    const menu = popover.firstElementChild as HTMLElement;

    // Shift+Tab from a block gets back to the first item, until the keyboard moves on
    const first = menuItems(menu)[0];
    if (first) {
        first.tabIndex = 0;
    }
    // the submenu open in this menu would stay where it opened, apart from its item
    popover.addEventListener('scroll', () => closeLevels(tree, depth + 1));
    for (const entry of entries) {
        if (entry.type === 'block') {
            watchBlock(tree, depth, entry.element);
        }
    }

    return { popover, menu, opener, hasBlock: entries.some((entry) => entry.type === 'block') };
}

/**
 * A block of the menu at `depth` in use - the filter menu's value list: the submenu open in this menu
 * closes (the user: "when I start using other parts of filter, then filter menu should close"). At once
 * when the block takes the focus or a press (its search typed in, a checkbox clicked); {@link SUBMENU_DELAY}
 * after the pointer moved onto it, as onto an item without a submenu - see hoverItem. The pointer back on
 * the item opens its submenu again
 */
function watchBlock(tree: MenuTree, depth: number, block: HTMLElement) {
    const closeNow = () => {
        clearTimeout(tree.timer);
        tree.hovered = block;
        closeLevels(tree, depth + 1);
    };
    block.addEventListener('focusin', closeNow);
    block.addEventListener('pointerdown', closeNow);
    block.addEventListener('mousemove', () => {
        if (tree.hovered === block) {
            return;
        }
        tree.hovered = block;
        clearTimeout(tree.timer);
        if (tree.levels[depth + 1]) {
            tree.timer = setTimeout(() => closeLevels(tree, depth + 1), SUBMENU_DELAY);
        }
    });
}

/**
 * The items of a menu or submenu, in order: its children with a menuitem role. Sections, lines and
 * blocks are not, nor an item that is hidden (the search of the filter editor's field picker hides
 * the fields it does not find)
 */
function menuItems(menu: Element | null): HTMLElement[] {
    return Array.from(menu?.children ?? []).filter(
        (child): child is HTMLElement =>
            child instanceof HTMLElement && !child.hidden && /^menuitem/.test(child.getAttribute('role') ?? '')
    );
}

/**
 * Gives `item` the focus, and makes it the stop of Tab of its menu (a roving tabindex)
 */
function focusItem(item: HTMLElement | undefined) {
    if (!item) {
        return;
    }
    for (const other of menuItems(item.parentElement)) {
        other.tabIndex = other === item ? 0 : -1;
    }
    item.focus();
}

/**
 * The focus to the first item - or the last - of the deepest open menu: ArrowDown / ArrowUp while
 * a menu is open and the focus is not in it (opened with the mouse), see addMenuListeners
 */
export function focusMenu(tree: MenuTree, last: boolean) {
    const items = menuItems(tree.levels[tree.levels.length - 1].menu);
    focusItem(last ? items[items.length - 1] : items[0]);
}

/**
 * Opens the submenu of `item`, an item of the menu at `depth`, beside it (placeSubmenu). The submenu
 * open in that menu closes first: one per menu. Already open, it stays as it is.
 *
 * The submenu is a popover of its own, put in the menu's popover: it closes with the menu, and a
 * click in it is a click in the menu. It is shown in the top layer, the menu's box does not cut it
 * off.
 * @param focus the focus to its first item: it is opened from the keyboard
 */
function openSubmenu(ctx: Grid, tree: MenuTree, depth: number, item: HTMLElement, submenu: MenuSubmenu, focus: boolean) {
    clearTimeout(tree.timer);
    let level = tree.levels[depth + 1];
    if (level?.opener !== item) {
        closeLevels(tree, depth + 1);
        level = renderLevel(ctx, tree, submenu.entries, depth + 1, item);
        level.menu.setAttribute('aria-labelledby', item.id);
        level.popover.classList.add('simple-html-grid-popover');
        level.popover.popover = 'manual';
        level.popover.style.minWidth = asPx(130);
        // the pointer is in the submenu: the items it crossed on the way do not swap it, see hoverItem
        level.popover.addEventListener('mouseenter', () => clearTimeout(tree.timer));
        tree.levels[0].popover.appendChild(level.popover);
        level.popover.showPopover();
        placeSubmenu(level.popover, item, tree.levels[depth].popover);
        item.setAttribute('aria-expanded', 'true');
        tree.levels.push(level);
    }
    if (focus) {
        focusItem(menuItems(level.menu)[0]);
    }
}

/**
 * Closes the open submenus from `depth` on: 1 closes every submenu, the menu stays. The focus in one
 * of them goes back to the item that opened the first: it must not be lost with its element
 */
function closeLevels(tree: MenuTree, depth: number) {
    if (depth < 1 || depth >= tree.levels.length) {
        return;
    }
    const closed = tree.levels.splice(depth);
    if (closed.some((level) => level.popover.contains(document.activeElement))) {
        focusItem(closed[0].opener ?? undefined);
    }
    for (const level of closed) {
        level.opener?.setAttribute('aria-expanded', 'false');
        level.popover.remove();
    }
}

/**
 * The pointer moving on `item`, an item of the menu at `depth` (its mousemove).
 *
 * - The focus follows the pointer when it is on an item: one item is lit, the keyboard goes on from
 *   it. Not from a block's input, which the user is typing in, nor into a menu the mouse opened
 * - {@link SUBMENU_DELAY} later the submenu open in this menu closes, and the item's own submenu
 *   opens. The pointer crossing other items on its way to the open submenu does not swap it: entering
 *   the submenu stops the timer
 */
function hoverItem(ctx: Grid, tree: MenuTree, depth: number, item: HTMLElement, submenu?: MenuSubmenu) {
    if (tree.hovered === item) {
        return;
    }
    tree.hovered = item;
    const focused = document.activeElement;
    if (
        focused instanceof HTMLElement &&
        tree.levels[0].popover.contains(focused) &&
        menuItems(focused.parentElement).includes(focused)
    ) {
        focusItem(item);
    }

    clearTimeout(tree.timer);
    const open = tree.levels[depth + 1];
    if (open?.opener === item || (!open && !submenu)) {
        return;
    }
    tree.timer = setTimeout(() => {
        closeLevels(tree, depth + 1);
        if (submenu && item.isConnected) {
            openSubmenu(ctx, tree, depth, item, submenu, false);
        }
    }, SUBMENU_DELAY);
}

/**
 * The keys on an item of the menu at `depth`, the ARIA menu pattern:
 *
 * - ArrowDown / ArrowUp: the next / previous item, round. Home / End: the first / last. Sections and
 *   lines are passed by, disabled items are not (they can not be used). Moving closes the submenu
 *   open in this menu
 * - ArrowRight, Enter, Space on an item with a submenu: opens it, the focus on its first item
 * - Enter, Space on an item: as a click - the menu closes, the focus goes back, the action runs
 * - ArrowLeft, Esc in a submenu: closes it, the focus back on its item. Esc in the menu itself is left
 *   to addMenuListeners: it closes the menu
 * - Tab: closes the menu, the focus goes back where it was. Not in a menu with a block (the filter
 *   menu's value list): there Tab is the browser's, it gets into the block's inputs
 * - a letter: the next item whose label starts with it
 * @param submenu what the item opens, it is an item that opens a submenu
 */
function itemKeydown(ctx: Grid, tree: MenuTree, depth: number, event: KeyboardEvent, submenu?: MenuSubmenu) {
    const item = event.currentTarget as HTMLElement;
    const level = tree.levels[depth];
    const items = menuItems(level.menu);
    const index = items.indexOf(item);
    const moveTo = (next: HTMLElement | undefined) => {
        clearTimeout(tree.timer);
        closeLevels(tree, depth + 1);
        focusItem(next);
    };

    switch (event.key) {
        case 'ArrowDown':
            moveTo(items[(index + 1) % items.length]);
            break;
        case 'ArrowUp':
            moveTo(items[(index - 1 + items.length) % items.length]);
            break;
        case 'Home':
            moveTo(items[0]);
            break;
        case 'End':
            moveTo(items[items.length - 1]);
            break;
        case 'ArrowRight':
            if (!submenu) {
                return;
            }
            openSubmenu(ctx, tree, depth, item, submenu, true);
            break;
        case 'ArrowLeft':
        case 'Escape':
            if (depth === 0) {
                return;
            }
            closeLevels(tree, depth);
            break;
        case 'Enter':
        case ' ':
            if (submenu) {
                openSubmenu(ctx, tree, depth, item, submenu, true);
            } else {
                // the click: closes the menu and runs the action, nothing when the item is disabled
                item.click();
            }
            break;
        case 'Tab':
            if (level.hasBlock) {
                return;
            }
            removeContextMenu(ctx);
            break;
        default: {
            if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) {
                return;
            }
            // the next item whose label starts with the letter, after this one and round
            const letter = event.key.toLowerCase();
            const next = [...items.slice(index + 1), ...items.slice(0, index + 1)].find((other) =>
                other.textContent?.trim().toLowerCase().startsWith(letter)
            );
            if (next) {
                moveTo(next);
            }
        }
    }
    event.preventDefault();
}
