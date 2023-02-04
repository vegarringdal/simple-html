export interface IDateConfig {
    /**
     * is automatically 1 if datepicker= true
     */
    monthsToShow: number;
    /**
     * is automatically 1 if datepicker= true
     */
    monthColumns: number;
    monthHeader: string[];

    startMonth: number;
    startYear: number;

    weekHeader: string[];
    weekStart: number;

    showWeek: boolean;
    isoWeek: boolean;

    rowHeight: number;
    monthWidth: number;
    monthMargin: number;

    hideDimmedDates: boolean;
    showYearInMonth: boolean;

    /**
     * is automatically hidden if datepicker= true
     */
    headerTitle: string;

    datepicker: boolean;
    datepickerDate?: Date;
    datepickerHour?: number;
    datepickerMinute?: number;
    /**
     * helper if used in grid
     */
    datepickerHeight?: number;
}

export interface IStyle {
    date: Date;
    fontColor?: string;
    backgroundColor?: string;
    bold?: string;
    borderColor?: string;
    addClass?: string | string[];
}
