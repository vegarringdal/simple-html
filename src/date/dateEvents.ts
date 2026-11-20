/**
 * The events of a {@link DateInterface}: event name -> the payload its handler gets.
 *
 * Subscribe with `dateInterface.on(name, handler)`, the payload is typed from this map.
 * `on()` returns a function that unsubscribes. Removing the date element from the dom
 * unsubscribes every handler.
 *
 * @example
 * ```ts
 * import { DateInterface } from '@simple-html/grid';
 *
 * declare const dateInterface: DateInterface;
 *
 * const off = dateInterface.on('date-select', (date) => {
 *     console.log(date ? date.toISOString() : 'cleared');
 * });
 * off(); // unsubscribe
 * ```
 */
export interface DateEvents {
    /**
     * A date was picked in the date picker (`datepicker: true`): the "Use" button sends the
     * picked date and time, the "Clear" button sends `null`. Clicking a day only picks it, "Now" goes
     * to the current date and time; neither sends the event. A calendar (`datepicker: false`) never
     * sends it - read `dateInterface.getSelected()`.
     */
    'date-select': Date | null;
}
