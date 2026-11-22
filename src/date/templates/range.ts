import { html } from 'lit-html';
import { getText, type TextId } from '../../texts';
import type { DateInterface } from '../dateInterface';
import type { IDateConfig } from '../interfaces';
import { rangeDays } from '../utils/rangePicker';
import { MONTHS } from './monthHeader';

/**
 * A day as the From and To line shows it: the day, the name of the month (a text) and the year -
 * `22 November 2026`
 */
function dayText(config: IDateConfig, day: Date) {
    return `${day.getDate()} ${getText(MONTHS[day.getMonth()], config.texts)} ${day.getFullYear()}`;
}

/**
 * From or To: its label over the day picked, `datePicker.rangeOpen` (–) while it is not picked
 */
function rangeEnd(config: IDateConfig, label: TextId, day: Date | null) {
    return html`<div class="simple-html-date-range-end">
        <span class="simple-html-date-range-label">${getText(label, config.texts)}</span>
        <span class="simple-html-date-range-day">${day ? dayText(config, day) : getText('datePicker.rangeOpen', config.texts)}</span>
    </div>`;
}

/**
 * The bottom of a range picker, under its months and as wide: From and To picked, side by side - read
 * out when they change - and the Clear / Use buttons. Use sends `range-select` with copies of From and
 * To (a handler can change them), Clear with null. A click on them does reach the page, as the date
 * picker's Clear / Use: the grid closes its date picker on it
 */
export function rangeFooter(context: DateInterface, config: IDateConfig) {
    const [from, to] = rangeDays(config.datepickerRange);
    const margin = config.monthMargin;

    return html`<div class="simple-html-date-range" style="margin:0 ${margin}px ${margin}px;">
        <div class="simple-html-date-range-ends" aria-live="polite">
            ${rangeEnd(config, 'datePicker.from', from)} ${rangeEnd(config, 'datePicker.to', to)}
        </div>
        <div class="simple-html-date-actions">
            <button
                type="button"
                class="simple-html-date-button"
                @click=${() => {
                    context.__callSubscribers('range-select', null);
                }}
            >
                ${getText('datePicker.clear', config.texts)}
            </button>
            <button
                type="button"
                class="simple-html-date-button simple-html-date-button-primary"
                @click=${() => {
                    context.__callSubscribers('range-select', rangeDays(context.config.datepickerRange));
                }}
            >
                ${getText('datePicker.use', config.texts)}
            </button>
        </div>
    </div>`;
}
