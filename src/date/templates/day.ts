import { html } from 'lit-html';
import type { DateInterface } from '../dateInterface';
import type { IDateConfig } from '../interfaces';
import { isSameDay } from '../utils/isSameDay';
import { isInRange, isRangePicker, nextRange } from '../utils/rangePicker';

/**
 * A day clicked in a range picker: From, then To, then From again - see nextRange. From and To are the
 * selected days
 */
function rangeClicked(event: MouseEvent, ctx: DateInterface, day: Date) {
    event.preventDefault();
    event.stopPropagation();

    const range = nextRange(ctx.config.datepickerRange, day);
    ctx.config.datepickerRange = range;
    ctx.selected = new Set(range.flatMap((end) => (end ? [end.getTime()] : [])));
}

function clicked(event: MouseEvent, ctx: DateInterface, currentDate: Date) {
    event.preventDefault();
    event.stopPropagation();

    if (ctx.config.datepicker) {
        ctx.selected.clear();
        ctx.selected;
    }

    // on the day: a date given to setSelected() can have another time than the clicked day
    const onThisDay = [...ctx.selected].filter((time) => isSameDay(time, currentDate));
    let added = false;
    if (onThisDay.length) {
        added = false;
        for (const time of onThisDay) {
            ctx.selected.delete(time);
        }
    } else {
        added = true;
        ctx.selected.add(currentDate.getTime());
    }

    if (event.shiftKey && ctx.lastSelected) {
        if (ctx.lastSelected < currentDate) {
            ctx.selected.clear();
            ctx.selected.add(ctx.lastSelected.getTime());
            while (ctx.lastSelected < currentDate) {
                ctx.lastSelected.setDate(ctx.lastSelected.getDate() + 1);
                if (!ctx.selected.has(ctx.lastSelected.getTime())) {
                    ctx.selected.add(ctx.lastSelected.getTime());
                }
            }
        }

        if (ctx.lastSelected > currentDate) {
            ctx.selected.clear();
            ctx.selected.add(ctx.lastSelected.getTime());
            while (ctx.lastSelected > currentDate) {
                ctx.lastSelected.setDate(ctx.lastSelected.getDate() - 1);
                if (!ctx.selected.has(ctx.lastSelected.getTime())) {
                    ctx.selected.add(ctx.lastSelected.getTime());
                }
            }
        }
    }

    if (added) {
        ctx.lastSelected = currentDate;
    } else {
        ctx.lastSelected = null;
    }

    if (ctx.config.datepicker) {
        ctx.config.datepickerDate = currentDate;
    }
}

/**
 * A day of the month: its number, and the classes `simple-html-date-day-dimmed` (a day of the month
 * before or after), `-selected`, `-in-range` (between From and To of a range picker), `-today` and
 * `-hidden` (a dimmed day with `hideDimmedDates`).
 * A click picks it (date picker), picks From or To (range picker) or selects it (calendar)
 */
export function day(context: DateInterface, config: IDateConfig, year: number, month: number, block: number) {
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
        // setDate(0) is the last day of the previous month, -1 the one before and so on.
        // (subtracting weekStart here was only right for a monday start, with sunday the cells
        // before the 1st were off by one and the last one showed the 1st of the previous month)
        FirstDateOfMonth.setDate(day);
        day = FirstDateOfMonth.getDate();
        dimmedCell = true;
        if (month === 0) {
            month = 11;
            year--;
        } else {
            month--;
        }
    }

    const classList = ['simple-html-date-day'];

    if (dimmedCell) {
        classList.push('simple-html-date-day-dimmed');
    }

    const hour = context.config.datepickerHour || 0;
    const min = context.config.datepickerMinute || 0;

    const currentDate = new Date(year, month, day, hour, min, 0, 0);

    // on the day, the time of a selected date does not matter
    const selected = [...context.selected].some((time) => isSameDay(time, currentDate));
    if (selected && !dimmedCell) {
        classList.push('simple-html-date-day-selected');
    }

    // a range picker: the days between From and To. In the month shown only, as the selected days
    const range = isRangePicker(config);
    const dayOnly = new Date(year, month, day);
    if (range && !dimmedCell && isInRange(context.config.datepickerRange, dayOnly)) {
        classList.push('simple-html-date-day-in-range');
    }

    // today has a mark of its own, also when it is not the day picked. In the month shown only, as
    // the selected day
    if (isSameDay(Date.now(), currentDate) && !dimmedCell) {
        classList.push('simple-html-date-day-today');
    }

    if (config.hideDimmedDates && dimmedCell) {
        day = '' as any;
        classList.push('simple-html-date-day-hidden');
    }

    return html`<!-- function:day -->
        <div
            class=${classList.join(' ')}
            @click=${(e: MouseEvent) => {
                if (range) {
                    rangeClicked(e, context, dayOnly);
                } else {
                    clicked(e, context, currentDate);
                }
                context.render();
            }}
        >
            ${day}
        </div>`;
}
