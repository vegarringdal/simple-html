import { html } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import { getText } from '../../texts';
import type { DateInterface } from '../dateInterface';
import type { IDateConfig } from '../interfaces';
import { chevronDown, chevronUp } from './icons';

/**
 * Sets the hour of the picked date and renders the picker again. Past 23 is 0, below 0 is 23.
 * The `!`: in datepicker mode checkDatePicker() sets datepickerDate when the element connects
 */
function setHour(context: DateInterface, config: IDateConfig, hour: number) {
    config.datepickerHour = hour > 23 ? 0 : hour < 0 ? 23 : hour;
    context.config.datepickerDate!.setHours(config.datepickerHour);
    context.config = structuredClone(context.config);
    context.checkDatePicker();
    context.render();
}

/**
 * Sets the minutes of the picked date and renders the picker again. Past 59 is 0, below 0 is 59
 */
function setMinute(context: DateInterface, config: IDateConfig, minute: number) {
    config.datepickerMinute = minute > 59 ? 0 : minute < 0 ? 59 : minute;
    context.config.datepickerDate!.setMinutes(config.datepickerMinute);
    context.config = structuredClone(context.config);
    context.checkDatePicker();
    context.render();
}

/**
 * The hours or the minutes: the label, then the number between a step down and a step up.
 * The steps are for the mouse - the keyboard has the arrow keys of the number input - so they are
 * not buttons in the tab order. A click does not reach the page: the grid closes its menus on a
 * click outside them, and a click that renders the picker again can look outside
 *
 * @param label the text before it, also the name of the input for a screen reader
 * @param value the hour or minute shown
 * @param max 23 or 59
 * @param set called with the new value, before the wrap around
 */
function timeField(label: string, value: number, max: number, set: (value: number) => void) {
    const step = (e: MouseEvent, change: number) => {
        e.preventDefault();
        e.stopPropagation();
        set(value + change);
    };

    return html`<div class="simple-html-date-time-field">
        <span class="simple-html-date-time-label">${label}</span>
        <div class="simple-html-date-stepper">
            <span class="simple-html-date-step" aria-hidden="true" @click=${(e: MouseEvent) => step(e, -1)}>${chevronDown()}</span>
            <input
                aria-label=${label}
                .valueAsNumber=${live(value)}
                type="number"
                min="0"
                max=${max}
                @click=${(e: MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                }}
                @change=${(e: Event) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // a cleared input is NaN, keep the current value - the render after puts it back
                    const typed = (e.target as HTMLInputElement).valueAsNumber;
                    set(Number.isNaN(typed) ? value : typed);
                }}
            />
            <span class="simple-html-date-step" aria-hidden="true" @click=${(e: MouseEvent) => step(e, 1)}>${chevronUp()}</span>
        </div>
    </div>`;
}

/**
 * The bottom of the date picker: the hour and the minutes of the picked date, and the Clear / Now / Use
 * buttons. A calendar (datepicker false) has none
 */
export function time(context: DateInterface, config: IDateConfig, _year: number, _month: number) {
    const hour = config.datepickerHour ?? 0;
    const minute = config.datepickerMinute ?? 0;

    return html`<div class="simple-html-date-time">
        <div class="simple-html-date-time-row">
            ${timeField(getText('datePicker.hours', config.texts), hour, 23, (value) => setHour(context, config, value))}
            ${timeField(getText('datePicker.minutes', config.texts), minute, 59, (value) => setMinute(context, config, value))}
        </div>
        <div class="simple-html-date-actions">
            <button
                type="button"
                class="simple-html-date-button"
                @click=${() => {
                    context.__callSubscribers('date-select', null);
                }}
            >
                ${getText('datePicker.clear', config.texts)}
            </button>
            <button
                type="button"
                class="simple-html-date-button"
                @click=${(e: MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    context.gotoNow();
                }}
            >
                ${getText('datePicker.now', config.texts)}
            </button>
            <button
                type="button"
                class="simple-html-date-button simple-html-date-button-primary"
                @click=${() => {
                    context.__callSubscribers('date-select', config.datepickerDate!);
                }}
            >
                ${getText('datePicker.use', config.texts)}
            </button>
        </div>
    </div>`;
}
