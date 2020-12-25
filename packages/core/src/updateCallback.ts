/**
 * Calls function when element disconnects
 * @param ctx SimpleHtml element only
 * @param call
 */
export function updatedCallback(ctx: HTMLElement, call: () => void) {
    (ctx as any).registerUpdatedCallback(call);
}
