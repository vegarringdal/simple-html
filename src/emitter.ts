/**
 * A handler for one event: it gets the event's payload. What it returns is ignored, a handler
 * stays subscribed until you call the function `on()` returned.
 *
 * Only needed when you write a handler on its own, before passing it to `on()`.
 * The payload type comes from the event map: {@link DatasourceEvents}, {@link GridEvents},
 * {@link DateEvents}.
 *
 * @typeParam Payload the payload of the event, e.g. `DatasourceEvents['select']`
 *
 * @example
 * ```ts
 * import type { DatasourceEvents, EventHandler } from '@simple-html/grid';
 *
 * const onSelect: EventHandler<DatasourceEvents['select']> = (data) => {
 *     console.log('row', data.row, 'selected by', data.info);
 * };
 * const off = datasource.on('select', onSelect);
 * ```
 */
export type EventHandler<Payload> = (data: Payload) => void;

/**
 * Keeps the event handlers of one object, per event name, and calls them.
 * Used by `Datasource`, `GridInterface` and `DateInterface`, each with its own event map.
 * Not exported from the package: users subscribe with the `on()` of those classes.
 *
 * - the same handler added twice to the same event is kept once (it is a Set), and either
 *   unsubscribe function removes it
 * - a handler removed while an event is being sent is not called for it, a handler added while
 *   an event is being sent is called from the next event on
 * - an error thrown by a handler is not caught, it stops the handlers after it for that event
 *
 * @typeParam Events the event map: event name -> payload type
 */
export class Emitter<Events> {
    /**
     * handlers per event name, the Set is made by the first `on()` for that name
     */
    private handlers: { [Type in keyof Events]?: Set<EventHandler<Events[Type]>> } = {};

    /**
     * calls `handler` with the payload every time `type` is sent
     * @returns a function that unsubscribes the handler, calling it more than once is fine
     */
    public on<Type extends keyof Events>(type: Type, handler: EventHandler<Events[Type]>): () => void {
        // the v5 listener was an object with handleEvent, fail here and not on the next event
        if (typeof handler !== 'function') {
            throw new TypeError(`on('${String(type)}', handler): handler must be a function`);
        }

        const handlers: Set<EventHandler<Events[Type]>> = this.handlers[type] ?? new Set();
        this.handlers[type] = handlers;
        handlers.add(handler);

        // deletes from the Set it was added to: after clear() a new on() with the same handler
        // gets a new Set, and an old unsubscribe function leaves it alone
        return () => {
            handlers.delete(handler);
        };
    }

    /**
     * sends an event: calls every handler of `type` with `data`, in the order they subscribed
     */
    public emit<Type extends keyof Events>(type: Type, data: Events[Type]): void {
        const handlers = this.handlers[type];
        if (!handlers) {
            return;
        }

        // loop over a copy, a handler can unsubscribe itself or others while we loop
        for (const handler of Array.from(handlers)) {
            if (handlers.has(handler)) {
                handler(data);
            }
        }
    }

    /**
     * removes every handler of every event
     */
    public clear(): void {
        this.handlers = {};
    }
}
