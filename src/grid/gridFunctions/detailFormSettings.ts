import { html, nothing, type TemplateResult } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import type { TextId } from '../../texts';
import type { Grid } from '../grid';
import type { DetailForm, DetailFormFieldOptions, DetailFormSection } from '../gridConfig';
import {
    copyDetailForm,
    copyFieldOptions,
    DETAIL_FORM_MIN_WIDTH,
    detailFormWidth,
    isDetailFormExpanded,
    isDetailFormSection
} from './detailForm';
import { followPointer, isPrimaryPress } from './followPointer';
import { getColumnLabel } from './getColumnLabel';
import { getLayoutFields } from './getLayoutFields';
import { type GridConfigTab, tabId, tabPanelId } from './gridConfigTabs';
import { gridText } from './gridText';
import { DRAG_HANDLE_ICON } from './icons';
import { keyText } from './keyText';
import { multilineOf } from './multilineText';
import { hideTooltip } from './tooltip';

/**
 * The *Detail form* tab of the grid config dialog (columnSettings.ts): what the detail form
 * (detailForm.ts, `GridState.detailForm`) shows.
 *
 * - *Show the detail form*: a checkbox
 * - *Expanded*: a checkbox - collapsed, the form is a narrow strip (`expanded: false`). The button of
 *   the form's title changes the same part of the state: the dialog shows what the form is now
 * - *Width (px)*, *Min width (px)*, *Max width (px)*: numbers, each at least DETAIL_FORM_MIN_WIDTH; the
 *   min and the max can be empty (none). The width is kept between them: the one typed keeps its value,
 *   the others follow it (setWidths). The hint says that a drag of the form's edge changes the width,
 *   and that the form is under the rows where they would get too little room beside it
 *   (detailFormSpace)
 * - *Fields of the form*: a listbox of every field the form can show and of its sections - the form's
 *   fields and sections first, in their order, then the other fields of the layout, then the other columns
 *   of the config (not in the layout: the form can show what the grid does not). A field's option has a
 *   box that is checked when the field is in the form (`aria-checked`), its label, its type, a badge -
 *   *Several lines* for a multiline field, *Hidden* for a column that is not in the layout - and a drag
 *   handle at its right. A section's option (DetailFormSection) is a row of its own: its name, *Section*,
 *   *Panel* for a panel, its handle - the fields under it, up to the next section, are in it. One stop of
 *   Tab; the arrows, Home, End, PageUp / PageDown pick one (`aria-activedescendant`), Space puts a field
 *   in the form or takes it out, Alt+ArrowUp / Alt+ArrowDown move it. A click on its box checks it, on the
 *   rest picks it. The handle drags it to another place - a line shows where it goes (dragField): a
 *   mouse, a pen or a finger
 * - *Move up* / *Move down*: the field or section picked, up or down the list - its place in the form.
 *   *Add section*: a new section under the one picked, picked - its name typed under the list
 * - *Settings of {field} in the form* (DetailFormFieldOptions, setFieldOption): *Min lines* for a field of
 *   several lines, *Space above (px)* and *Space below (px)*
 * - *Settings of the section {section}* (setSectionOption): *Name*, *Panel*, *Open at start* (not
 *   `collapsed`: its default - the header's button opens and closes it while the form is shown), *Space above /
 *   below (px)*, and *Remove section* - its fields stay, in the section before it
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
    /** expanded, else collapsed to a narrow strip */
    expanded: boolean;
    /** its width in px */
    width: number;
    /** its least width in px, undefined: none (150) */
    minWidth: number | undefined;
    /** its most width in px, undefined: none */
    maxWidth: number | undefined;
    /**
     * every field the form can show and its sections, in the order of the list: the form's fields and
     * sections in their order. A section is an object of its own here: the one picked is that object
     */
    order: (string | DetailFormSection)[];
    /** the fields in the form - every section is */
    included: Set<string>;
    /** the field or section picked in the list: Move up and Move down move it, its settings are under the list. '' none */
    active: string | DetailFormSection;
    /** the options of the fields (DetailForm.fieldOptions), a field taken out of the form keeps its own */
    options: Record<string, DetailFormFieldOptions>;
}

