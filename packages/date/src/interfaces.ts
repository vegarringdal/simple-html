export interface IDateConfig {
    monthsToShow: number;
    monthColumns: number;
    monthHeader: string[]; //'January' etc

    startMonth: number; // 1-12
    startYear: number;

    weekHeader: string[]; // 'Mon', 'Tue' etc
    weekStart: number;

    showWeek: boolean;
    isoWeek: boolean;

    rowHeight: string;
    monthWidth: string;
    monthMargin: string;

    hideDimmedDates: boolean;
}

export interface IStyle {
    date: Date;
    fontColor?: string;
    backgroundColor?: string;
    bold?: string;
    borderColor?: string;
    addClass?: string | string[];
}
