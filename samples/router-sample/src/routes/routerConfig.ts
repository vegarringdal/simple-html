/**
 * Main router
 */

export const routerconfig = {
    home: {
        path: '',
        title: 'Home',
        load: () => {
            return import('./home');
        },
        componentName: 'home-route'
    },
    settings: {
        path: 'settings',
        title: 'Settings',
        load: () => {
            return import('./settings');
        },
        componentName: 'settings-route'
    },
    login: {
        path: 'login',
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
        path: 'child',
        title: 'ChildRoute',
        load: () => {
            return import('./childrouter');
        },
        componentName: 'childrouter-route',
        children: true
    }
};

export function navs(router: 'sub'|'main'){
    
}