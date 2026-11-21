import type { DateElement } from '../../date/dateElement';
import { DateInterface } from '../../date/dateInterface';
import type { IDateConfig } from '../../date/interfaces';
import type { Grid } from '../grid';
import { createElement } from './createElement';
import type { HTMLCellElement } from './HTMLCellElement';
import { moveMenu, openMenuElement } from './showMenu';

/**
 * opens the date picker under a cell, as the grid's menu (one at a time, closed as the others)
 * @param value the date to open on, anything that is not a valid Date opens on today
 */
export function contextmenuDate(
    ctx: Grid,
    _event: MouseEvent,
    cell: HTMLCellElement,
    value: unknown,
    callback: (value: Date | null) => void
) {
    const contextMenu = createElement('div', 'simple-html-grid');

    // only the fields given, every field read below has a default
    const config = ctx.gridInterface.__getGridConfig().datePickerConfig ?? {};

    const dateconfig: IDateConfig = {
        monthsToShow: 1, // set automatically when datepicker is true
        monthColumns: 1, // set automatically when datepicker is true
        startMonth: 0, // set automatically when datepicker is true
        startYear: 2023, // set automatically when datepicker is true
        showWeek: config.showWeek !== undefined ? config.showWeek : true,
        isoWeek: config.isoWeek !== undefined ? config.isoWeek : true,
        // the grid's texts: the names of the months and days, the buttons
        texts: ctx.gridInterface.__getGridConfig().texts,
        // ?? and not ||, 0 (sunday) is a valid week start
        weekStart: config.weekStart ?? 1,
        rowHeight: config.rowHeight || 22,
        monthWidth: config.monthWidth || 230,
        monthMargin: config.monthMargin ?? 10,
        hideDimmedDates: config.hideDimmedDates !== undefined ? config.hideDimmedDates : false,
        showYearInMonth: config.showYearInMonth !== undefined ? config.showYearInMonth : false,
        headerTitle: '', // not shown datepicker is true
        datepicker: true,
        // a copy: the picker edits the date it is given in place (seconds, hours, minutes), and
        // that can be the date object of the cell. Anything that is not a valid date opens on today
        datepickerDate: value instanceof Date && !Number.isNaN(value.getTime()) ? new Date(value.getTime()) : null
    };

    const dateInterface = new DateInterface(dateconfig);

    // no need to unsubscribe: removing the menu removes the date element, and that unsubscribes
    dateInterface.on('date-select', (date) => {
        callback(date);
    });

    const dateElement = createElement('simple-html-date', 'simple-html-date') as DateElement;
    contextMenu.appendChild(dateElement);
    dateElement.connectInterface(dateInterface);
    dateInterface.render();

    // in the filter editor's dialog when opened from it: a menu outside a modal dialog can not be
    // clicked, see popoverParent
    openMenuElement(ctx, contextMenu, cell);

    // under the cell; above it when the picker (datepickerHeight) does not fit below, moved left when
    // it sticks out on the right
    const rect = cell.getBoundingClientRect();
    let left = rect.left + 2;
    let top = rect.bottom + 2;
    const width = dateconfig.monthWidth + dateconfig.monthMargin + dateconfig.monthMargin + 10;
    if (rect.left + width > window.innerWidth) {
        left = window.innerWidth - width;
    }
    // the default is the height of the picker with the default config (277) and a gap of 5
    const height = config.datepickerHeight || 282;
    if (rect.bottom + height > window.innerHeight) {
        top = rect.top - height;
    }
    moveMenu(contextMenu, left, top);
}
