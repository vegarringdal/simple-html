import { type DateElement, DateInterface, type IDateConfig } from '@simple-html/grid';
import { createStage, type DemoSample } from '../demoUtils';

export const datepicker: DemoSample = {
    id: 'datepicker',
    title: 'Date picker',
    group: 'Date picker',
    description:
        'The package also ships a standalone calendar/date picker element (<simple-html-date>). The grid uses it internally for date cells, but you can use it on its own. It is themed with css variables like the grid.',
    code: `
import { DateInterface, type DateElement, type IDateConfig } from '@simple-html/grid';
import '@simple-html/grid/dist/date.css';

const dateConfig: IDateConfig = {
    monthsToShow: 2,
    monthColumns: 2,
    startMonth: 7, // 0-11
    startYear: 2026,
    showWeek: true,
    isoWeek: true,
    weekStart: 1,
    rowHeight: 22,
    monthWidth: 230,
    monthMargin: 10,
    hideDimmedDates: false,
    showYearInMonth: false,
    headerTitle: '2026',
    weekHeader: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'], // js order, widget reorders
    monthHeader: ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'],
    datepicker: true,
    datepickerDate: new Date()
};

const dateInterface = new DateInterface(dateConfig);

const element = document.createElement('simple-html-date') as DateElement;
element.classList.add('simple-html-date');
element.connectInterface(dateInterface);
document.body.appendChild(element);
`,
    run(stage) {
        const ui = createStage(stage);
        ui.gridHost.classList.add('centered');

        const dateConfig: IDateConfig = {
            monthsToShow: 2,
            monthColumns: 2,
            startMonth: 7,
            startYear: 2026,
            showWeek: true,
            isoWeek: true,
            weekStart: 1,
            rowHeight: 22,
            monthWidth: 230,
            monthMargin: 10,
            hideDimmedDates: false,
            showYearInMonth: false,
            headerTitle: '2026',
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
            datepicker: true,
            datepickerDate: new Date()
        };

        const dateInterface = new DateInterface(dateConfig);

        const element = document.createElement('simple-html-date') as DateElement;
        element.classList.add('simple-html-date');
        element.connectInterface(dateInterface);
        ui.gridHost.appendChild(element);
    }
};
