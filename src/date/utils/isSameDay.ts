/**
 * true when both are on the same day, in local time - whatever the time of each
 * @param time a timestamp, as `DateInterface.selected` holds them
 * @param date the day
 */
export function isSameDay(time: number, date: Date): boolean {
    const day = new Date(time);
    return day.getFullYear() === date.getFullYear() && day.getMonth() === date.getMonth() && day.getDate() === date.getDate();
}
