import { instance } from './instance';

// simple helper for sending messages
class EventAggregator {
    private channels: any;

    constructor() {
        this.channels = {};
    }

    // microtask
    public publish(channel: string, ...args: any[]): void {
        Promise.resolve().then(() => {
            if (Array.isArray(this.channels[channel])) {
                for (let i = 0, len = this.channels[channel].length; i < len; i++) {
                    const ctx = this.channels[channel][i].ctx;
                    this.channels[channel][i].func.apply(ctx, args);
                }
            }
        });
    }

    public publishNext(channel: string, ...args: any[]): void {
        setTimeout(() => {
            if (Array.isArray(this.channels[channel])) {
                for (let i = 0, len = this.channels[channel].length; i < len; i++) {
                    const ctx = this.channels[channel][i].ctx;
                    this.channels[channel][i].func.apply(ctx, args);
                }
            }
        }, 0);
    }

    // sync
    public unSubscribe(channel: string, ctx: any): void {
        if (Array.isArray(this.channels[channel])) {
            let events = this.channels[channel].filter((event: any) => {
                if (event.ctx !== ctx) {
                    return true;
                } else {
                    return false;
                }
            });
            this.channels[channel] = events;
        }
    }

    // sync
    public subscribe(channel: string, ctx: any, func: Function): void {
        if (!Array.isArray(this.channels[channel])) {
            this.channels[channel] = [];
        }
        this.channels[channel].push({ ctx: ctx, func: func });
    }
}

export function publish(channel: string, ...args: any[]) {
    instance(EventAggregator).publish(channel, ...args);
}

export function publishNext(channel: string, ...args: any[]) {
    instance(EventAggregator).publishNext(channel, ...args);
}

export function unSubscribe(channel: string, ctx: any) {
    instance(EventAggregator).unSubscribe(channel, ctx);
}

export function subscribe(channel: string, ctx: any, func: Function) {
    instance(EventAggregator).subscribe(channel, ctx, func);
}