/** the most lines Min lines takes: the most a textarea of the form has */
const MAX_ROWS = 30;

/** what the arrows of the list move by, PageUp and PageDown */
const PAGE = 10;

/** the class of the option dragged by its handle */
const DRAGGED_CLASS = 'detail-form-settings-dragged';

/** the classes of the option the line of a drop is drawn on: over it, or under the last one */
const DROP_BEFORE_CLASS = 'detail-form-settings-drop-before';
const DROP_AFTER_CLASS = 'detail-form-settings-drop-after';

/** a drag this close (px) to the top or bottom of the list scrolls it, this many px a move */
const EDGE = 16;
const EDGE_SCROLL = 8;

/**
 * The draft of a detail form: its fields and sections first in their order (each section a copy), then
 * the other fields of the layout, then the other columns of the config. The first one picked
 */
export function detailFormDraft(ctx: Grid, form: DetailForm): DetailFormDraft {
    const columns = Object.keys(ctx.gridInterface.__getGridConfig().columns);
    const formFields = form.fields.filter((entry): entry is string => !isDetailFormSection(entry));
    const others = [...getLayoutFields(ctx.gridInterface), ...columns].filter((field) => !formFields.includes(field));
    const order = [...copyDetailForm(form).fields, ...new Set(others)];
    return {
        show: form.show,
        expanded: isDetailFormExpanded(form),
        width: detailFormWidth(form),
        minWidth: form.minWidth,
        maxWidth: form.maxWidth,
        order,
        included: new Set(formFields),
        active: order[0] ?? '',
        options: copyFieldOptions(form.fieldOptions) ?? {}
    };
}

/**
 * The detail form a draft makes: the fields checked and every section, in the order of the list.
 * `expanded` only when it is collapsed, the min and max width only when they are set, `fieldOptions` of
 * the fields checked only when one has some
 */
export function detailFormOf(draft: DetailFormDraft): DetailForm {
    const form: DetailForm = copyDetailForm({
        show: draft.show,
        fields: draft.order.filter((entry) => isDetailFormSection(entry) || draft.included.has(entry)),
        width: draft.width
    });
    if (!draft.expanded) {
        form.expanded = false;
    }
    if (draft.minWidth !== undefined) {
        form.minWidth = draft.minWidth;
    }
    if (draft.maxWidth !== undefined) {
        form.maxWidth = draft.maxWidth;
    }
    // the options of every field: one out of the form keeps its own for when it is put in again - Min lines
    // set on the Columns tab for a field not in it yet too
    const fieldOptions = copyFieldOptions(draft.options);
    if (fieldOptions) {
        form.fieldOptions = fieldOptions;
    }
    return form;
}

/**
 * Apply: the draft's detail form is the state's (`setState({ detailForm })`), when it differs from it
 */
export function applyDetailForm(ctx: Grid, draft: DetailFormDraft) {
    const next = detailFormOf(draft);
    const now = copyDetailForm(ctx.gridInterface.__getGridConfig().detailForm);
    const same =
        now.show === next.show &&
        isDetailFormExpanded(now) === isDetailFormExpanded(next) &&
        detailFormWidth(now) === next.width &&
        now.minWidth === next.minWidth &&
        now.maxWidth === next.maxWidth &&
        JSON.stringify(now.fields) === JSON.stringify(next.fields) &&
        JSON.stringify(now.fieldOptions ?? {}) === JSON.stringify(next.fieldOptions ?? {});
    if (!same) {
        ctx.gridInterface.setState({ detailForm: next });
    }
}

/**
 * *Reset form*: the draft of the detail form the grid starts with (`GridConfig.detailForm`,
 * `initialState.detailForm`). The field picked stays picked - a section is the start's first entry
 */
