import { html } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import { getText } from '../../texts';
import type { DateInterface } from '../dateInterface';
import type { IDateConfig } from '../interfaces';

/**
 * hour/minute row of the datepicker
 * the `!` below: in datepicker mode checkDatePicker() sets datepickerDate, datepickerHour and
 * datepickerMinute when the element connects, before the first render
 */
export function time(context: DateInterface, config: IDateConfig, _year: number, _month: number) {
    const width = config.monthWidth;

    return html` <div class="simple-html-date-time" style="width:${width}">
        <!-- hour -->
        <div class="date-flex">
            <div class="side">
                <label>${getText('datePicker.hours', config.texts)}</label>
                <div class="date-flex">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="currentColor"
                        class="icon"
                        @click=${(e: any) => {
                            e.preventDefault();
                            e.stopPropagation();
                            config.datepickerHour = config.datepickerHour! - 1;
                            if (config.datepickerHour > 23) {
                                config.datepickerHour = 0;
                            }
                            if (config.datepickerHour < 0) {
                                config.datepickerHour = 23;
                            }
                            context.config.datepickerDate!.setHours(config.datepickerHour);
                            context.config = structuredClone(context.config);
                            context.checkDatePicker();
                            context.render();
                        }}
                    >
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                    <input
                        .valueAsNumber=${live(config.datepickerHour || 0)}
                        type="number"
                        min="0"
                        max="23"
                        @click=${(e: any) => {
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                        @change=${(e: Event) => {
                            e.preventDefault();
                            e.stopPropagation();
                            // a cleared input is NaN, keep the current value - the re-render below puts it back
                            const value = (e.target as HTMLInputElement).valueAsNumber;
                            config.datepickerHour = Number.isNaN(value) ? config.datepickerHour! : value;
                            if (config.datepickerHour > 23) {
                                config.datepickerHour = 0;
                            }
                            if (config.datepickerHour < 0) {
                                config.datepickerHour = 23;
                            }
                            context.config.datepickerDate!.setHours(config.datepickerHour);
                            context.config = structuredClone(context.config);
                            context.checkDatePicker();
                            context.render();
                        }}
                    />
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="currentColor"
                        class="icon"
                        @click=${(e: any) => {
                            e.preventDefault();
                            e.stopPropagation();
                            config.datepickerHour = config.datepickerHour! + 1;
                            if (config.datepickerHour > 23) {
                                config.datepickerHour = 0;
                            }
                            if (config.datepickerHour < 0) {
                                config.datepickerHour = 23;
                            }
                            context.config.datepickerDate!.setHours(config.datepickerHour);
                            context.config = structuredClone(context.config);
                            context.checkDatePicker();
                            context.render();
                        }}
                    >
                        <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                    </svg>
                </div>
            </div>

            <!-- minute -->
            <div class="side">
                <label>${getText('datePicker.minutes', config.texts)}</label>
                <div class="date-flex">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="currentColor"
                        class="icon"
                        @click=${(e: any) => {
                            e.preventDefault();
                            e.stopPropagation();
                            config.datepickerMinute = config.datepickerMinute! - 1;
                            // minutes wrap at 59, not 23 like the hours (40 -> 39 jumped to 0)
                            if (config.datepickerMinute > 59) {
                                config.datepickerMinute = 0;
                            }
                            if (config.datepickerMinute < 0) {
                                config.datepickerMinute = 59;
                            }
                            context.config.datepickerDate!.setMinutes(config.datepickerMinute);
                            context.config = structuredClone(context.config);
                            context.checkDatePicker();
                            context.render();
                        }}
                    >
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                    <input
                        .valueAsNumber=${live(config.datepickerMinute || 0)}
                        type="number"
                        min="0"
                        max="59"
                        @click=${(e: any) => {
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                        @change=${(e: Event) => {
                            e.preventDefault();
                            e.stopPropagation();
                            // a cleared input is NaN, keep the current value - the re-render below puts it back
                            const value = (e.target as HTMLInputElement).valueAsNumber;
                            config.datepickerMinute = Number.isNaN(value) ? config.datepickerMinute! : value;
                            if (config.datepickerMinute > 59) {
                                config.datepickerMinute = 0;
                            }
                            if (config.datepickerMinute < 0) {
                                config.datepickerMinute = 59;
                            }
                            context.config.datepickerDate!.setMinutes(config.datepickerMinute);
                            context.config = structuredClone(context.config);
                            context.checkDatePicker();
                            context.render();
                        }}
                    />

                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="currentColor"
                        class="icon"
                        @click=${(e: any) => {
                            e.preventDefault();
                            e.stopPropagation();
                            config.datepickerMinute = config.datepickerMinute! + 1;
                            if (config.datepickerMinute > 59) {
                                config.datepickerMinute = 0;
                            }
                            if (config.datepickerMinute < 0) {
                                config.datepickerMinute = 59;
                            }
                            context.config.datepickerDate!.setMinutes(config.datepickerMinute);
                            context.config = structuredClone(context.config);
                            context.checkDatePicker();
                            context.render();
                        }}
                    >
                        <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                    </svg>
                </div>
            </div>
        </div>
        <div class="date-flex-col">
            <div class="side"></div>
            <button
                @click=${() => {
                    context.__callSubscribers('date-select', null);
                }}
            >
                ${getText('datePicker.clear', config.texts)}
            </button>
            <button
                @click=${(e: any) => {
                    e.preventDefault();
                    e.stopPropagation();
                    context.gotoNow();
                }}
            >
                ${getText('datePicker.now', config.texts)}
            </button>
            <button
                @click=${() => {
                    context.__callSubscribers('date-select', config.datepickerDate!);
                }}
            >
                ${getText('datePicker.use', config.texts)}
            </button>
        </div>
    </div>`;
}
