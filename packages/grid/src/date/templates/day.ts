import { IDateConfig } from '../interfaces';
import { html } from 'lit-html';
import { DateInterface } from '../dateInterface';

function clicked(event: MouseEvent, ctx: DateInterface, currentDate: Date) {

    if(ctx.config.datepicker){
        ctx.selected.clear();
        ctx.selected
    }


    let added = false;
    if (ctx.selected.has(currentDate.getTime())) {
        added = false;
        ctx.selected.delete(currentDate.getTime());
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

    if(ctx.config.datepicker){
        ctx.config.datepickerDate = currentDate
    }
}

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

    const classList = ['simple-html-date-day'];

    if (dimmedCell) {
        classList.push('simple-html-date-day-dimmed');
    }

    const hour = context.config.datepickerHour || 0
    const min = context.config.datepickerMinute || 0

    const currentDate = new Date(year, month, day, hour, min, 0, 0);

    if (context.selected.has(currentDate.getTime()) && !dimmedCell) {
        classList.push('simple-html-date-day-selected');
    }

    if (config.hideDimmedDates && dimmedCell) {
        day = '' as any;
        classList.push('simple-html-date-day-hidden');
    }

    return html`<!-- function:day -->
        <div
            class=${classList.join(' ')}
            @click=${(e: MouseEvent) => {
                clicked(e, context, currentDate);
                context.render();
            }}
        >
            ${day}
        </div>`;
}
