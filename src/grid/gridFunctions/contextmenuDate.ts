import type { DateElement } from '../../date/dateElement';
import { DateInterface } from '../../date/dateInterface';
import type { IDateConfig } from '../../date/interfaces';
import type { Grid } from '../grid';
import { asPx } from './asPx';
import { createElement } from './createElement';
import type { HTMLCellElement } from './HTMLCellElement';
import { removeContextMenu } from './removeContextMenu';

export function contextmenuDate(
    ctx: Grid,
    _event: MouseEvent,
    cell: HTMLCellElement,
    value: Date | null,
    callback: (value: Date | null) => void
) {
    removeContextMenu(ctx);

    const contextMenu = createElement('div', 'simple-html-grid');

    const config = ctx.gridInterface.__getGridConfig().datePickerConfig || ({} as IDateConfig);

    // todo - I should add these ass part of gridconfig
    const dateconfig: IDateConfig = {
        monthsToShow: 1, // set automatically when datepicker is true
        monthColumns: 1, // set automatically when datepicker is true
        startMonth: 0, // set automatically when datepicker is true
        startYear: 2023, // set automatically when datepicker is true
        showWeek: config.showWeek !== undefined ? config.showWeek : true,
        isoWeek: config.isoWeek !== undefined ? config.isoWeek : true,
        weekHeader: config.weekHeader || ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
        monthHeader: config.monthHeader || [
            'January',
            'February',
            'March',
            'April',
            'May',
            'June',
            'July',
            'August',
            'September',
            'October',
            'November',
            'December'
        ],
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

    const rect = cell.getBoundingClientRect();
    contextMenu.style.position = 'absolute';
    contextMenu.style.zIndex = '2000';
    contextMenu.style.top = asPx(rect.bottom + 2);
    contextMenu.style.left = asPx(rect.left + 2);
    contextMenu.style.minWidth = asPx(130);

    const dateInterface = new DateInterface(dateconfig);

    dateInterface.addEventListener({
        handleEvent: (e) => {
            // maybe this should call back ?
            callback(e.data);
        }
    });

    const dateElement = createElement('simple-html-date', 'simple-html-date') as DateElement;
    contextMenu.appendChild(dateElement);
    dateElement.connectInterface(dateInterface);
    dateInterface.render();

    const width = dateconfig.monthWidth + dateconfig.monthMargin + dateconfig.monthMargin + 10;
    if (rect.left + width > window.innerWidth) {
        contextMenu.style.left = asPx(window.innerWidth - width);
    }

    const height = config.datepickerHeight || 317;
    // unable to know height before its added, I should add the as option
    if (rect.bottom + height > window.innerHeight) {
        contextMenu.style.top = asPx(rect.top - height);
    }

    document.body.appendChild(contextMenu);
    ctx.contextMenu = contextMenu;
}