export function resetDetailFormDraft(ctx: Grid, draft: DetailFormDraft) {
    const start = detailFormDraft(ctx, ctx.gridInterface.__getStartDetailForm());
    const keep = typeof draft.active === 'string' && start.order.includes(draft.active);
    Object.assign(draft, start, { active: keep ? draft.active : start.active });
}

/**
 * A width typed in the tab: a number of px, rounded, at least DETAIL_FORM_MIN_WIDTH. null for anything
 * else - empty too
 */
function typedWidth(value: string): number | null {
    const width = Number(value);
    return value.trim() !== '' && Number.isFinite(width) && width > 0 ? Math.max(Math.round(width), DETAIL_FORM_MIN_WIDTH) : null;
}

/**
 * A width, min width or max width typed in the tab, into the draft: the one typed keeps its value, the
 * others follow it - min <= width <= max. A number that is none (and an empty width) leaves the draft
 * as it was; an empty min or max is none
 * @param part the input typed in
 */
export function setWidths(draft: DetailFormDraft, part: 'width' | 'minWidth' | 'maxWidth', value: string) {
    const typed = typedWidth(value);
    if (typed === null && (part === 'width' || value.trim() !== '')) {
        return;
    }
    if (part === 'width') {
        const min = draft.minWidth ?? DETAIL_FORM_MIN_WIDTH;
        draft.width = Math.min(Math.max(typed as number, min), draft.maxWidth ?? Number.POSITIVE_INFINITY);
    } else if (part === 'minWidth') {
        draft.minWidth = typed ?? undefined;
        if (typed !== null) {
            draft.width = Math.max(draft.width, typed);
            draft.maxWidth = draft.maxWidth === undefined ? undefined : Math.max(draft.maxWidth, typed);
        }
    } else {
        draft.maxWidth = typed ?? undefined;
        if (typed !== null) {
            draft.width = Math.min(draft.width, typed);
            draft.minWidth = draft.minWidth === undefined ? undefined : Math.min(draft.minWidth, typed);
        }
    }
}

/** a number typed: rounded, null when it is empty, no number, or not from `min` to `max` */
function typedNumber(value: string, min: number, max = Number.POSITIVE_INFINITY): number | null {
    const text = value.trim();
    const number = Math.round(Number(text));
    return text !== '' && Number.isFinite(number) && number >= min && number <= max ? number : null;
}

/**
 * An option of a field typed in the tab, into the draft: Min lines (a whole number 1 to 30, else none),
 * Space above / below (a number of px, rounded - 0 or anything else: none). A field left with no options
 * has no entry
 * @param value the input's value
 */
export function setFieldOption(draft: DetailFormDraft, field: string, name: keyof DetailFormFieldOptions, value: string) {
    const options: DetailFormFieldOptions = { ...draft.options[field] };
    const number = name === 'minRows' ? typedNumber(value, 1, MAX_ROWS) : typedNumber(value, 1);
    if (number === null) {
        delete options[name];
    } else {
        options[name] = number;
    }
    if (Object.keys(options).length) {
        draft.options[field] = options;
    } else {
        delete draft.options[field];
    }
}

/**
 * An option of a section typed in the tab, in place: its name (blanks: it keeps the one it had), Panel and
 * Collapsed (checked: `true`, else left out), Space above / below (a number of px, rounded - 0 or anything
 * else: none)
 * @param value the input's value: its text, or `checked` for Panel and Collapsed
 */
export function setSectionOption(section: DetailFormSection, name: keyof DetailFormSection, value: string | boolean) {
    if (name === 'section') {
        const text = String(value).trim();
        if (text) {
            section.section = text;
        }
    } else if (name === 'panel' || name === 'collapsed') {
        if (value === true) {
            section[name] = true;
        } else {
            delete section[name];
        }
    } else {
        const number = typedNumber(String(value), 1);
        if (number === null) {
            delete section[name];
        } else {
            section[name] = number;
        }
    }
}

