/**
 * Main router
 */

export const routerconfig = {
    home: {
        path: '#',
        title: 'Home',
        load: () => {
            return import('./home');
        },
        componentName: 'home-route',
        isNav: true
    },
    settings: {
        path: '#settings',
        title: 'Settings',
        load: () => {
            return import('./settings');
        },
        componentName: 'settings-route',
        isNav: true
    },
    login: {
        path: '#login',
        title: 'Login',
        load: () => {
            return import('./login');
        },
        componentName: 'login-route',
        isNav: false
    },
    unknown: {
        path: 'unknown',
        title: 'Unknown',
        load: () => {
            return import('./unknown');
        },
        componentName: 'unknown-route',
        isNav: false
    },
    child: {
        path: '#child',
        title: 'ChildRoute',
        load: () => {
            return import('./childrouter');
        },
        componentName: 'childrouter-route',
        isNav: true,
        children: true
    }
};

export function navs(router: 'sub' | 'main') {
    if (router === 'main') {
        return Object.keys(routerconfig).map(key => routerconfig[key]);
    } else {
        return Object.keys(routerconfig).map(key => routerconfig[key]);
    }
}

export function href(param: string) {
    return param;
}
