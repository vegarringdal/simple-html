import { html, nothing, type TemplateResult } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import { TYPE_FORMAT_TYPES, type TypeFormats } from '../columnFormat';
import type { Grid } from '../grid';
import type { MenuItem } from '../gridMenus';
import { formatName, typeFormatSubmenu } from './formatSubmenu';
import { type GridConfigTab, tabId, tabPanelId } from './gridConfigTabs';
import { gridText } from './gridText';

/**
 * The Defaults tab of the grid config dialog (columnSettings.ts): the settings of the grid, not of a column.
 *
 * - **Formats by type** (`GridState.typeFormats`, TypeFormats in columnFormat.ts): the format of every
 *   date, datetime and number column without a date or number format of its own - a picker each, of the
 *   entries of Format › (formatSubmenu.ts), Default the field's formatter. The Columns tab shows it in a
 *   column's picker, `Default: Norwegian`, and in its preview.
 * - **Show the views button** (`GridConfig.viewsButton`, `updateConfig()`): the button at the footer's
 *   left end that saves, switches, renames and deletes the views. Kept by `exportConfig()`.
 * - **Default view** (`GridView.default`, `gridInterface.setDefaultView()`): the view the grid opens
 *   with, Standard (the config's state) or one of the views - as *Default view* in the views menu. With
 *   no views it is greyed out and says how to save one.
 *
 * What it edits is a copy (DefaultsDraft): Apply of the dialog sets the formats with the columns'
 * (`setState({ formats, typeFormats })`), the views button and the default view (applyDefaults); Cancel
 * drops it. Reset
 * formats in the footer goes back to the formats by type the grid starts with.
 */

/** what the tab edits, changed in place until Apply */
export interface DefaultsDraft {
    /** the formats by type: a copy of the state's when the dialog opened */
    typeFormats: TypeFormats;
    /** the id of the default view, null for Standard: the one when the dialog opened */
    defaultView: string | null;
    /** whether the views button is shown (`GridConfig.viewsButton`): as it is when the dialog opened */
    viewsButton: boolean;
}

/** the draft of the tab: the grid's formats by type and default view now */
export function defaultsDraft(ctx: Grid): DefaultsDraft {
    const gridInterface = ctx.gridInterface;
    return {
        typeFormats: gridInterface.getState().typeFormats,
        defaultView: gridInterface.getViews().find((view) => view.default)?.id ?? null,
        viewsButton: gridInterface.__getGridConfig().viewsButton
    };
}

/**
 * Apply of the dialog, the views button and the default view: each set when it changed (`updateConfig`,
 * `views-change`). The formats by type are set by the dialog's Apply, with the columns' formats in one
 * setState
 */
export function applyDefaults(ctx: Grid, draft: DefaultsDraft) {
    const gridInterface = ctx.gridInterface;
    if (draft.viewsButton !== gridInterface.__getGridConfig().viewsButton) {
        gridInterface.updateConfig({ viewsButton: draft.viewsButton });
    }
    const views = gridInterface.getViews();
    // a view deleted since the dialog opened: Standard
    if (draft.defaultView !== null && !views.some((view) => view.id === draft.defaultView)) {
        draft.defaultView = null;
    }
    const now = views.find((view) => view.default)?.id ?? null;
    if (draft.defaultView !== now) {
        gridInterface.setDefaultView(draft.defaultView);
    }
}

/** the id of an element of the tab, unique in the page */
function idOf(ctx: Grid, part: string) {
    return `${ctx.ariaIdPrefix}-settings-defaults-${part}`;
}

/**
 * The panel of the tab: its settings while it is shown, empty while another tab is
 * @param update renders the dialog again, after a change of the draft
 */
export function defaultsTabPanel(ctx: Grid, draft: DefaultsDraft, tab: GridConfigTab, update: () => void): TemplateResult {
    const shown = tab === 'defaults';
    return html`<div
        class="filter-editor-body grid-defaults-settings simple-html-dialog-scroller"
        role="tabpanel"
        id=${tabPanelId(ctx, 'defaults')}
        aria-labelledby=${tabId(ctx, 'defaults')}
        ?hidden=${!shown}
    >
        ${shown ? html`${formatSettings(ctx, draft, update)} ${viewSettings(ctx, draft, update)}` : nothing}
    </div>`;
}