/**
 * *Add section*: a new section with `name` under the entry picked - after the form's last field when
 * nothing is picked - picked
 */
export function addSection(draft: DetailFormDraft, name: string) {
    const section: DetailFormSection = { section: name };
    const at = draft.active === '' ? -1 : draft.order.indexOf(draft.active);
    const lastIncluded = draft.order.reduce<number>(
        (last, entry, index) => (isDetailFormSection(entry) || draft.included.has(entry) ? index : last),
        -1
    );
    draft.order.splice((at === -1 ? lastIncluded : at) + 1, 0, section);
    draft.active = section;
}

/**
 * *Remove section*: the section picked out of the list - its fields stay where they are, in the section
 * before it. The entry that takes its place is picked
 */
export function removeSection(draft: DetailFormDraft, section: DetailFormSection) {
    const at = draft.order.indexOf(section);
    if (at === -1) {
        return;
    }
    draft.order.splice(at, 1);
    draft.active = draft.order[Math.min(at, draft.order.length - 1)] ?? '';
}

/**
 * The place a field is moved to: `to` is the gap before the option of that index (the length: after
 * the last). The field is picked
 * @param from the index of the field in the list
 */
export function moveField(draft: DetailFormDraft, from: number, to: number) {
    const field = draft.order[from];
    draft.order.splice(from, 1);
    draft.order.splice(to > from ? to - 1 : to, 0, field);
    draft.active = field;
}

/**
 * The gap of the list a drag is over: before the first option whose middle is under the pointer, the
 * number of options after the last
 * @param y the pointer's clientY
 */
function gapAt(options: HTMLElement[], y: number): number {
    const at = options.findIndex((option) => {
        const rect = option.getBoundingClientRect();
        return y < rect.top + rect.height / 2;
    });
    return at === -1 ? options.length : at;
}

/**
 * A press on the drag handle of a field: the field is picked, and dragged to another place of the list
 * while the pointer moves (followPointer, the handle captures it). A line between two options shows
 * where it goes, the list scrolls near its top and bottom. Let go, it is moved there (moveField) - not
 * when that is where it was. pointercancel moves nothing
 * @param from the index of the field
 */
function dragField(down: PointerEvent, draft: DetailFormDraft, from: number, update: () => void) {
    if (!isPrimaryPress(down)) {
        return;
    }
    const handle = down.currentTarget as HTMLElement;
    const list = handle.closest('[role="listbox"]') as HTMLElement;
    const options = () => Array.from(list.querySelectorAll<HTMLElement>('[role="option"]'));
    draft.active = draft.order[from];
    update();
    // the handle's tooltip would stay where the drag started
    hideTooltip();

    let gap = from;
    const clear = () => {
        for (const option of options()) {
            option.classList.remove(DRAGGED_CLASS, DROP_BEFORE_CLASS, DROP_AFTER_CLASS);
        }
    };
    handle.setPointerCapture(down.pointerId);
    options()[from]?.classList.add(DRAGGED_CLASS);
    followPointer(handle, down, {
        move: (event) => {
            const rect = list.getBoundingClientRect();
            if (event.clientY < rect.top + EDGE) {
                list.scrollTop -= EDGE_SCROLL;
            } else if (event.clientY > rect.bottom - EDGE) {
                list.scrollTop += EDGE_SCROLL;
            }
            const all = options();
            gap = gapAt(all, event.clientY);
            clear();
            all[from]?.classList.add(DRAGGED_CLASS);
            // no line where it is: before or after itself
            if (gap !== from && gap !== from + 1) {
                if (gap < all.length) {
                    all[gap].classList.add(DROP_BEFORE_CLASS);
                } else {
                    all[all.length - 1].classList.add(DROP_AFTER_CLASS);
                }
            }
        },
        up: () => {
            clear();
            if (gap !== from && gap !== from + 1) {
                moveField(draft, from, gap);
                update();
            }
        },
        cancel: clear
    });
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
    update: () => void,
    isMultiline?: (field: string) => boolean
): TemplateResult {
    const shown = tab === 'detailForm';
    return html`<div
        class="filter-editor-body detail-form-settings simple-html-dialog-scroller"
        role="tabpanel"
        id=${tabPanelId(ctx, 'detailForm')}
        aria-labelledby=${tabId(ctx, 'detailForm')}
        ?hidden=${!shown}
    >
        ${shown ? settings(ctx, dialog, draft, update, multilineIn(ctx, isMultiline)) : nothing}
    </div>`;
}

