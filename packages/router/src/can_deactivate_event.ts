import { subscribe, unSubscribe, disconnectedCallback, publishSync } from '@simple-html/core';
/**
 * Simple functions used for can deactivate event
 */

const CAN_DEACTIVATE_EVENT = 'CAN_DEACTIVATE_EVENT';
export function subscribeCanDeactivateEvent(ctx: any, call: () => void) {
    subscribe(CAN_DEACTIVATE_EVENT, ctx, call);
}

export function unSubscribeCanDeactivateEvent(ctx: any) {
    unSubscribe(CAN_DEACTIVATE_EVENT, ctx);
}

export function publishCanDeactivateEvent() {
    publishSync(CAN_DEACTIVATE_EVENT);
}

export let canDeactivateCallers: (() => Promise<boolean>)[] = [];
export function canDeactivate() {
    return new Promise(async (resolve) => {
        canDeactivateCallers = [];
        publishCanDeactivateEvent();

        let result = true;
        for (let i = 0; i < canDeactivateCallers.length; i++) {
            const y = await Promise.resolve(canDeactivateCallers[i]());
            if (y === false) {
                result = y;
            }
        }
        resolve(result);
    });
}

// you call this during a CAN_DEACTIVATE_EVENT to stop navigation
export const stopCanDeactivate = function (promise: () => Promise<boolean>) {
    canDeactivateCallers.push(promise);
};

export function connectCanDeactivate(ctx: any, call: () => Promise<boolean>) {
    disconnectedCallback(ctx, function () {
        unSubscribeCanDeactivateEvent(ctx);
    });
    subscribeCanDeactivateEvent(ctx, function () {
        stopCanDeactivate(call);
    });
}
