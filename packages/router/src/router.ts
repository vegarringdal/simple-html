import { parsePattern, createRouteRegex, getVariables, logger } from './helpers';
import { instance } from '@simple-html/core';

export interface IRoutes {
    path: string;
    load: () => Promise<any>;
    name: string; // unique
    title?: string; //can be used for navs etc
    componentName: string;
    isNav?: boolean;
    /**I need to know if end out route needs to be open */
    children?: boolean;
    /**additional data you want to have on activate */
    data?: any;
    isAuth?: boolean;
}

export interface ActivateObject {
    children: boolean;
    name: string;
    title: string;
    isNav: boolean;
    href: string;
    data: any;
    componentName: string;
}

interface IFreeRouterElement {
    canDeactivate: () => Promise<boolean>;
    activate: (url: string, params: any, activateObject: ActivateObject) => Promise<void>; //when promise is resolved its showed
    connectedCallback: () => void;
}

export interface Router {
    addRouterConfig(name: string, routes: IRoutes[]): void;
}

export type IRouterHTMLElement = IFreeRouterElement & HTMLElement;

export class RouterInternal {
    public active: string[] = [];
    private routers: string[] = [];
    private routersConfig: IRoutes[][] = [];
    private backEventtriggered: boolean;
    private lastpop: string;
    private haltedActivate: string;
    private foundRoute: boolean;
    public activeRoute: ActivateObject;
    public usehash = true;
    private routeNotFoundCallback: (hash: string) => void;
    private routeAuthCallback: (options: ActivateObject) => void;
    public loadingHandlerCallback: (options: string, activeRouter: string) => void;
    public routeChangeHandlerCallback: (options: ActivateObject, activeRouter: string) => void;

    constructor() {
        this.addListeners();
    }

    addListeners() {
        this.hashChange = this.hashChange.bind(this);
        window.addEventListener('hashchange', this.hashChange);
    }

    removeListeners() {
        window.removeEventListener('hashchange', this.hashChange);
    }

    //helper for hmr
    cleanUp(evenListeners: boolean) {
        this.routers = [];
        this.usehash = true;
        this.active = [];
        this.routersConfig = [];
        this.backEventtriggered = null;
        this.lastpop = null;
        this.haltedActivate = null;
        this.activeRoute = null;
        this.foundRoute = null;
        if (evenListeners) {
            this.removeListeners();
        }
    }

    /**
     * Internal- do not use
     * used by internal element "free-router"
     * sets it as active element, important if child routes
     * @param name
     */
    public activateRouterElement(name: string) {
        if (this.active.indexOf(name) === -1) {
            this.active.push(name);
        }
        if (this.loadingHandlerCallback) {
            this.loadingHandlerCallback(location.hash, this.active[this.active.length - 1]);
        }
        this.dowork().then(() => {
            if (this.foundRoute === false) {
                this.routeNotFound();
            }
            if (this.routeChangeHandlerCallback) {
                this.routeChangeHandlerCallback(
                    this.activeRoute,
                    this.active[this.active.length - 1]
                );
            }
        });
    }

    /**
     * Internal- do not use
     * used by internal element "free-router"
     * @param name
     */
    public deactivateRouterElement(name: string) {
        let i = this.active.indexOf(name);
        if (i !== -1) {
            this.active.splice(i, 1);
        }
    }

    /**
     * Helper with going to a url with params
     * @param hash sample: 'something/:arg1/:arg2'
     * @param params sample: {arg1:person, arg2:22}
     */
    public goto(hash: string, params: any = {}) {
        const urls = hash.split('/').filter(x => (x ? true : false));
        let newUrl = '';
        urls.forEach((val, i) => {
            if (val[0] === ':' && params[val.substr(1, val.length)] !== undefined) {
                newUrl = newUrl + params[val.substr(1, val.length)];
            } else {
                newUrl = newUrl + `${val}`;
            }

            if (urls.length - 1 !== i) {
                newUrl = newUrl + `/`;
            }
        });

        location.hash = newUrl;
    }

