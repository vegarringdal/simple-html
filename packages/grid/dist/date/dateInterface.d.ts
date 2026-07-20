import type { DateElement } from './dateElement';
import type { IDateConfig, IStyle } from './interfaces';
export type callF = (...args: any[]) => any;
export type callO = {
    handleEvent: (...args: any[]) => any;
};
export type callable = callF | callO;
export declare class DateInterface {
    selected: Set<unknown>;
    lastSelected: Date;
    element: DateElement;
    config: IDateConfig;
    private listeners;
    constructor(config: IDateConfig);
    connectGridInterface(element: DateElement): void;
    connectElement(element: DateElement): void;
    checkDatePicker(): void;
    disconnectElement(): void;
    callSubscribers(event: string, data?: {}): void;
    selectRangeWithFromTo(fromDate: Date, toDate: Date): void;
    styleRange(StyleArray: IStyle[]): void;
    getSelected(): unknown[];
    clearSelection(): void;
    gotoNow(): void;
    setSelected(newSelectedDates: Date[]): void;
    nextMonth(): void;
    prevMonth(): void;
    addEventListener(callable: callable): void;
    removeEventListener(callable: callable): void;
    render(): void;
}
//# sourceMappingURL=dateInterface.d.ts.map