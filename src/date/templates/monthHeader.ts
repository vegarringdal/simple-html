import { html, nothing, type TemplateResult } from 'lit-html';
import { getText, type TextId } from '../../texts';
import type { DateInterface } from '../dateInterface';
import type { IDateConfig } from '../interfaces';
import { isRangePicker } from '../utils/rangePicker';
import { chevronLeft, chevronRight, chevronsLeft, chevronsRight } from './icons';

/**
 * the text ids of the names of the months, January first. The From and To of a range picker (range.ts)
 * name the month too
 */
export const MONTHS: TextId[] = [
    'datePicker.month.january',
    'datePicker.month.february',
    'datePicker.month.march',
    'datePicker.month.april',
    'datePicker.month.may',
    'datePicker.month.june',
    'datePicker.month.july',
    'datePicker.month.august',
    'datePicker.month.september',
    'datePicker.month.october',
    'datePicker.month.november',
    'datePicker.month.december'
];

/**
 * A button of the month header: « ‹ › ». Its text is its name for a screen reader and its tooltip.
 * The click does not reach the page: the grid closes its menus on a click outside them
 */
function navButton(config: IDateConfig, textId: TextId, icon: TemplateResult, go: () => void) {
    const name = getText(textId, config.texts);
    return html`<button
        type="button"
        class="simple-html-date-nav"
        aria-label=${name}
        title=${name}
        @click=${(e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            go();
        }}
    >
        ${icon}
    </button>`;
}

/**
 * Where a month of a range picker has no « ‹ or › »: an empty space as wide as the two buttons, so the
 * name of the month stays in the middle
 */
const navSpace = () => html`<span class="simple-html-date-nav-space" aria-hidden="true"></span>`;

/**
 * The month and the year. A date picker has « ‹ › » around them, to the year and the month before and
 * after. A range picker has them once for its months - « ‹ before the first, › » after the last - and
 * they move every month shown. A calendar has only the name, and the year with `showYearInMonth`:
 * `November-2026`
 * @param index the place of the month among the months shown, 0 for the first
 */
export function monthHeader(context: DateInterface, config: IDateConfig, year: number, month: number, index = 0) {
    const name = getText(MONTHS[month], config.texts);
    if (config.datepicker) {
        const range = isRangePicker(config);
        const first = !range || index === 0;
        const last = !range || index === config.monthsToShow - 1;
        const before = first
            ? html`${navButton(config, 'datePicker.previousYear', chevronsLeft(), () => context.prevYear())}
              ${navButton(config, 'datePicker.previousMonth', chevronLeft(), () => context.prevMonth())}`
            : navSpace();
        const after = last
            ? html`${navButton(config, 'datePicker.nextMonth', chevronRight(), () => context.nextMonth())}
              ${navButton(config, 'datePicker.nextYear', chevronsRight(), () => context.nextYear())}`
            : navSpace();
        return html`<!-- function:monthHeader -->
            <div class="simple-html-date-month-header">
                ${before}
                <div class="simple-html-date-month-title">
                    <span class="simple-html-date-month-name">${name}</span>
                    <span class="simple-html-date-year">${year}</span>
                </div>
                ${after}
            </div>`;
    }

    const yearAfter = config.showYearInMonth ? html`-<span class="simple-html-date-year">${year}</span>` : nothing;
    return html`<!-- function:monthHeader -->
        <div class="simple-html-date-month-header">
            <div class="simple-html-date-month-title"><span class="simple-html-date-month-name">${name}</span>${yearAfter}</div>
        </div>`;
}
