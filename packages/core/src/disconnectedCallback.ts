/**
 * Calls function when element disconnects
 * @param ctx SimpleHtml element only
 * @param call
 */
export function disconnectedCallback(ctx: HTMLElement, call: () => void) {
    (ctx as any).registerDisconnectCallback(call);
}
