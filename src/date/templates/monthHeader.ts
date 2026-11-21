import { html, nothing, type TemplateResult } from 'lit-html';
import { getText, type TextId } from '../../texts';
import type { DateInterface } from '../dateInterface';
import type { IDateConfig } from '../interfaces';
import { chevronLeft, chevronRight, chevronsLeft, chevronsRight } from './icons';

/**
 * the text ids of the names of the months, January first
 */
const MONTHS: TextId[] = [
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
 * The month and the year. A date picker has « ‹ › » around them, to the year and the month before and
 * after; a calendar only the name, and the year with `showYearInMonth`: `November-2026`
 */
export function monthHeader(context: DateInterface, config: IDateConfig, year: number, month: number) {
    const name = getText(MONTHS[month], config.texts);
    if (config.datepicker) {
        return html`<!-- function:monthHeader -->
            <div class="simple-html-date-month-header">
                ${navButton(config, 'datePicker.previousYear', chevronsLeft(), () => context.prevYear())}
                ${navButton(config, 'datePicker.previousMonth', chevronLeft(), () => context.prevMonth())}
                <div class="simple-html-date-month-title">
                    <span class="simple-html-date-month-name">${name}</span>
                    <span class="simple-html-date-year">${year}</span>
                </div>
                ${navButton(config, 'datePicker.nextMonth', chevronRight(), () => context.nextMonth())}
                ${navButton(config, 'datePicker.nextYear', chevronsRight(), () => context.nextYear())}
            </div>`;
    }

    const yearAfter = config.showYearInMonth ? html`-<span class="simple-html-date-year">${year}</span>` : nothing;
    return html`<!-- function:monthHeader -->
        <div class="simple-html-date-month-header">
            <div class="simple-html-date-month-title"><span class="simple-html-date-month-name">${name}</span>${yearAfter}</div>
        </div>`;
}
