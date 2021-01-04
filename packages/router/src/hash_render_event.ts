import { subscribe, unSubscribe, publish, disconnectedCallback } from '@simple-html/core';
/**
 * Simple functions used for subcribing hash event
 */

const HASH_RENDER_EVENT = 'HASH_RENDER_EVENT';
export function subscribeHashEvent(ctx: any, call: () => void) {
    subscribe(HASH_RENDER_EVENT, ctx, call);
}

export function unSubscribeHashEvent(ctx: any) {
    unSubscribe(HASH_RENDER_EVENT, ctx);
}

export function publishHashEvent() {
    publish(HASH_RENDER_EVENT);
}

/**
 * connect to routerEvent in elements connectedcallback, will automatically disconnect if dicconnectedcallback is called
 * @param context
 * @param callback
 */

export function connectHashChanges(context: HTMLElement, callback: () => void): void {
    // this register callback with simpleHtml elements disconnected callback
    disconnectedCallback(context, () => unSubscribe(HASH_RENDER_EVENT, context));

    // for following the event we just use the internal event handler
    subscribe(HASH_RENDER_EVENT, context, callback);
}
