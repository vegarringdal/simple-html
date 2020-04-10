import { publish, subscribe, unSubscribe } from '@simple-html/core';
// exports
export { routeMatch } from './routeMatch';
export { routeMatchAsync } from './routeMatchAsync';
export { gotoURL } from './gotoURL';
export { getRouteParams } from './getRouteParams';

/**
 * Simple functions used for subcribing hash event
 */

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

/**
 * Simple functions used for can deactivate event
 */

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
const canDeactivate = function () {
    return new Promise(async (resolve) => {
        canDeactivateCallers = [];
        publishCanDeactivateEvent();

        setTimeout(async () => {
            let result = true;
            for (let i = 0; i < canDeactivateCallers.length; i++) {
                const y = await Promise.resolve(canDeactivateCallers[i]);
                if (y === false) {
                    result = y;
                }
            }
            resolve(result);
        }, 0);
    });
};

// you call this during a CAN_DEACTIVATE_EVENT to stop navigation
export const stopCanDeactivate = function (promise: Promise<boolean>) {
    canDeactivateCallers.push(promise);
};

/**
 * starts router
 */

export function init() {
    let oldhash = window.location.hash;
    let isBackEvent = false;

    const hashChange = function () {
        if (!isBackEvent) {
            canDeactivate().then((result) => {
                if (result) {
                    oldhash = window.location.hash;
                    publish(HASH_RENDER_EVENT);
                } else {
                    isBackEvent = true;
                    window.location.hash = oldhash;
                }
            });
        } else {
            isBackEvent = false;
        }
    };

    window.addEventListener('hashchange', hashChange);

    // clean up during HMR
    const cleanUp = {
        handleEvent: function () {
            console.log('remove');
            window.removeEventListener('HMR-FUSEBOX', cleanUp);
            window.removeEventListener('hashchange', hashChange);
        }
    };

    window.addEventListener('HMR-FUSEBOX', cleanUp);
}
