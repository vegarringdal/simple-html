import './index.css';
import '../../packages/grid/src/date.css';
import { DateElement, DateInterface, IDateConfig } from "@simple-html/grid";

const dateconfig: IDateConfig = {
    monthsToShow: 12,
    monthColumns: 3,
    startMonth: 0, //0-11
    startYear: 2020,
    showWeek: false, // not working
    isoWeek: true, // not working
    weekHeader: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'], // must be in js order, widget reorder them if you have other start day
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
    rowHeight: '20px',
    monthWidth: '220px',
    monthMargin: '10px',
    hideDimmedDates: false
};


/**
 * create interface
 */
const gridInterface = new DateInterface(dateconfig);

const element = document.createElement('simple-html-date') as DateElement;
element.connectInterface(gridInterface);
document.body.appendChild(element)