/**
 * The settings of the tab: Show the detail form, Expanded, the widths, the list of the fields, Move up /
 * Move down
 */
function settings(
    ctx: Grid,
    dialog: HTMLElement,
    draft: DetailFormDraft,
    update: () => void,
    isMultiline: (field: string) => boolean
): TemplateResult {
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
            // a section is always in the form
            if (typeof draft.active === 'string') {
                toggle(draft.active);
            }
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

    const widthHintId = idOf(ctx, 'width-hint');
    const fieldsId = idOf(ctx, 'fields');
    const fieldsHintId = idOf(ctx, 'fields-hint');

    /** a checkbox of the tab and its text */
    const check = (className: string, label: TextId, checked: boolean, set: (checked: boolean) => void, hintId?: string) =>
        html`<label class="column-settings-check">
            <input
                type="checkbox"
                class=${className}
                .checked=${live(checked)}
                aria-describedby=${hintId ?? nothing}
                @change=${(event: Event) => {
                    set((event.target as HTMLInputElement).checked);
                    update();
                }}
            /><span>${text(label)}</span>
        </label>`;

    /**
     * an input of a width: its label over it. The min and max are empty when they are none, the
     * placeholder says what that is
     */
    const widthInput = (
        part: 'width' | 'minWidth' | 'maxWidth',
        label: TextId,
        value: number | undefined,
        placeholder?: string
    ) => {
        const id = idOf(ctx, part);
        return html`<div class="detail-form-settings-width-field">
            <label class="column-settings-label" for=${id}>${text(label)}</label>
            <input
                id=${id}
                class="filter-editor-value detail-form-settings-${part}"
                type="number"
                min=${DETAIL_FORM_MIN_WIDTH}
                step="10"
                placeholder=${placeholder ?? nothing}
                .value=${live(value === undefined ? '' : String(value))}
                aria-describedby=${widthHintId}
                @change=${(event: Event) => {
                    setWidths(draft, part, (event.target as HTMLInputElement).value);
                    update();
                }}
            />
        </div>`;
    };

    return html`${check('detail-form-settings-show', 'columnSettings.detailForm.show', draft.show, (checked) => {
        draft.show = checked;
    })}
        <div class="column-settings-field">
            ${check(
                'detail-form-settings-expanded',
                'columnSettings.detailForm.expanded',
                draft.expanded,
                (checked) => {
                    draft.expanded = checked;
                },
                idOf(ctx, 'expanded-hint')
            )}
            <div class="column-settings-hint" id=${idOf(ctx, 'expanded-hint')}>${text('columnSettings.detailForm.expanded.hint')}</div>
        </div>
        <div class="column-settings-field">
            <div class="detail-form-settings-widths">
                ${widthInput('width', 'columnSettings.detailForm.width', draft.width)}
                ${widthInput('minWidth', 'columnSettings.detailForm.minWidth', draft.minWidth, String(DETAIL_FORM_MIN_WIDTH))}
                ${widthInput('maxWidth', 'columnSettings.detailForm.maxWidth', draft.maxWidth, text('columnSettings.detailForm.maxWidth.none'))}
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
                ${draft.order.map((entry, at) => {
                    const handle = html`<span
                        class="simple-html-grid-drag-handle detail-form-settings-handle"
                        aria-hidden="true"
                        data-tooltip=${text('columnSettings.detailForm.drag')}
                        @pointerdown=${(event: PointerEvent) => dragField(event, draft, at, update)}
                        @click=${(event: Event) => event.stopPropagation()}
                        >${DRAG_HANDLE_ICON}</span
                    >`;
                    if (isDetailFormSection(entry)) {
                        // a row of its own: in the form always, no box
                        return html`<div
                            class="column-settings-option detail-form-settings-option detail-form-settings-section-option"
                            role="option"
                            id=${optionId(at)}
                            data-section=${entry.section}
                            aria-selected=${entry === draft.active ? 'true' : 'false'}
                            @click=${() => pick(at)}
                        >
                            <span class="detail-form-settings-section-mark" aria-hidden="true">§</span>
                            <span class="column-settings-option-label">${entry.section}</span>
                            <span class="column-settings-option-type">${text('columnSettings.detailForm.sectionType')}</span>
                            ${entry.panel ? html`<span class="column-settings-badge">${text('columnSettings.detailForm.panelBadge')}</span>` : nothing}
                            ${handle}
                        </div>`;
                    }
                    const field = entry;
                    const included = draft.included.has(field);
                    const multiline = isMultiline(field);
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
                        ${handle}
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
                <button
                    type="button"
                    class="simple-html-grid-button detail-form-settings-add-section"
                    @click=${() => {
                        addSection(draft, text('columnSettings.detailForm.newSection'));
                        update();
                        // its name next: the input under the list
                        dialog.querySelector<HTMLInputElement>('.detail-form-settings-section-name')?.select();
                    }}
                >
                    ${text('columnSettings.detailForm.addSection')}
                </button>
            </div>
        </div>
        ${
            isDetailFormSection(draft.active)
                ? sectionSettings(ctx, dialog, draft, draft.active, update)
                : draft.active
                  ? fieldSettings(ctx, draft, draft.active, update, isMultiline)
                  : nothing
        }`;
}