    /**
     * Helper to get all nav from router
     * @param routerName The
     * @param active Set to tru if you want the active router, set routername to undefined/null
     */
    public getNavLinks(routerName: string | undefined, active?: boolean): ActivateObject[] {
        let result: any = [];
        let r_config = this.routersConfig[
            this.routers.indexOf(active ? this.active[this.active.length - 1] : routerName)
        ];
        if (r_config) {
            r_config.forEach(r => {
                result.push({
                    name: r.name,
                    title: r.title,
                    isNav: r.isNav === false ? false : true,
                    href: (this.usehash ? '#' : '') + r.path,
                    data: r.data,
                    componentName: r.componentName,
                    isAuth: r.isAuth
                });
            });
        }

        return result;
    }

    /**
     * Helper to get a nav from router
     * @param pathname
     * @param routerName
     * @param active
     */
    public getNavLink(
        pathname: string,
        routerName: string | undefined,
        active?: boolean
    ): ActivateObject {
        let result: any = {};
        let r_config = this.routersConfig[
            this.routers.indexOf(active ? this.active[this.active.length - 1] : routerName)
        ];
        if (r_config) {
            r_config.forEach(r => {
                if (r.name === pathname) {
                    result = {
                        name: r.name,
                        title: r.title,
                        isNav: r.isNav === false ? false : true,
                        href: (this.usehash ? '#' : '') + r.path,
                        data: r.data,
                        componentName: r.componentName,
                        isAuth: r.isAuth
                    };
                }
            });
        }

        return result;
    }

    /**
     * Infernal - do not use
     * Called on hash chnage event
     */
    private async hashChange() {
        this.lastpop = null;
        logger('router-hashChange', 'start', this.active[this.active.length - 1]);

        if (this.loadingHandlerCallback) {
            this.loadingHandlerCallback(location.hash, this.active[this.active.length - 1]);
        }

        if (this.backEventtriggered) {
            this.backEventtriggered = false;
        } else {
            await this.dowork();
            if (this.foundRoute === false) {
                if (this.active.length > 1) {
                    let y = this.active.pop();
                    if (y !== this.lastpop) {
                        this.lastpop = y;
                        await this.dowork();
                    }
                }
                if (this.active.length === 1 && !this.foundRoute) {
                    // todo
                    this.routeNotFound();
                }
            }
            if (this.routeChangeHandlerCallback) {
                this.routeChangeHandlerCallback(
                    this.activeRoute,
                    this.active[this.active.length - 1]
                );
            }
        }
    }

