import { publish, subscribe, unSubscribe } from '@simple-html/core';
// exports
export { routeMatch } from './routeMatch';
export { gotoURL } from './gotoUrl';
export { getRouteParams } from './getRouteParams';


const HASH_RENDER_EVENT = 'HASH_RENDER_EVENT';
export function subscribeHashEvent(ctx: any, call: Function) {
    subscribe(HASH_RENDER_EVENT, ctx, call);
}

export function unSubscribeHashEvent(ctx: any) {
    unSubscribe(HASH_RENDER_EVENT, ctx);
}

export function publishHashEvent() {
    publish(HASH_RENDER_EVENT);
}

const CAN_DEACTIVATE_EVENT = 'CAN_DEACTIVATE_EVENT';
export function subscribeCanDeactivateEvent(ctx: any, call: Function) {
    subscribe(CAN_DEACTIVATE_EVENT, ctx, call);
}

export function unSubscribeCanDeactivateEvent(ctx: any) {
    unSubscribe(CAN_DEACTIVATE_EVENT, ctx);
}

export function publishCanDeactivateEvent() {
    publish(CAN_DEACTIVATE_EVENT);
}

export let canDeactivateCallers: any[] = [];
const canDeactivate = function() {
    return new Promise(async resolve => {
        canDeactivateCallers = [];
        publishCanDeactivateEvent()

        setTimeout(async () => {
            let result = true;
            console.log(canDeactivateCallers)
            for (let i = 0; i < canDeactivateCallers.length; i++) {
                let y = await Promise.resolve(canDeactivateCallers[i]);
                if (y === false) {
                    result = y;
                }
            }
            resolve(result);
        }, 0);
    });
};

export function init() {
    if (!(<any>window).simpleHTMLRouter) {
        (<any>window).simpleHTMLRouter = true;
        let oldhash = window.location.hash;
        let isBackEvent = false;
        window.addEventListener('hashchange', function() {
            if (!isBackEvent) {
                canDeactivate().then(result => {
                    if (result) {
                        oldhash = window.location.hash;
                        publish(HASH_RENDER_EVENT);
                    } else {
                        isBackEvent = true;
                        window.location.hash = oldhash;
                    }
                });
            } else{
                isBackEvent = false;
            }
        });
    } else {
    }
}

export const stopCanDeactivate = function (promise: Promise<Boolean>) {
    canDeactivateCallers.push(promise);
};
