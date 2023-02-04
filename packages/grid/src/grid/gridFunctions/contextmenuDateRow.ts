import { html, render } from 'lit-html';
import { Entity } from '../../datasource/entity';
import { asPx } from './asPx';
import { creatElement } from './createElement';
import { Grid } from '../grid';
import { HTMLCellElement } from './HTMLCellElement';
import { ColType } from './colType';
import { removeContextMenu } from './removeContextMenu';
import { IDateConfig } from '../../date/interfaces';
import { DateInterface } from '../../date/dateInterface';

export function contextmenuDateRow(
    ctx: Grid,
    event: MouseEvent,
    cell: HTMLCellElement,
    _row: number,
    _column: number,
    _celno: number,
    _colType: ColType,
    _cellType: string,
    attribute: string,
    rowData: Entity
) {
    removeContextMenu(ctx);

    const contextMenu = creatElement('div', 'simple-html-grid');

    const rect = cell.getBoundingClientRect();
    contextMenu.style.position = 'absolute';
    contextMenu.style.top = asPx(rect.bottom + 2);
    contextMenu.style.left = asPx(rect.left + 2);
    contextMenu.style.minWidth = asPx(130);

    if (rect.left + 250 > window.innerWidth) {
        contextMenu.style.left = asPx(window.innerWidth - 255);
    }
    if (event.clientX - 65 < 0) {
        contextMenu.style.left = asPx(5);
    }

    const dateconfig: IDateConfig = {
        monthsToShow: 1,
        monthColumns: 1,
        startMonth: 0,
        startYear: 2023,
        showWeek: true,
        isoWeek: true,
        weekHeader: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
        monthHeader: [
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
        weekStart: 1,
        rowHeight: '22px',
        monthWidth: '230px',
        monthMargin: '10px',
        hideDimmedDates: false,
        showYearInMonth: false,
        headerTitle: '2023',
        datepicker: true,
        datepickerDate: rowData[attribute]
    };

    const dateInterface = new DateInterface(dateconfig);

    dateInterface.addEventListener({
        handleEvent: (e) => {
            rowData[attribute] = e.data;
            ctx.gridInterface.triggerScrollEvent();
        }
    });

    render(html`<simple-html-date .dateInterface=${dateInterface} class="simple-html-date"> </simple-html-date>`, contextMenu);

    document.body.appendChild(contextMenu);
    ctx.contextMenu = contextMenu;
}