    /**
     * internal - do not use
     * called by hash change event or when setting new active router
     */
    private async dowork() {
        this.foundRoute = null;
        let hash = location.hash ? location.hash.substring(1, location.hash.length) : '';
        let routerElements = document.getElementsByTagName('free-router');
        let ok = true;
        for (let i = 0; routerElements.length > i; i++) {
            if (routerElements[i].getAttribute('name') === this.active[this.active.length - 1]) {
                let firstchild = (routerElements[i] as IRouterHTMLElement).children[0];
                if (firstchild) {
                    if ((firstchild as IRouterHTMLElement).canDeactivate) {
                        ok = await (firstchild as IRouterHTMLElement).canDeactivate();
                        if (ok !== true) {
                            this.backEventtriggered = true;
                            history.back();
                        }
                    } else {
                        ok = true;
                    }
                }
            }
        }

        if (ok === true) {
            this.foundRoute = false;
            logger('router-hashChange', 'routeSearch', this.active[this.active.length - 1]);
            for (let i = 0; routerElements.length > i; i++) {
                if (
                    !this.foundRoute &&
                    routerElements[i].getAttribute('name') === this.active[this.active.length - 1]
                ) {
                    let r_config = this.routersConfig[
                        this.routers.indexOf(this.active[this.active.length - 1])
                    ];
                    if (r_config) {
                        for (let y = 0; y < r_config.length; y++) {
                            const route = r_config[y];
                            let verified = false;
                            if (hash === '' || route.path === '') {
                                verified = hash === route.path;
                            } else {
                                let regex = new RegExp(
                                    createRouteRegex(parsePattern(route.path), route.children)
                                );
                                if (regex.test(hash)) {
                                    verified = true;
                                }
                            }

                            if (verified && route.isAuth) {
                                const result = await this.routeAuth(
                                    this.getNavLink(route.name, this.active[this.active.length - 1])
                                );

                                if (!result) {
                                    this.foundRoute = true;
                                    verified = false;
                                    y = r_config.length;
                                }
                            }

                            if (verified) {
                                y = r_config.length;
                                let oldRef = true;

                                if (this.activeRoute) {
                                    // we need to check if regex matches just incase we use parent component in child routes
                                    let regex = new RegExp(
                                        createRouteRegex(
                                            parsePattern(this.activeRoute.href),
                                            this.activeRoute.children
                                        )
                                    );
                                    oldRef = regex.test(hash);
                                }

                                const reUse =
                                    oldRef &&
                                    routerElements[i].children.length &&
                                    this.activeRoute &&
                                    this.activeRoute.componentName === route.componentName;

                                if (reUse) {
                                    logger(
                                        'router-hashChange',
                                        'verified, but reuse activated',
                                        this.active[this.active.length - 1],
                                        hash,
                                        route.name
                                    );
                                }
                                this.activeRoute = {
                                    name: route.name,
                                    href: route.path,
                                    title: route.title,
                                    isNav: route.isNav ? true : false,
                                    data: Object.assign({}, route.data),
                                    componentName: route.componentName,
                                    children: route.children
                                } as ActivateObject;
                                logger(
                                    'router-hashChange',
                                    'verified',
                                    this.active[this.active.length - 1],
                                    hash,
                                    route.name
                                );
                                this.foundRoute = true;
                                if (route.load && !reUse) {
                                    await route.load();
                                }
                                if (!reUse && routerElements[i].children.length) {
                                    logger(
                                        'router-hashChange',
                                        'removing child',
                                        this.active[this.active.length - 1],
                                        hash
                                    );
                                    routerElements[i].removeChild(routerElements[i].children[0]);
                                }
                                let el;
                                if (!reUse) {
                                    el = document.createElement(route.componentName.toUpperCase());
                                    logger(
                                        'router-hashChange',
                                        'chreate element',
                                        this.active[this.active.length - 1],
                                        hash
                                    );
                                }
                                if (this.haltedActivate) {
                                    this.haltedActivate = null;
                                }

                                let elToUse = reUse ? routerElements[i].children[0] : el;

                                if ((<IRouterHTMLElement>elToUse).activate) {
                                    let active = this.active[this.active.length - 1];
                                    this.haltedActivate = route.path;
                                    // todo: do I need a timeout to be able to abort?
                                    await (<IRouterHTMLElement>elToUse).activate(
                                        route.path,
                                        <any>getVariables(parsePattern(route.path), hash),
                                        this.activeRoute
                                    );
                                    if (reUse) {
                                        logger('router-hashChange', 'reUse activated');
                                        if ((<any>elToUse).connectedCallback) {
                                            (<any>elToUse).connectedCallback();
                                        }
                                    } else {
                                        if (this.haltedActivate === route.path) {
                                            logger(
                                                'router-hashChange',
                                                'append child',
                                                this.active[this.active.length - 1],
                                                hash
                                            );
                                            (<any>el).classList.add('free-router-view');
                                            routerElements[i].appendChild(el);
                                        } else {
                                            (<any>el).disconnectedCallback
                                                ? (<any>el).disconnectedCallback()
                                                : null;
                                            logger(
                                                'router-hashChange',
                                                'skipping append child',
                                                active,
                                                hash
                                            );
                                        }
                                    }
                                } else {
                                    if (!reUse) {
                                        logger(
                                            'router-hashChange',
                                            'append child',
                                            this.active[this.active.length - 1],
                                            hash
                                        );
                                        (<any>el).classList.add('free-router-view');
                                        routerElements[i].appendChild(el);
                                    } else {
                                        logger('router-hashChange', 'reUse activated');
                                    }
                                }
                            } else {
                                logger(
                                    'router-hashChange',
                                    'not-verified',
                                    this.active[this.active.length - 1],
                                    hash,
                                    route.name
                                );
                            }
                        }
                    }
                }
            }
        }
    }

