import { html, nothing, render } from 'lit-html';
import type { DatePreset } from '../datePresets';
import type { Grid } from '../grid';
import type { MenuBlock } from '../gridMenus';
import { activeDatePreset, datePresetName, datePresetRangeOf, filterOnDatePreset, offeredDatePresets } from './datePresetFilter';
import { gridText } from './gridText';
import { removeContextMenu } from './removeContextMenu';
import { attachTooltips, tooltipsEnabled } from './tooltip';

/**
 * The buttons are in two columns (grid.css): ArrowDown / ArrowUp move a row of two
 */
const COLUMNS = 2;

/**
 * The quick dates of the filter menu of a date or datetime column (`filter.dates`), under the range
 * block: a button for each quick date the column offers (offeredDatePresets: its `datePresets`, else
 * every one but Overdue) in two columns - Today, Yesterday / This week, Last week / ... One click filters
 * the column on it and closes the menu: no Apply, it is no draft.
 *
 * Filtering on one is filterOnDatePreset: its days from today, a `BETWEEN` that replaces the column's
 * conditions, and the header filter keeps the quick date - the cell shows its name, the indicator
 * Between. It stays relative: a state with it filters on the days of the day it is set
 * (`HeaderFilter.datePreset`).
 *
 * The one in use is filled with the accent colour, as the operator picked in the range block, and is
 * `aria-current` for a screen reader; a click on it filters on it again, from today. The tooltip of a
 * button has its days, as the field shows a date: `2026-11-01 – 2026-11-30`, a datetime's with the
 * times; Overdue `Before` today.
 *
 * The keyboard: one stop of Tab after the range block (a roving tabindex: the button in use, else the
 * first). ArrowLeft / ArrowRight the button before / after, ArrowUp / ArrowDown the one above / below,
 * Home / End the first / last; Enter and Space click it - the browser's, they are buttons.
 *
 * Not shown for a column that offers none: `datePresets: false`, a type that is no date, a lookup
 * column (it filters as text), a column without `BETWEEN`.
 */
export function datePresetBlock(ctx: Grid, attribute: string): MenuBlock {
    const element = document.createElement('div');
    element.setAttribute('data-menu-id', 'filter.dates');
    element.className = 'simple-html-grid-date-presets';

    const presets = offeredDatePresets(ctx, attribute);
    const block: MenuBlock = { type: 'block', id: 'filter.dates', element, visible: () => presets.length > 0 };
    if (!presets.length) {
        return block;
    }

    const active = activeDatePreset(ctx, attribute);
    // the stop of Tab: the one in use when it is offered, else the first
    const tabStop = active && presets.includes(active) ? active : presets[0];
    // the days are shown as the field shows a date, not in a display format: a week format would show
    // weeks for the days of a month
    const formatter = ctx.gridInterface.getDatasource().getField(attribute).formatter;

    /**
     * The tooltip of a quick date: its first and last day (a datetime's first and last second), the day
     * alone when they are one; Overdue's open start is "Before" today
     */
    const days = (preset: DatePreset) => {
        const [from, to] = datePresetRangeOf(ctx, attribute, preset);
        if (!from) {
            const today = new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1);
            return gridText(ctx, 'filter.dates.before', { date: formatter.format(today) });
        }
        const first = formatter.format(from);
        const last = formatter.format(to);
        return first === last ? first : gridText(ctx, 'filter.dates.range', { from: first, to: last });
    };

    const pick = (preset: DatePreset) => {
        filterOnDatePreset(ctx, attribute, preset);
        removeContextMenu(ctx);
    };

    // the arrows, Home and End move between the buttons (and make the one moved to the stop of Tab)
    element.addEventListener('keydown', (event) => {
        const buttons = Array.from(element.querySelectorAll<HTMLButtonElement>('button'));
        const index = buttons.indexOf(event.target as HTMLButtonElement);
        const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -COLUMNS, ArrowDown: COLUMNS };
        if (index === -1) {
            return;
        }
        let next: HTMLButtonElement | undefined;
        if (event.key in steps) {
            next = buttons[index + steps[event.key]];
        } else if (event.key === 'Home') {
            next = buttons[0];
        } else if (event.key === 'End') {
            next = buttons[buttons.length - 1];
        } else {
            return;
        }
        // at an edge the focus stays: the arrows do not scroll the menu either
        event.preventDefault();
        if (next) {
            for (const button of buttons) {
                button.tabIndex = button === next ? 0 : -1;
            }
            next.focus();
        }
    });
    // the days of each, when the pointer rests on it
    attachTooltips(element, () => tooltipsEnabled(ctx));

    render(
        html`${presets.map(
            (preset) =>
                html`<button
                    type="button"
                    class="simple-html-grid-date-preset"
                    data-preset=${preset}
                    tabindex=${preset === tabStop ? '0' : '-1'}
                    aria-current=${preset === active ? 'true' : nothing}
                    data-tooltip=${days(preset)}
                    @click=${() => pick(preset)}
                >
                    ${datePresetName(ctx, preset)}
                </button>`
        )}`,
        element
    );
    element.setAttribute('role', 'group');
    element.setAttribute('aria-label', gridText(ctx, 'filter.dates'));
    return block;
}
