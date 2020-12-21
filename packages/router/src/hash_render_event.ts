import { subscribe, unSubscribe, publish } from '@simple-html/core/src';
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
