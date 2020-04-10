/**
 * Calls function when element disconnects
 * @param ctx SimpleHtml element only
 * @param call
 */
export function disconnectedCallback(ctx: HTMLElement, call: Function) {
    (ctx as any).register(call);
}