/** Formats by type: a picker of each type's format */
function formatSettings(ctx: Grid, draft: DefaultsDraft, update: () => void): TemplateResult {
    const text = (id: Parameters<typeof gridText>[1]) => gridText(ctx, id);
    const hintId = idOf(ctx, 'formats-hint');
    return html`<div class="column-settings-heading" id=${idOf(ctx, 'formats')}>${text('columnSettings.defaults.formats')}</div>
        <div class="column-settings-hint" id=${hintId}>${text('columnSettings.defaults.formats.hint')}</div>
        ${TYPE_FORMAT_TYPES.map((type) => {
            const label = text(`columnSettings.type.${type}`);
            const format = type === 'number' ? { number: draft.typeFormats.number } : { date: draft.typeFormats[type] };
            const picked = formatName(ctx, format) ?? text('header.format.default');
            return html`<div class="column-settings-field">
                <span class="column-settings-label">${label}</span>
                <div class="column-settings-input-row">
                    <button
                        type="button"
                        class="filter-editor-pick column-settings-format grid-defaults-format"
                        data-type=${type}
                        aria-haspopup="menu"
                        aria-label=${`${label}: ${picked}`}
                        aria-describedby=${hintId}
                        data-tooltip=${text('columnSettings.defaults.format.tooltip')}
                        @click=${(event: MouseEvent) => {
                            // the entries of Format ›, on the type's format of the draft
                            const entries = typeFormatSubmenu(ctx, type, {
                                current: () =>
                                    type === 'number' ? { number: draft.typeFormats.number } : { date: draft.typeFormats[type] },
                                set: (next) => {
                                    if (type === 'number') {
                                        draft.typeFormats.number = next?.number;
                                    } else {
                                        draft.typeFormats[type] = next?.date;
                                    }
                                    // Default: the type left out
                                    if (draft.typeFormats[type] === undefined) {
                                        delete draft.typeFormats[type];
                                    }
                                    update();
                                }
                            }).entries;
                            ctx.gridInterface.openMenu(event.currentTarget as HTMLElement, entries);
                        }}
                    >
                        <span class="filter-editor-pick-text">${picked}</span>
                    </button>
                </div>
            </div>`;
        })}`;
}

/**
 * Default view: a picker of Standard and the views - a menu, as the pickers of the formats - greyed out
 * without views
 */
function viewSettings(ctx: Grid, draft: DefaultsDraft, update: () => void): TemplateResult {
    const text = (id: Parameters<typeof gridText>[1]) => gridText(ctx, id);
    const views = ctx.gridInterface.getViews();
    const hintId = idOf(ctx, 'default-view-hint');
    const current = views.find((view) => view.id === draft.defaultView);
    const picked = current?.name ?? text('views.standard');
    const label = text('columnSettings.defaults.defaultView');
    const entry = (id: string | null, name: string): MenuItem => ({
        id: `columnSettings.defaults.defaultView.${id ?? ''}`,
        label: name,
        selected: () => (current?.id ?? null) === id,
        action: () => {
            draft.defaultView = id;
            update();
        }
    });
    const buttonHintId = idOf(ctx, 'views-button-hint');
    return html`<div class="column-settings-heading">${text('columnSettings.defaults.views')}</div>
        <div class="column-settings-field">
            <label class="column-settings-check">
                <input
                    type="checkbox"
                    class="grid-defaults-views-button"
                    aria-describedby=${buttonHintId}
                    .checked=${live(draft.viewsButton)}
                    @change=${(event: Event) => {
                        draft.viewsButton = (event.target as HTMLInputElement).checked;
                        update();
                    }}
                /><span>${text('columnSettings.defaults.viewsButton')}</span>
            </label>
            <div class="column-settings-hint" id=${buttonHintId}>${text('columnSettings.defaults.viewsButton.hint')}</div>
        </div>
        <div class="column-settings-field">
            <span class="column-settings-label">${label}</span>
            <div class="column-settings-input-row">
                <button
                    type="button"
                    class="filter-editor-pick column-settings-format grid-defaults-view"
                    aria-haspopup="menu"
                    aria-label=${`${label}: ${picked}`}
                    aria-describedby=${hintId}
                    ?disabled=${!views.length}
                    @click=${(event: MouseEvent) =>
                        ctx.gridInterface.openMenu(event.currentTarget as HTMLElement, [
                            entry(null, text('views.standard')),
                            ...views.map((view) => entry(view.id, view.name))
                        ])}
                >
                    <span class="filter-editor-pick-text">${picked}</span>
                </button>
            </div>
            <div class="column-settings-hint" id=${hintId}>
                ${text(views.length ? 'columnSettings.defaults.defaultView.hint' : 'columnSettings.defaults.noViews')}
            </div>
        </div>`;
}

/** the footer's Reset formats on the tab: the formats by type the grid starts with */
export function defaultsResetButton(ctx: Grid, draft: DefaultsDraft, update: () => void): TemplateResult {
    return html`<span class="column-settings-resets">
        <button
            type="button"
            class="simple-html-grid-button"
            data-tooltip=${gridText(ctx, 'columnSettings.defaults.reset.tooltip')}
            @click=${() => {
                draft.typeFormats = ctx.gridInterface.__getStartTypeFormats();
                update();
            }}
        >
            ${gridText(ctx, 'columnSettings.defaults.reset')}
        </button>
    </span>`;
}
