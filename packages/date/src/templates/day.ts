import { IDateConfig } from '../interfaces';
import { html } from 'lit-html';
import { SimpleHtmlDate } from '../simple-html-date';

// lets keep it simple while we test
const selected = new Set();
let lastSelected: Date = null;

function clicked(event: MouseEvent, currentDate: Date) {
    let added = false;
    if (selected.has(currentDate.getTime())) {
        added = false;
        selected.delete(currentDate.getTime());
    } else {
        added = true;
        selected.add(currentDate.getTime());
    }

    if (event.shiftKey && lastSelected) {
        if (lastSelected < currentDate) {
            selected.clear();
            selected.add(lastSelected.getTime());
            while (lastSelected < currentDate) {
                lastSelected.setDate(lastSelected.getDate() + 1);
                if (!selected.has(lastSelected.getTime())) {
                    selected.add(lastSelected.getTime());
                }
            }
        }

        if (lastSelected > currentDate) {
            selected.clear();
            selected.add(lastSelected.getTime());
            while (lastSelected > currentDate) {
                lastSelected.setDate(lastSelected.getDate() - 1);
                if (!selected.has(lastSelected.getTime())) {
                    selected.add(lastSelected.getTime());
                }
            }
        }
    }

    if (added) {
        lastSelected = currentDate;
    } else {
        lastSelected = null;
    }
}

export function day(
    context: SimpleHtmlDate,
    config: IDateConfig,
    year: number,
    month: number,
    block: number
) {
    const FirstDateOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month === 11 ? 0 : month + 1, 0);
    let dayOfWeek = FirstDateOfMonth.getDay() - config.weekStart;
    if (dayOfWeek < 0) {
        // if less than 0, we need to push it out 1 week. so we always show entire month
        dayOfWeek = dayOfWeek + 7;
    }

    let day = block - dayOfWeek;

    let dimmedCell = false;
    // if more then last day of month
    if (day > lastDayOfMonth.getDate()) {
        day = day - lastDayOfMonth.getDate();
        dimmedCell = true;
        if (month === 11) {
            month = 0;
            year++;
        } else {
            month++;
        }
    }

    // if less that first we need to count downwards
    if (day < 1) {
        FirstDateOfMonth.setDate(FirstDateOfMonth.getDate() - Math.abs(day) - config.weekStart);
        day = FirstDateOfMonth.getDate();
        dimmedCell = true;
        if (month === 0) {
            month = 11;
            year--;
        } else {
            month--;
        }
    }

    const classList = [];

    if (dimmedCell) {
        classList.push('simple-html-date-day-dimmed');
    }

    const currentDate = new Date(year, month, day);
    this.dimmed = dimmedCell;
    if (selected.has(currentDate.getTime()) && !dimmedCell) {
        classList.push('simple-html-date-day-selected');
    }

    if (config.hideDimmedDates && dimmedCell) {
        day = '' as any;
        classList.push('simple-html-date-day-hidden');
    }

    return html`<!-- function:day -->
        <simple-html-date-day
            class=${classList.join(' ')}
            @click=${(e: MouseEvent) => {
                clicked(e, currentDate);
                context.render();
            }}
        >
            ${day}
        </simple-html-date-day>`;
}