/** an input of a number of px or lines under the list: its label over it, empty when it has none */
function numberInput(
    ctx: Grid,
    name: string,
    label: TextId,
    value: number | undefined,
    set: (value: string) => void,
    limits: { placeholder: string; min: number; max?: number }
): TemplateResult {
    const id = idOf(ctx, `option-${name}`);
    return html`<div class="detail-form-settings-width-field">
        <label class="column-settings-label" for=${id}>${gridText(ctx, label)}</label>
        <input
            id=${id}
            class=${`filter-editor-value detail-form-settings-${name}`}
            type="number"
            min=${limits.min}
            max=${limits.max ?? nothing}
            step="1"
            placeholder=${limits.placeholder}
            .value=${live(value === undefined ? '' : String(value))}
            @change=${(event: Event) => set((event.target as HTMLInputElement).value)}
        />
    </div>`;
}

/**
 * The settings of the field picked in the list (DetailFormFieldOptions): Min lines for a field of several
 * lines, Space above / below. A group named by its heading
 */
function fieldSettings(
    ctx: Grid,
    draft: DetailFormDraft,
    field: string,
    update: () => void,
    isMultiline: (field: string) => boolean
): TemplateResult {
    const options = draft.options[field] ?? {};
    const headingId = idOf(ctx, 'field-heading');
    const multiline = isMultiline(field);
    const set = (name: keyof DetailFormFieldOptions) => (value: string) => {
        setFieldOption(draft, field, name, value);
        update();
    };
    return html`<div class="column-settings-field detail-form-settings-field" role="group" aria-labelledby=${headingId}>
        <span class="column-settings-label" id=${headingId}
            >${gridText(ctx, 'columnSettings.detailForm.field', { field: getColumnLabel(ctx, field) })}</span
        >
        <div class="detail-form-settings-widths">
            ${multiline ? numberInput(ctx, 'minRows', 'columnSettings.detailForm.minRows', options.minRows, set('minRows'), { placeholder: '3', min: 1, max: MAX_ROWS }) : nothing}
            ${numberInput(ctx, 'paddingTop', 'columnSettings.detailForm.paddingTop', options.paddingTop, set('paddingTop'), { placeholder: '0', min: 0 })}
            ${numberInput(ctx, 'paddingBottom', 'columnSettings.detailForm.paddingBottom', options.paddingBottom, set('paddingBottom'), { placeholder: '0', min: 0 })}
        </div>
    </div>`;
}

