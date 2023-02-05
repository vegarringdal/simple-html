import { asPx } from './asPx';
import { creatElement } from './createElement';
import { Grid } from '../grid';
import { HTMLCellElement } from './HTMLCellElement';
import { removeContextMenu } from './removeContextMenu';
import { IDateConfig } from '../../date/interfaces';
import { DateInterface } from '../../date/dateInterface';
import { DateElement } from '../../date/dateElement';

export function contextmenuDate(
    ctx: Grid,
    _event: MouseEvent,
    cell: HTMLCellElement,
    value: Date | null,
    callback: (value: Date | null) => void
) {
    removeContextMenu(ctx);

    const contextMenu = creatElement('div', 'simple-html-grid');

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
        weekStart: config.weekStart || 1,
        rowHeight: config.weekStart || 22,
        monthWidth: config.weekStart || 230,
        monthMargin: config.weekStart || 10,
        hideDimmedDates: config.hideDimmedDates !== undefined ? config.hideDimmedDates : false,
        showYearInMonth: config.showYearInMonth !== undefined ? config.showYearInMonth : false,
        headerTitle: '', // not shown datepicker is true
        datepicker: true,
        datepickerDate: value
    };

    const rect = cell.getBoundingClientRect();
    contextMenu.style.position = 'absolute';
    contextMenu.style.zIndex = '2000'
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

    const dateElement = creatElement('simple-html-date', 'simple-html-date') as DateElement;
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
