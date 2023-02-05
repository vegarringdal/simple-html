import './index.css';
import '../../packages/grid/src/date.css';
import { DateElement, DateInterface, IDateConfig } from '@simple-html/grid';
import { toggelDarkDate } from './toggelDarkDate';

const dateconfig: IDateConfig = {
    monthsToShow: 1,
    monthColumns: 1,
    startMonth: 0, //0-11
    startYear: 2023,
    showWeek: true, // not working
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
    rowHeight: 22,
    monthWidth: 230,
    monthMargin: 10,
    hideDimmedDates: false,
    showYearInMonth: false,
    headerTitle: '2023',
    datepicker: true,
    datepickerDate: new Date()
};

/**
 * create interface
 */
const gridInterface = new DateInterface(dateconfig);

const element = document.createElement('simple-html-date') as DateElement;
element.classList.add('simple-html-date');
element.connectInterface(gridInterface);
document.body.appendChild(element);

function createButton(title: string, callback: () => void) {
    const btn = document.createElement('button');
    btn.onclick = callback;
    btn.innerText = title;
    btn.style.padding = '3px';
    btn.style.margin = '3px';

    document.body.appendChild(btn);
}

createButton('toggle dark/light mode', () => {
    toggelDarkDate();
});