/**
 * The settings of the section picked in the list (DetailFormSection): its name, Panel, Collapsed, Space
 * above / below and Remove section. A group named by its heading
 */
function sectionSettings(
    ctx: Grid,
    dialog: HTMLElement,
    draft: DetailFormDraft,
    section: DetailFormSection,
    update: () => void
): TemplateResult {
    const text = (id: TextId) => gridText(ctx, id);
    const headingId = idOf(ctx, 'section-heading');
    const nameId = idOf(ctx, 'section-name');
    const hintId = idOf(ctx, 'section-hint');
    const set = (name: keyof DetailFormSection) => (value: string | boolean) => {
        setSectionOption(section, name, value);
        update();
    };
    /** a checkbox of the section: `invert` - checked when the option is not `true` (Open at start: not collapsed) */
    const check = (name: 'panel' | 'collapsed', className: string, label: TextId, invert = false) =>
        html`<label class="column-settings-check">
            <input
                type="checkbox"
                class=${`detail-form-settings-${className}`}
                .checked=${live((section[name] === true) !== invert)}
                @change=${(event: Event) => set(name)((event.target as HTMLInputElement).checked !== invert)}
            /><span>${text(label)}</span>
        </label>`;
    return html`<div class="column-settings-field detail-form-settings-field" role="group" aria-labelledby=${headingId}>
        <span class="column-settings-label" id=${headingId}
            >${gridText(ctx, 'columnSettings.detailForm.sectionSettings', { section: section.section })}</span
        >
        <label class="column-settings-label" for=${nameId}>${text('columnSettings.detailForm.section')}</label>
        <input
            id=${nameId}
            class="filter-editor-value detail-form-settings-section-name"
            type="text"
            autocomplete="off"
            .value=${live(section.section)}
            aria-describedby=${hintId}
            @change=${(event: Event) => set('section')((event.target as HTMLInputElement).value)}
        />
        <div class="column-settings-hint" id=${hintId}>${text('columnSettings.detailForm.section.hint')}</div>
        ${check('panel', 'panel', 'columnSettings.detailForm.panel')}
        ${check('collapsed', 'open', 'columnSettings.detailForm.open', true)}
        <div class="detail-form-settings-widths">
            ${numberInput(ctx, 'sectionPaddingTop', 'columnSettings.detailForm.paddingTop', section.paddingTop, set('paddingTop'), { placeholder: '0', min: 0 })}
            ${numberInput(ctx, 'sectionPaddingBottom', 'columnSettings.detailForm.paddingBottom', section.paddingBottom, set('paddingBottom'), { placeholder: '0', min: 0 })}
        </div>
        <div class="detail-form-settings-moves">
            <button
                type="button"
                class="simple-html-grid-button detail-form-settings-remove-section"
                @click=${() => {
                    removeSection(draft, section);
                    update();
                    dialog.querySelector<HTMLElement>('.detail-form-settings-list')?.focus();
                }}
            >
                ${text('columnSettings.detailForm.removeSection')}
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

/**
 * Whether a field is of several lines for the tab: as the dialog has it - its Multiline on the Columns
 * tab, not applied yet - else as the grid has it (multilineOf)
 */
function multilineIn(ctx: Grid, isMultiline?: (field: string) => boolean): (field: string) => boolean {
    return (
        isMultiline ??
        ((field) =>
            multilineOf(ctx.gridInterface.getDatasource().getField(field), ctx.gridInterface.__getGridConfig().columns[field]))
    );
}
