import { html, nothing, type TemplateResult } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import type { TextId } from '../../texts';
import type { Grid } from '../grid';
import type { DetailForm } from '../gridConfig';
import { copyDetailForm, DETAIL_FORM_MIN_WIDTH, detailFormWidth } from './detailForm';
import { getColumnLabel } from './getColumnLabel';
import { getLayoutFields } from './getLayoutFields';
import { type GridConfigTab, tabId, tabPanelId } from './gridConfigTabs';
import { gridText } from './gridText';
import { keyText } from './keyText';
import { multilineOf } from './multilineText';

/**
 * The *Detail form* tab of the grid config dialog (columnSettings.ts): what the detail form
 * (detailForm.ts, `GridState.detailForm`) shows.
 *
 * - *Show the detail form*: a checkbox
 * - *Width (px)*: a number, at least DETAIL_FORM_MIN_WIDTH - its hint says that the form is under the
 *   rows where they would get too little room beside it (detailFormSpace)
 * - *Fields of the form*: a listbox of every field the form can show - the form's fields first, in
 *   their order, then the other fields of the layout, then the other columns of the config (not in the
 *   layout: the form can show what the grid does not). Each option has a box that is checked when the
 *   field is in the form (`aria-checked`), its label, its type and a badge: *Several lines* for a
 *   multiline field, *Hidden* for a column that is not in the layout. One stop of Tab; the arrows, Home,
 *   End, PageUp / PageDown pick one (`aria-activedescendant`), Space puts it in the form or takes it
 *   out, Alt+ArrowUp / Alt+ArrowDown move it. A click on its box checks it, on the rest picks it.
 * - *Move up* / *Move down*: the field picked, up or down the list - its place in the form
 *
 * What it edits is a draft (DetailFormDraft) in the dialog's draft: the grid changes on Apply only
 * (applyDetailForm), *Reset form* goes back to the detail form the grid starts with.
 */

/**
 * What the tab edits, changed in place until Apply: part of the dialog's draft (ColumnSettings)
 */
export interface DetailFormDraft {
    /** shows the form */
    show: boolean;
    /** its width in px */
    width: number;
    /** every field the form can show, in the order of the list: the form's fields are in their order */
    order: string[];
    /** the fields in the form */
    included: Set<string>;
    /** the field picked in the list: Move up and Move down move it */
    active: string;
}

/** what the arrows of the list move by, PageUp and PageDown */
const PAGE = 10;

/**
 * The draft of a detail form: its fields first in their order, then the other fields of the layout,
 * then the other columns of the config. The first one picked
 */
export function detailFormDraft(ctx: Grid, form: DetailForm): DetailFormDraft {
    const columns = Object.keys(ctx.gridInterface.__getGridConfig().columns);
    const order = [...new Set([...form.fields, ...getLayoutFields(ctx.gridInterface), ...columns])];
    return {
        show: form.show,
        width: detailFormWidth(form),
        order,
        included: new Set(form.fields),
        active: order[0] ?? ''
    };
}

/**
 * The detail form a draft makes: the fields checked, in the order of the list
 */
export function detailFormOf(draft: DetailFormDraft): DetailForm {
    return { show: draft.show, fields: draft.order.filter((field) => draft.included.has(field)), width: draft.width };
}

/**
 * Apply: the draft's detail form is the state's (`setState({ detailForm })`), when it differs from it
 */
export function applyDetailForm(ctx: Grid, draft: DetailFormDraft) {
    const next = detailFormOf(draft);
    const now = copyDetailForm(ctx.gridInterface.__getGridConfig().detailForm);
    const same =
        now.show === next.show &&
        detailFormWidth(now) === next.width &&
        now.fields.length === next.fields.length &&
        now.fields.every((field, index) => field === next.fields[index]);
    if (!same) {
        ctx.gridInterface.setState({ detailForm: next });
    }
}

/**
 * *Reset form*: the draft of the detail form the grid starts with (`GridConfig.detailForm`,
 * `initialState.detailForm`). The field picked stays picked
 */
export function resetDetailFormDraft(ctx: Grid, draft: DetailFormDraft) {
    const start = detailFormDraft(ctx, ctx.gridInterface.__getStartDetailForm());
    Object.assign(draft, start, { active: start.order.includes(draft.active) ? draft.active : start.active });
}

