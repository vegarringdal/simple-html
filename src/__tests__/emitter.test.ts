import { describe, expect, it, vi } from 'vitest';
import { Emitter, type EventHandler } from '../emitter';

/**
 * The Emitter behind on() of the Datasource, GridInterface and DateInterface.
 */

type TestEvents = {
    ping: { n: number };
    pong: string;
};

describe('emitter - on and emit', () => {
    it('expect the handler to get the payload', () => {
        const emitter = new Emitter<TestEvents>();
        const handler = vi.fn();
        emitter.on('ping', handler);

        emitter.emit('ping', { n: 1 });

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith({ n: 1 });
    });

    it('expect only the handlers of the event sent to be called', () => {
        const emitter = new Emitter<TestEvents>();
        const ping = vi.fn();
        const pong = vi.fn();
        emitter.on('ping', ping);
        emitter.on('pong', pong);

        emitter.emit('pong', 'x');

        expect(ping).not.toHaveBeenCalled();
        expect(pong).toHaveBeenCalledWith('x');
    });

    it('expect handlers to be called in the order they subscribed', () => {
        const emitter = new Emitter<TestEvents>();
        const calls: string[] = [];
        emitter.on('ping', () => calls.push('a'));
        emitter.on('ping', () => calls.push('b'));

        emitter.emit('ping', { n: 1 });

        expect(calls).toEqual(['a', 'b']);
    });

    it('expect emit with no handlers not to throw', () => {
        const emitter = new Emitter<TestEvents>();
        expect(() => emitter.emit('ping', { n: 1 })).not.toThrow();
    });

    it('expect a handler that returns nothing to keep listening', () => {
        const emitter = new Emitter<TestEvents>();
        const received: number[] = [];
        emitter.on('ping', (data) => {
            received.push(data.n);
        });

        emitter.emit('ping', { n: 1 });
        emitter.emit('ping', { n: 2 });
        emitter.emit('ping', { n: 3 });

        expect(received).toEqual([1, 2, 3]);
    });

    it('expect what a handler returns to be ignored', () => {
        const emitter = new Emitter<TestEvents>();
        const received: number[] = [];
        // v5 kept a listener only when it returned something truthy
        const returnsFalse: EventHandler<TestEvents['ping']> = (data) => {
            received.push(data.n);
            return false;
        };
        emitter.on('ping', returnsFalse);

        emitter.emit('ping', { n: 1 });
        emitter.emit('ping', { n: 2 });

        expect(received).toEqual([1, 2]);
    });

    it('expect the same handler added twice to be called once', () => {
        const emitter = new Emitter<TestEvents>();
        const handler = vi.fn();
        emitter.on('ping', handler);
        emitter.on('ping', handler);

        emitter.emit('ping', { n: 1 });

        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('expect a handler that is not a function to throw when subscribing', () => {
        const emitter = new Emitter<TestEvents>();
        // the v5 style object listener, as a javascript user can still pass it
        const v5Listener: unknown = { handleEvent: () => true };

        expect(() => emitter.on('ping', v5Listener as EventHandler<TestEvents['ping']>)).toThrow(TypeError);
    });
});

describe('emitter - unsubscribe', () => {
    it('expect the function on() returns to unsubscribe the handler', () => {
        const emitter = new Emitter<TestEvents>();
        const handler = vi.fn();
        const off = emitter.on('ping', handler);

        emitter.emit('ping', { n: 1 });
        off();
        emitter.emit('ping', { n: 2 });

        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('expect unsubscribing to leave the other handlers', () => {
        const emitter = new Emitter<TestEvents>();
        const removed = vi.fn();
        const kept = vi.fn();
        const off = emitter.on('ping', removed);
        emitter.on('ping', kept);

        off();
        emitter.emit('ping', { n: 1 });

        expect(removed).not.toHaveBeenCalled();
        expect(kept).toHaveBeenCalledTimes(1);
    });

    it('expect calling the unsubscribe function twice to be fine', () => {
        const emitter = new Emitter<TestEvents>();
        const off = emitter.on('ping', vi.fn());
        off();
        expect(() => off()).not.toThrow();
    });

    it('expect a handler to be able to unsubscribe itself while the event is sent', () => {
        const emitter = new Emitter<TestEvents>();
        const calls: string[] = [];
        const off = emitter.on('ping', () => {
            calls.push('once');
            off();
        });
        emitter.on('ping', () => calls.push('always'));

        emitter.emit('ping', { n: 1 });
        emitter.emit('ping', { n: 2 });

        expect(calls).toEqual(['once', 'always', 'always']);
    });

    it('expect a handler unsubscribed by an earlier handler not to be called for that event', () => {
        const emitter = new Emitter<TestEvents>();
        const second = vi.fn();
        emitter.on('ping', () => offSecond());
        const offSecond = emitter.on('ping', second);

        emitter.emit('ping', { n: 1 });

        expect(second).not.toHaveBeenCalled();
    });

    it('expect a handler added while an event is sent to be called from the next event on', () => {
        const emitter = new Emitter<TestEvents>();
        const added = vi.fn();
        const off = emitter.on('ping', () => {
            off();
            emitter.on('ping', added);
        });

        emitter.emit('ping', { n: 1 });
        expect(added).not.toHaveBeenCalled();

        emitter.emit('ping', { n: 2 });
        expect(added).toHaveBeenCalledWith({ n: 2 });
    });

    it('expect clear() to remove every handler', () => {
        const emitter = new Emitter<TestEvents>();
        const ping = vi.fn();
        const pong = vi.fn();
        emitter.on('ping', ping);
        emitter.on('pong', pong);

        emitter.clear();
        emitter.emit('ping', { n: 1 });
        emitter.emit('pong', 'x');

        expect(ping).not.toHaveBeenCalled();
        expect(pong).not.toHaveBeenCalled();
    });

    it('expect an unsubscribe function from before clear() to leave a new subscription alone', () => {
        const emitter = new Emitter<TestEvents>();
        const handler = vi.fn();
        const oldOff = emitter.on('ping', handler);
        emitter.clear();
        emitter.on('ping', handler);

        oldOff();
        emitter.emit('ping', { n: 1 });

        expect(handler).toHaveBeenCalledTimes(1);
    });
});
