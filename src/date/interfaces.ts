/**
 * The config of a {@link DateInterface}: a date picker (`datepicker: true` - one month, one date with a
 * time, and Clear / Now / Use buttons) or a calendar (`datepicker: false` - one or more months, click
 * days to select them).
 *
 * The type requires every field but `datepickerDate`, `datepickerHour`, `datepickerMinute` and
 * `datepickerHeight`.
 *
 * The grid's date picker (`GridConfig.datePickerConfig`) takes the same type, but reads only `showWeek`,
 * `isoWeek`, `weekHeader`, `monthHeader`, `weekStart`, `rowHeight`, `monthWidth`, `monthMargin`,
 * `hideDimmedDates`, `showYearInMonth` and `datepickerHeight`; the others it sets itself. It still has to
 * be a whole `IDateConfig` to compile.
 *
 * @example
 * ```ts
 * import { type DateElement, DateInterface, type IDateConfig } from '@simple-html/grid';
 * import '@simple-html/grid/date.css';
 *
 * const config: IDateConfig = {
 *     datepicker: true,
 *     datepickerDate: new Date(), // the date it opens on
 *     monthsToShow: 1,
 *     monthColumns: 1,
 *     startMonth: 0, // set from datepickerDate in a date picker
 *     startYear: 2026,
 *     monthHeader: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
 *     weekHeader: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'], // sunday first, as in js
 *     weekStart: 1, // the week starts on monday
 *     showWeek: true,
 *     isoWeek: true,
 *     rowHeight: 22,
 *     monthWidth: 230,
 *     monthMargin: 10,
 *     hideDimmedDates: false,
 *     showYearInMonth: false,
 *     headerTitle: ''
 * };
 *
 * const dateInterface = new DateInterface(config);
 * const element = document.createElement('simple-html-date') as DateElement;
 * element.classList.add('simple-html-date');
 * element.connectInterface(dateInterface);
 * host.appendChild(element);
 * ```
 */
export interface IDateConfig {
    /**
     * how many months a calendar shows. A date picker shows 1, whatever this is
     */
    monthsToShow: number;
    /**
     * how many months a calendar shows side by side, before it starts a new row. A date picker sets 1
     */
    monthColumns: number;
    /** the names of the months, January first: 12 texts */
    monthHeader: string[];

    /** the first month shown, 0 (January) to 11. A date picker sets it from `datepickerDate` */
    startMonth: number;
    /** the year of the first month shown. A date picker sets it from `datepickerDate` */
    startYear: number;

    /**
     * the names of the days, in javascript's order: Sunday first (`['Su', 'Mo', ...]`). They are shown
     * from `weekStart` on
     */
    weekHeader: string[];
    /** the first day of the week: 0 Sunday, 1 Monday ... */
    weekStart: number;

    /** shows the week numbers in front of each week */
    showWeek: boolean;
    /** ISO week numbers (weeks start on monday), else weeks that start on sunday */
    isoWeek: boolean;

    /** the height of a row of days, in px */
    rowHeight: number;
    /** the width of a month, in px */
    monthWidth: number;
    /** the space on each side of a month, in px */
    monthMargin: number;

    /** hides the days of the month before and after, which are shown dimmed */
    hideDimmedDates: boolean;
    /** a calendar shows the year after the month's name: `November-2026` */
    showYearInMonth: boolean;

    /**
     * the title above the months of a calendar. Not shown by a date picker
     */
    headerTitle: string;

    /**
     * `true`: a date picker - one month, one date and its time, and Clear / Now / Use buttons that
     * send the `date-select` event. `false`: a calendar - click days to select them, shift+click a
     * range, read them with `getSelected()`
     */
    datepicker: boolean;
    /**
     * the date the date picker opens on and shows picked. null or undefined: the datepicker opens on today.
     * The picker changes this date in place (seconds and milliseconds set to 0)
     */
    datepickerDate?: Date | null;
    /** the hour of the picked time, set from `datepickerDate` by the date picker */
    datepickerHour?: number;
    /** the minutes of the picked time, set from `datepickerDate` by the date picker */
    datepickerMinute?: number;
    /**
     * grid only: the height of the date picker in px, default 317. The grid opens the picker above the
     * cell when there is no room for this below it
     */
    datepickerHeight?: number;
}

/**
 * The style of one date in a calendar, for {@link DateInterface.styleRange} - which is not implemented
 * yet: it only logs a warning.
 */
export interface IStyle {
    /** the date to style */
    date: Date;
    /** the text color, a css color */
    fontColor?: string;
    /** the background color, a css color */
    backgroundColor?: string;
    /** a css font weight */
    bold?: string;
    /** the border color, a css color */
    borderColor?: string;
    /** css classes to add */
    addClass?: string | string[];
}
