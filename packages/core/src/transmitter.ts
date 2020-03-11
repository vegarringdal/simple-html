import { getTransmitterSymbol } from './symbols';

// we need this to survive hmr so parts can unsubsribe
if(!(<any>window)[getTransmitterSymbol('transmitter')]){
    (<any>window)[getTransmitterSymbol('transmitter')] = {};
}

function transmitter(){
    return (<any>window)[getTransmitterSymbol('transmitter')];
}



// microtask
export function publish(channel: string, ...args: any[]): void {
    Promise.resolve().then(() => {
        if (Array.isArray(transmitter()[channel])) {
            for (let i = 0, len = transmitter()[channel].length; i < len; i++) {
                const ctx = transmitter()[channel][i].ctx;
                transmitter()[channel][i].func.apply(ctx, args);
            }
        }
    });
}

// sync
export function publishSync(channel: string, ...args: any[]): void {
    if (Array.isArray(transmitter()[channel])) {
        for (let i = 0, len = transmitter()[channel].length; i < len; i++) {
            const ctx = transmitter()[channel][i].ctx;
            transmitter()[channel][i].func.apply(ctx, args);
        }
    }
}

//next task
export function publishNext(channel: string, ...args: any[]): void {
    setTimeout(() => {
        if (Array.isArray(transmitter()[channel])) {
            for (let i = 0, len = transmitter()[channel].length; i < len; i++) {
                const ctx = transmitter()[channel][i].ctx;
                transmitter()[channel][i].func.apply(ctx, args);
            }
        }
    }, 0);
}

// sync
export function unSubscribe(channel: string, ctx: any): void {
    if (Array.isArray(transmitter()[channel])) {
        let events = transmitter()[channel].filter((event: any) => {
            if (event.ctx !== ctx) {
                return true;
            } else {
                return false;
            }
        });
        transmitter()[channel] = events;
    }
}

// sync
export function subscribe(channel: string, ctx: any, func: Function): void {
    if (!Array.isArray(transmitter()[channel])) {
        transmitter()[channel] = [];
    }
    transmitter()[channel].push({ ctx: ctx, func: func });
}