/**
 * the id of an element of the tab, unique in the page: a page can have several grids
 */
function idOf(ctx: Grid, part: string) {
    return `${ctx.ariaIdPrefix}-settings-detail-${part}`;
}

/**
 * The tab's panel: its settings while the tab is shown, empty and hidden while it is not - it is there
 * for the tab's `aria-controls`
 * @param tab the tab shown
 * @param update renders the dialog again, after a change of the draft
 */
export function detailFormTabPanel(
    ctx: Grid,
    dialog: HTMLElement,
    draft: DetailFormDraft,
    tab: GridConfigTab,
    update: () => void
): TemplateResult {
    const shown = tab === 'detailForm';
    return html`<div
        class="filter-editor-body detail-form-settings simple-html-dialog-scroller"
        role="tabpanel"
        id=${tabPanelId(ctx, 'detailForm')}
        aria-labelledby=${tabId(ctx, 'detailForm')}
        ?hidden=${!shown}
    >
        ${shown ? settings(ctx, dialog, draft, update) : nothing}
    </div>`;
}

/**
 * The settings of the tab: Show the detail form, Width, the list of the fields, Move up / Move down
 */
function settings(ctx: Grid, dialog: HTMLElement, draft: DetailFormDraft, update: () => void): TemplateResult {
    const gridInterface = ctx.gridInterface;
    const text = (id: TextId) => gridText(ctx, id);
    const layout = new Set(getLayoutFields(gridInterface));
    const index = draft.order.indexOf(draft.active);
    const optionId = (at: number) => idOf(ctx, `option-${at}`);

    const pick = (at: number) => {
        draft.active = draft.order[at];
        update();
        dialog.querySelector(`#${optionId(at)}`)?.scrollIntoView({ block: 'nearest' });
    };
    const toggle = (field: string) => {
        if (draft.included.has(field)) {
            draft.included.delete(field);
        } else {
            draft.included.add(field);
        }
        update();
    };
    /** moves the field picked up (-1) or down (1) the list: its place in the form */
    const move = (step: -1 | 1) => {
        const to = index + step;
        if (index === -1 || to < 0 || to >= draft.order.length) {
            return;
        }
        draft.order.splice(index, 1);
        draft.order.splice(to, 0, draft.active);
        pick(to);
    };

    const keydown = (event: KeyboardEvent) => {
        const last = draft.order.length - 1;
        if (event.ctrlKey || event.metaKey) {
            return;
        }
        if (event.altKey) {
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                event.preventDefault();
                move(event.key === 'ArrowUp' ? -1 : 1);
            }
            return;
        }
        const step: Record<string, number> = { ArrowDown: 1, ArrowUp: -1, PageDown: PAGE, PageUp: -PAGE };
        let next = -1;
        if (Object.hasOwn(step, event.key)) {
            next = Math.min(Math.max(index + step[event.key], 0), last);
        } else if (event.key === 'Home') {
            next = 0;
        } else if (event.key === 'End') {
            next = last;
        } else if (event.key === ' ' && draft.active) {
            event.preventDefault();
            toggle(draft.active);
            return;
        }
        if (next !== -1) {
            event.preventDefault();
            pick(next);
        }
    };

    /** the type of a field, as in the Columns tab: a lookup column is one of its own */
    const typeName = (field: string) =>
        text(
            gridInterface.__getLookupColumn(field)
                ? 'columnSettings.type.lookup'
                : `columnSettings.type.${gridInterface.getDatasource().getField(field).type}`
        );

    const widthId = idOf(ctx, 'width');
    const widthHintId = idOf(ctx, 'width-hint');
    const fieldsId = idOf(ctx, 'fields');
    const fieldsHintId = idOf(ctx, 'fields-hint');

    return html`<label class="column-settings-check">
            <input
                type="checkbox"
                class="detail-form-settings-show"
                .checked=${live(draft.show)}
                @change=${(event: Event) => {
                    draft.show = (event.target as HTMLInputElement).checked;
                    update();
                }}
            /><span>${text('columnSettings.detailForm.show')}</span>
        </label>
        <div class="column-settings-field">
            <label class="column-settings-label" for=${widthId}>${text('columnSettings.detailForm.width')}</label>
            <div class="column-settings-input-row">
                <input
                    id=${widthId}
                    class="filter-editor-value detail-form-settings-width"
                    type="number"
                    min=${DETAIL_FORM_MIN_WIDTH}
                    step="10"
                    .value=${live(String(draft.width))}
                    aria-describedby=${widthHintId}
                    @change=${(event: Event) => {
                        const width = Number((event.target as HTMLInputElement).value);
                        // a number of px, at least the least width. Anything else: the width it had
                        if (Number.isFinite(width) && width > 0) {
                            draft.width = Math.max(Math.round(width), DETAIL_FORM_MIN_WIDTH);
                        }
                        update();
                    }}
                />
            </div>
            <div class="column-settings-hint" id=${widthHintId}>${text('columnSettings.detailForm.width.hint')}</div>
        </div>
        <div class="column-settings-field">
            <span class="column-settings-label" id=${fieldsId}>${text('columnSettings.detailForm.fields')}</span>
            <div
                class="detail-form-settings-list simple-html-dialog-scroller"
                role="listbox"
                tabindex="0"
                aria-labelledby=${fieldsId}
                aria-describedby=${fieldsHintId}
                aria-activedescendant=${index === -1 ? nothing : optionId(index)}
                @keydown=${keydown}
            >
                ${draft.order.map((field, at) => {
                    const included = draft.included.has(field);
                    const multiline = multilineOf(
                        gridInterface.getDatasource().getField(field),
                        gridInterface.__getGridConfig().columns[field]
                    );
                    return html`<div
                        class="column-settings-option detail-form-settings-option"
                        role="option"
                        id=${optionId(at)}
                        data-field=${field}
                        aria-selected=${field === draft.active ? 'true' : 'false'}
                        aria-checked=${included ? 'true' : 'false'}
                        @click=${() => pick(at)}
                    >
                        <span
                            class="detail-form-settings-box"
                            aria-hidden="true"
                            @click=${() => toggle(field)}
                            >${included ? '✓' : ''}</span
                        >
                        <span class="column-settings-option-label">${getColumnLabel(ctx, field)}</span>
                        <span class="column-settings-option-type">${typeName(field)}</span>
                        ${multiline ? html`<span class="column-settings-badge">${text('columnSettings.detailForm.multiline')}</span>` : nothing}
                        ${layout.has(field) ? nothing : html`<span class="column-settings-badge">${text('columnSettings.detailForm.hidden')}</span>`}
                    </div>`;
                })}
            </div>
            <div class="column-settings-hint" id=${fieldsHintId}>${keyText(ctx, 'columnSettings.detailForm.fields.hint')}</div>
            <div class="detail-form-settings-moves">
                <button
                    type="button"
                    class="simple-html-grid-button"
                    aria-keyshortcuts="Alt+ArrowUp"
                    aria-disabled=${index <= 0 ? 'true' : nothing}
                    @click=${() => move(-1)}
                >
                    ${text('columnSettings.detailForm.moveUp')}
                </button>
                <button
                    type="button"
                    class="simple-html-grid-button"
                    aria-keyshortcuts="Alt+ArrowDown"
                    aria-disabled=${index === -1 || index === draft.order.length - 1 ? 'true' : nothing}
                    @click=${() => move(1)}
                >
                    ${text('columnSettings.detailForm.moveDown')}
                </button>
            </div>
        </div>`;
}

/**
 * The footer's button of the tab, at its left end where the Columns tab has Reset column and Reset all:
 * *Reset form*
 */
export function detailFormResetButton(ctx: Grid, draft: DetailFormDraft, update: () => void): TemplateResult {
    return html`<span class="column-settings-resets">
        <button
            type="button"
            class="simple-html-grid-button"
            data-tooltip=${gridText(ctx, 'columnSettings.detailForm.reset.tooltip')}
            @click=${() => {
                resetDetailFormDraft(ctx, draft);
                update();
            }}
        >
            ${gridText(ctx, 'columnSettings.detailForm.reset')}
        </button>
    </span>`;
}
