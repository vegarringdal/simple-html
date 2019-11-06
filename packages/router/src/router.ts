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
    private activeRoutes: string[] = [];
    private routerNames: string[] = [];
    private routerConfigs: IRoutes[][] = [];
    private canDeactivateRejection: boolean;
    private lastActiveRoute: string;
    private haltedActivate: string;
    private foundNextRoute: boolean;
    private currentActiveRoute: ActivateObject;
    private usehash = true;
    private routeNotFoundCallback: (path: string) => void;
    private routeAuthCallback: (options: ActivateObject) => void;
    private loadingHandlerCallback: (options: string, activeRouter: string) => void;
    private routeChangeHandlerCallback: (options: ActivateObject, activeRouter: string) => void;

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
        this.routerNames = [];
        this.usehash = true;
        this.activeRoutes = [];
        this.routerConfigs = [];
        this.canDeactivateRejection = null;
        this.lastActiveRoute = null;
        this.haltedActivate = null;
        this.currentActiveRoute = null;
        this.foundNextRoute = null;
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
        if (this.activeRoutes.indexOf(name) === -1) {
            this.activeRoutes.push(name);
        }
        if (this.loadingHandlerCallback) {
            this.loadingHandlerCallback(
                location.hash,
                this.activeRoutes[this.activeRoutes.length - 1]
            );
        }
        this.updateRouter().then(() => {
            if (this.foundNextRoute === false) {
                this.routeNotFound();
            }
            if (this.routeChangeHandlerCallback) {
                this.routeChangeHandlerCallback(
                    this.currentActiveRoute,
                    this.activeRoutes[this.activeRoutes.length - 1]
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
        let i = this.activeRoutes.indexOf(name);
        if (i !== -1) {
            this.activeRoutes.splice(i, 1);
        }
    }

    /**
     * Helper with going to a url with params
     * @param path sample: 'something/:arg1/:arg2'
     * @param params sample: {arg1:person, arg2:22}
     */
    public goto(path: string, params: any = {}) {
        const urls = path.split('/').filter(x => (x ? true : false));
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
        let routerConfig = this.routerConfigs[
            this.routerNames.indexOf(
                active ? this.activeRoutes[this.activeRoutes.length - 1] : routerName
            )
        ];
        if (routerConfig) {
            routerConfig.forEach(config => {
                result.push({
                    name: config.name,
                    title: config.title,
                    isNav: config.isNav === false ? false : true,
                    href: (this.usehash ? '#' : '') + config.path,
                    data: config.data,
                    componentName: config.componentName,
                    isAuth: config.isAuth
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
        const routerConfig = this.routerConfigs[
            this.routerNames.indexOf(
                active ? this.activeRoutes[this.activeRoutes.length - 1] : routerName
            )
        ];
        if (routerConfig) {
            routerConfig.forEach(config => {
                if (config.name === pathname) {
                    result = {
                        name: config.name,
                        title: config.title,
                        isNav: config.isNav === false ? false : true,
                        href: (this.usehash ? '#' : '') + config.path,
                        data: config.data,
                        componentName: config.componentName,
                        isAuth: config.isAuth
                    };
                }
            });
        }

        return result;
    }

    /**
     * Infernal - do not use
     * Called on hash change event
     */
    private async hashChange() {
        this.lastActiveRoute = null;
        logger('hashChange event ---> ', this.activeRoutes[this.activeRoutes.length - 1]);

        if (this.loadingHandlerCallback) {
            this.loadingHandlerCallback(
                location.hash,
                this.activeRoutes[this.activeRoutes.length - 1]
            );
        }

        if (this.canDeactivateRejection) {
            this.canDeactivateRejection = false;
        } else {
            await this.updateRouter();
            if (this.foundNextRoute === false) {
                // if route not found we need to go back a step if active is a child router
                if (this.activeRoutes.length > 1) {
                    let y = this.activeRoutes.pop();
                    if (y !== this.lastActiveRoute) {
                        this.lastActiveRoute = y;
                        await this.updateRouter();
                    }
                }
                if (this.activeRoutes.length === 1 && !this.foundNextRoute) {
                    // todo
                    this.routeNotFound();
                }
            }
            if (this.routeChangeHandlerCallback) {
                this.routeChangeHandlerCallback(
                    this.currentActiveRoute,
                    this.activeRoutes[this.activeRoutes.length - 1]
                );
            }
        }
    }

    /**
     * internal - do not use
     * called by hash change event or when setting new active router
     */
    private async updateRouter() {
        logger('updateRouter call ---> ', this.activeRoutes[this.activeRoutes.length - 1]);
        this.foundNextRoute = null;
        const currentPath = location.hash ? location.hash.substring(1, location.hash.length) : '';
        let routerElements = document.getElementsByTagName('free-router');
        let canDeactivate = true;

        // loop router elements and check if we can deactivate
        // if we cant then we go back
        for (let i = 0; routerElements.length > i; i++) {
            if (
                routerElements[i].getAttribute('name') ===
                this.activeRoutes[this.activeRoutes.length - 1]
            ) {
                let firstchild = (routerElements[i] as IRouterHTMLElement).children[0];
                if (firstchild) {
                    if ((firstchild as IRouterHTMLElement).canDeactivate) {
                        canDeactivate = await (firstchild as IRouterHTMLElement).canDeactivate();
                        if (canDeactivate !== true) {
                            this.canDeactivateRejection = true;
                            logger(
                                'canDeactivateRejection',
                                this.activeRoutes[this.activeRoutes.length - 1],
                                currentPath
                            );
                            history.back();
                        }
                    } else {
                        canDeactivate = true;
                    }
                }
            }
        }

        // back trigger is allowed, lets find if new path is valid
        if (canDeactivate === true) {
            this.foundNextRoute = false;
            logger(
                'canDeactivate OK, verifying path',
                this.activeRoutes[this.activeRoutes.length - 1]
            );

            for (let i = 0; routerElements.length > i; i++) {
                if (
                    !this.foundNextRoute &&
                    routerElements[i].getAttribute('name') ===
                        this.activeRoutes[this.activeRoutes.length - 1]
                ) {
                    let r_config = this.routerConfigs[
                        this.routerNames.indexOf(this.activeRoutes[this.activeRoutes.length - 1])
                    ];
                    if (r_config) {
                        for (let y = 0; y < r_config.length; y++) {
                            const route = r_config[y];
                            let verified = false;
                            if (currentPath === '' || route.path === '') {
                                verified = currentPath === route.path;
                            } else {
                                let regex = new RegExp(
                                    createRouteRegex(parsePattern(route.path), route.children)
                                );
                                if (regex.test(currentPath)) {
                                    verified = true;
                                }
                            }

                            if (verified && route.isAuth) {
                                const result = await this.routeAuth(
                                    this.getNavLink(
                                        route.name,
                                        this.activeRoutes[this.activeRoutes.length - 1]
                                    )
                                );

                                if (!result) {
                                    this.foundNextRoute = true;
                                    verified = false;
                                    y = r_config.length;
                                }
                            }

                            if (verified) {
                                y = r_config.length;
                                let oldRef = true;

                                if (this.currentActiveRoute) {
                                    // we need to check if regex matches just incase we use parent component in child routes
                                    let regex = new RegExp(
                                        createRouteRegex(
                                            parsePattern(this.currentActiveRoute.href),
                                            this.currentActiveRoute.children
                                        )
                                    );
                                    oldRef = regex.test(currentPath);
                                }

                                const reUse =
                                    oldRef &&
                                    routerElements[i].children.length &&
                                    this.currentActiveRoute &&
                                    this.currentActiveRoute.componentName === route.componentName;

                                if (reUse) {
                                    logger(
                                        'verified, but reuse activated',
                                        this.activeRoutes[this.activeRoutes.length - 1],
                                        currentPath,
                                        route.name
                                    );
                                }
                                this.currentActiveRoute = {
                                    name: route.name,
                                    href: route.path,
                                    title: route.title,
                                    isNav: route.isNav ? true : false,
                                    data: Object.assign({}, route.data),
                                    componentName: route.componentName,
                                    children: route.children
                                } as ActivateObject;

                                logger(
                                    'verified',
                                    this.activeRoutes[this.activeRoutes.length - 1],
                                    `current path: ${currentPath}`,
                                    `path on route: ${route.path}`
                                );

                                this.foundNextRoute = true;
                                if (route.load && !reUse) {
                                    await route.load();
                                }

                                if (!reUse && routerElements[i].children.length) {
                                    logger(
                                        'removing child',
                                        this.activeRoutes[this.activeRoutes.length - 1],
                                        currentPath
                                    );

                                    routerElements[i].removeChild(routerElements[i].children[0]);
                                }

                                let el;
                                if (!reUse) {
                                    logger(
                                        'create element',
                                        this.activeRoutes[this.activeRoutes.length - 1],
                                        currentPath
                                    );

                                    el = document.createElement(route.componentName.toUpperCase());
                                }

                                if (this.haltedActivate) {
                                    this.haltedActivate = null;
                                }

                                let elToUse = reUse ? routerElements[i].children[0] : el;

                                if ((<IRouterHTMLElement>elToUse).activate) {
                                    let active = this.activeRoutes[this.activeRoutes.length - 1];
                                    this.haltedActivate = route.path;
                                    // todo: do I need a timeout to be able to abort?
                                    await (<IRouterHTMLElement>elToUse).activate(
                                        route.path,
                                        <any>getVariables(parsePattern(route.path), currentPath),
                                        this.currentActiveRoute
                                    );

                                    if (reUse) {
                                        logger('reUse activated');

                                        if ((<any>elToUse).connectedCallback) {
                                            (<any>elToUse).connectedCallback();
                                        }
                                    } else {
                                        if (this.haltedActivate === route.path) {
                                            logger(
                                                'append child',
                                                this.activeRoutes[this.activeRoutes.length - 1],
                                                currentPath
                                            );

                                            (<any>el).classList.add('free-router-view');
                                            routerElements[i].appendChild(el);
                                        } else {
                                            (<any>el).disconnectedCallback
                                                ? (<any>el).disconnectedCallback()
                                                : null;

                                            logger('skipping append child', active, currentPath);
                                        }
                                    }
                                } else {
                                    if (!reUse) {
                                        logger(
                                            'append child',
                                            this.activeRoutes[this.activeRoutes.length - 1],
                                            currentPath
                                        );

                                        (<any>el).classList.add('free-router-view');
                                        routerElements[i].appendChild(el);
                                    } else {
                                        logger('reUse activated');
                                    }
                                }
                            } else {
                                logger(
                                    'not-verified',
                                    this.activeRoutes[this.activeRoutes.length - 1],
                                    `current path: ${currentPath}`,
                                    `path on route: ${route.path}`
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
    public registerUnknowRouteHandler(callback: (path: string) => void) {
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
        this.routerConfigs.forEach(x => {
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
    public registerLoadingHandler(callback: (path: string, activeRouter: string) => void) {
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
        if (this.routerNames.indexOf(name) !== -1) {
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
            this.routerNames.push(name);
            this.routerConfigs.push(routes);
        }
    }

    /**
     * use to remove routerconfig, only used if you have child router
     * @param name
     */
    public removeRouterConfig(name: string) {
        let i = this.routerNames.indexOf(name);
        if (i !== -1) {
            this.routerNames.splice(i, 1);
            this.routerConfigs.splice(i, 1);
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

export function unknowRouteHandler(callback: (path: string) => void) {
    return getRouter().registerUnknowRouteHandler(callback);
}

export function authRouteHandler(callback: (options: ActivateObject) => void) {
    return getRouter().registerAuthRouteHandler(callback);
}

export function goto(path: string, params: any = {}) {
    return getRouter().goto(path, params);
}