    /** Internal */
    private routeNotFound() {
        if (this.routeNotFoundCallback) {
            this.routeNotFoundCallback(location.hash);
        } else {
            console.log('route not found', location.hash);
        }
    }

    /**
     *  Call to set handler for when router does not find view
     * @param x
     */
    public registerUnknowRouteHandler(callback: (hash: string) => void) {
        this.routeNotFoundCallback = callback;
    }

    /** Internal */
    private routeAuth(options: ActivateObject) {
        if (this.routeAuthCallback) {
            return this.routeAuthCallback(options);
        } else {
            console.log('no auth function registered', location.hash);
            return true;
        }
    }

    /**
     * gets path from name of route
     * @param name
     * @param _router
     */
    public href(name: string, params?: object, clean?: boolean) {
        let result = 'unknown';
        this.routersConfig.forEach(x => {
            x.forEach(y => {
                if (y.name === name) {
                    result = y.path;
                }
            });
        });
        if (params) {
            const urls = result.split('/').filter(x => (x ? true : false));
            let newUrl = '';
            urls.forEach((val, i) => {
                if (val[0] === ':' && params[val.substr(1, val.length)] !== undefined) {
                    newUrl = newUrl + params[val.substr(1, val.length)];
                } else {
                    newUrl = newUrl + `${val}`;
                }

                if (urls.length - 1 !== i) {
                    newUrl = newUrl + `/`;
                }
            });
            result = newUrl;
        }
        return clean ? result : (this.usehash ? '#' : '') + result;
    }

    /**
     *  Call to set handler for when router does not find view
     * @param x
     */
    public registerAuthRouteHandler(callback: (options: ActivateObject) => void) {
        this.routeAuthCallback = callback;
    }

    /**
     * handler for when its loading
     * @param callback
     */
    public registerLoadingHandler(callback: (hash: string, activeRouter: string) => void) {
        this.loadingHandlerCallback = callback;
    }

    /**
     *
     * @param callback handler for when a route change
     */
    public registerRouteChangeHandler(
        callback: (options: ActivateObject, activeRouter: string) => void
    ) {
        this.routeChangeHandlerCallback = callback;
    }

    /**
     * Use to configure router
     * @param name
     * @param routes
     */
    public addRouterConfig(name: string, routes: IRoutes[]) {
        console.log('routerconfig added', name);
        if (this.routers.indexOf(name) !== -1) {
            console.error('can not have 2 routers with same name, this needs to be unique');
            // throw new Error('can not have 2 routers with same name');
        } else {
            let currentRoutes: string[] = [];
            routes.forEach(y => {
                if (this.href(y.name) !== (this.usehash ? '#' : '') + 'unknown') {
                    console.error(
                        'you should need to have unique names for routes, please fix:',
                        name,
                        y.name
                    );
                }
                if (currentRoutes.indexOf(y.name) !== -1) {
                    console.error(
                        'you have same name on some of routes in new config, please fix:',
                        y.name
                    );
                }
                currentRoutes.push(y.name);
            });
            this.routers.push(name);
            this.routersConfig.push(routes);
        }
    }

    /**
     * use to remove routerconfig, only used if you have child router
     * @param name
     */
    public removeRouterConfig(name: string) {
        let i = this.routers.indexOf(name);
        if (i !== -1) {
            this.routers.splice(i, 1);
            this.routersConfig.splice(i, 1);
        }
    }
}

export function getRouter() {
    return instance(RouterInternal);
}

export function href(name: string, params?: object, clean?: boolean) {
    return getRouter().href(name, params, clean);
}

export function navs(routerName: string) {
    return getRouter().getNavLinks(routerName);
}

export function addRouterConfig(name: string, routes: IRoutes[]) {
    return getRouter().addRouterConfig(name, routes);
}

export function removeRouterConfig(name: string) {
    return getRouter().removeRouterConfig(name);
}

export function unknowRouteHandler(callback: (hash: string) => void) {
    return getRouter().registerUnknowRouteHandler(callback);
}

export function authRouteHandler(callback: (options: ActivateObject) => void) {
    return getRouter().registerAuthRouteHandler(callback);
}

export function goto(hash: string, params: any = {}) {
    return getRouter().goto(hash, params);
}
