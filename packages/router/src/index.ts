import { getRouter, RouterInternal } from './router';
import { logger } from './helpers';
import { customElement } from '@simple-html/core';
export { enableLogger, disableLogger } from './helpers';

export {
    getRouter,
    href,
    authRouteHandler,
    unknowRouteHandler,
    addRouterConfig,
    goto,
    navs,
    removeRouterConfig
} from './router';
@customElement('free-router')
export class FreeRouter extends HTMLElement {
    router: RouterInternal;
    // private

    connectedCallback() {
        this.router = getRouter();
        logger('FreeRouter-connectedcallback', this.getAttribute('name'));
        this.router.activateRouterElement(this.getAttribute('name'));
    }

    render() {}

    disconnectedCallback() {
        logger('FreeRouter-disconnectedcallback', this.getAttribute('name'));
        this.router.deactivateRouterElement(this.getAttribute('name'));
    }
}
