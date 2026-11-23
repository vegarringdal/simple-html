import { html, nothing, render, type TemplateResult } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import type { TextId } from '../../texts';
import type { Grid } from '../grid';
import type { MenuContext, MenuEntry, MenuItem } from '../gridMenus';
import type { GridView } from '../gridView';
import { gridText } from './gridText';
import { CHEVRON_ICON } from './icons';
import { removeContextMenu } from './removeContextMenu';
import { placeAt, showMenu } from './showMenu';

/**
 * The named views in the footer (`GridConfig.views`, gridView.ts): the views button at its left end,
 * the views menu it opens, and the name asked for by *Save as new view…* and *Rename…*.
 *
 * - **The button** shows the name of the view shown - "Standard" when none is, the config's state - and
 *   a `*` after it when the state changed since the view was applied or saved
 *   (`gridInterface.isViewModified()`). Its name for a screen reader and its tooltip say it in words:
 *   "View: My open orders (changed)". On the line of the filter's row, at the left end, as the gear is
 *   at the right: rebuildFooter.ts cuts its name where the filter's row starts, it is never over the
 *   filter (fitViews).
 * - **The menu**: Standard and the views, a ✓ on the one shown - a click applies it, one click to switch;
 *   then Save (over the view shown), Save as new view…, Revert changes, Rename…, Delete and Default view
 *   (a ✓ when the view shown is the one the grid starts in). The grid's own menu (showMenu.ts): the
 *   arrows, Enter, Esc and the first letters work as in the right click menus. Save, Rename… and Delete
 *   are greyed out on Standard and on a readonly view, Save and Revert changes when nothing changed.
 * - **The name**: a menu of its own at the button, a block (an input, Cancel and Save / Rename). The
 *   input has the focus, Enter saves, Esc closes it. A name of only spaces, or one another view has (in
 *   any case), is not taken: the line under the input says why.
 */

/**
 * The views button, for the footer's template: null when it is not shown (`viewsButton` off, a footer
 * of no height)
 * @param top where it starts: under the horizontal scrollbar's band, as the gear
 */
export function viewsButtonTemplate(ctx: Grid, top: number): TemplateResult | null {
    const gridInterface = ctx.gridInterface;
    const config = gridInterface.__getGridConfig();
    if (!config.viewsButton || config.footerHeight <= 0) {
        return null;
    }
    const view = gridInterface.getCurrentView();
    const modified = gridInterface.isViewModified();
    const name = view ? view.name : gridText(ctx, 'views.standard');
    const label = gridText(ctx, modified ? 'views.button.modified' : 'views.button', { name });
    // the area of the line of the filter's row, the button in its middle: as tall as "No filter"
    return html`<div class="footer-views" style="top:${top}px">
        <button
            type="button"
            class="footer-views-button"
            aria-haspopup="menu"
            aria-label=${label}
            title=${label}
            @click=${(event: MouseEvent) => {
                event.stopPropagation();
                toggleViewsMenu(ctx, event.currentTarget as HTMLElement);
            }}
        >
            <span class="footer-views-name">${name}</span>${modified ? html`<span class="footer-views-modified" aria-hidden="true">*</span>` : nothing}${CHEVRON_ICON}
        </button>
    </div>`;
}

/** the class of the views menu's popover: a second click on the button closes it */
const VIEWS_MENU_CLASS = 'simple-html-grid-views-menu';

/**
 * Opens the views menu above the button - under it when there is room, the footer is at the bottom -
 * or closes it when it is open: the button is a toggle, as a select is
 */
function toggleViewsMenu(ctx: Grid, button: HTMLElement) {
    if (ctx.contextMenu?.classList.contains(VIEWS_MENU_CLASS)) {
        removeContextMenu(ctx);
        return;
    }
    showMenu(ctx, viewsMenuEntries(ctx, button), menuContext(ctx), placeAt(button));
    ctx.contextMenu?.classList.add(VIEWS_MENU_CLASS);
    // the menu's name for a screen reader: the button's, "View: My open orders"
    ctx.menuTree?.levels[0].menu.setAttribute('aria-label', button.getAttribute('aria-label') ?? '');
}

/**
 * What the entries of the views menu are given: a menu of the grid's that is no right click menu, as
 * `gridInterface.openMenu()` makes it
 */
function menuContext(ctx: Grid): MenuContext {
    return {
        menu: 'custom',
        field: '',
        row: undefined,
        rowIndex: -1,
        cell: undefined,
        gridInterface: ctx.gridInterface,
        datasource: ctx.gridInterface.getDatasource()
    };
}

/**
 * The entries of the views menu, see the top of the file. Their ids are `views.*`, a view's is
 * `views.view.<id>`
 * @param button the views button: the name is asked for at it
 */
export function viewsMenuEntries(ctx: Grid, button: HTMLElement): MenuEntry[] {
    const gridInterface = ctx.gridInterface;
    const views = gridInterface.getViews();
    const current = gridInterface.getCurrentView();
    const modified = gridInterface.isViewModified();
    // the view shown is the user's: it can be saved over, renamed and deleted
    const own = current !== null && !current.readonly;
    const noDefault = !views.some((view) => view.default);
    const isDefault = current ? current.default === true : noDefault;
    const text = (id: TextId) => gridText(ctx, id);
    // "default", "shared": the default view, a readonly one
    const hint = (isTheDefault: boolean, readonly: boolean) =>
        [isTheDefault ? text('views.default.hint') : '', readonly ? text('views.shared.hint') : ''].filter(Boolean).join(', ') ||
        undefined;

    const viewItems: MenuItem[] = views.map((view) => ({
        id: `views.view.${view.id}`,
        label: view.name,
        hint: hint(view.default === true, view.readonly === true),
        selected: () => view.id === current?.id,
        action: () => gridInterface.applyView(view.id)
    }));

    return [
        {
            id: 'views.standard',
            label: text('views.standard'),
            hint: hint(noDefault, false),
            selected: () => current === null,
            action: () => gridInterface.applyView(null)
        },
        ...viewItems,
        { type: 'separator', id: 'views.separator' },
        {
            id: 'views.save',
            label: text('views.save'),
            disabled: () => !own || !modified,
            action: () => gridInterface.saveView()
        },
        {
            id: 'views.saveAs',
            label: text('views.saveAs'),
            action: () => askName(ctx, button, null)
        },
        {
            id: 'views.revert',
            label: text('views.revert'),
            disabled: () => !modified,
            // the view shown applied again - Standard: the config's state
            action: () => gridInterface.applyView(current?.id ?? null)
        },
        { type: 'separator', id: 'views.manageSeparator' },
        {
            id: 'views.rename',
            label: text('views.rename'),
            disabled: () => !own,
            action: () => askName(ctx, button, current)
        },
        {
            id: 'views.delete',
            label: text('views.delete'),
            disabled: () => !own,
            action: () => {
                if (current) {
                    gridInterface.deleteView(current.id);
                }
            }
        },
        {
            id: 'views.setDefault',
            label: text('views.setDefault'),
            selected: () => isDefault,
            // Standard is the default when no view is: it can not be turned off there
            disabled: () => current === null && isDefault,
            action: () => gridInterface.setDefaultView(isDefault ? null : (current?.id ?? null))
        }
    ];
}

/**
 * What is wrong with a name typed for a view, null when nothing is: only spaces, or the name of another
 * view - in any case, the spaces at the ends taken off
 * @param views the views
 * @param renamed the view renamed, its own name is no other's. null for a new view
 */
export function viewNameProblem(name: string, views: readonly GridView[], renamed: GridView | null): TextId | null {
    const trimmed = name.trim().toLowerCase();
    if (!trimmed) {
        return 'views.name.empty';
    }
    const taken = views.some((view) => view.id !== renamed?.id && view.name.trim().toLowerCase() === trimmed);
    return taken ? 'views.name.taken' : null;
}

/**
 * Asks for the name of a view in a menu at the views button: *Save as new view…* (`renamed` null, the
 * input empty) and *Rename…* (the view's name in it). Save / Rename does it and closes the menu - Enter
 * in the input too - when the name is fine; Cancel and Esc close it. The focus is in the input, and goes
 * back to the button when it closes
 */
function askName(ctx: Grid, button: HTMLElement, renamed: GridView | null) {
    const gridInterface = ctx.gridInterface;
    const element = document.createElement('div');
    element.className = 'simple-html-grid-view-name';
    element.setAttribute('data-menu-id', 'views.name');
    const inputId = `${ctx.ariaIdPrefix}-view-name`;
    const problemId = `${ctx.ariaIdPrefix}-view-name-problem`;
    let name = renamed?.name ?? '';
    const text = (id: TextId) => gridText(ctx, id);

    const done = () => {
        if (viewNameProblem(name, gridInterface.getViews(), renamed)) {
            return;
        }
        removeContextMenu(ctx);
        if (renamed) {
            gridInterface.renameView(renamed.id, name);
        } else {
            gridInterface.saveViewAs(name);
        }
    };

    const paint = () => {
        const problem = viewNameProblem(name, gridInterface.getViews(), renamed);
        render(
            html`<label class="simple-html-grid-view-name-label" for=${inputId}>${text('views.name')}</label>
                <input
                    id=${inputId}
                    class="simple-html-grid-view-name-input"
                    type="text"
                    autocomplete="off"
                    aria-invalid=${problem ? 'true' : 'false'}
                    aria-describedby=${problemId}
                    .value=${live(name)}
                    @input=${(event: Event) => {
                        name = (event.target as HTMLInputElement).value;
                        paint();
                    }}
                    @keydown=${(event: KeyboardEvent) => {
                        // not the Enter that ends the composing of a character (an input method editor)
                        if (event.key === 'Enter' && !event.isComposing) {
                            event.preventDefault();
                            done();
                        }
                    }}
                />
                <div
                    id=${problemId}
                    class="simple-html-grid-view-name-problem ${problem === 'views.name.taken' ? 'simple-html-grid-view-name-taken' : ''}"
                    aria-live="polite"
                >
                    ${problem ? text(problem) : nothing}
                </div>
                <div class="simple-html-grid-view-name-buttons">
                    <button type="button" class="simple-html-grid-button" @click=${() => removeContextMenu(ctx)}>
                        ${text('views.name.cancel')}
                    </button>
                    <button
                        type="button"
                        class="simple-html-grid-button simple-html-grid-button-primary"
                        aria-disabled=${problem ? 'true' : nothing}
                        @click=${done}
                    >
                        ${text(renamed ? 'views.name.rename' : 'views.name.save')}
                    </button>
                </div>`,
            element
        );
    };
    paint();

    showMenu(ctx, [{ type: 'block', id: 'views.name', element }], menuContext(ctx), placeAt(button));
    const input = element.querySelector<HTMLInputElement>('input');
    input?.focus();
    input?.select();
}
