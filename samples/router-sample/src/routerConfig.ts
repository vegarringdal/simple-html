import {
    unknowRouteHandler,
    authRouteHandler,
    addRouterConfig,
    goto,
    href
} from '@simple-html/router';
import { instance } from '@simple-html/core';
import { AppState } from './app-state';

export enum RoutesMain {
    Home = 'Home',
    Settings = 'Settings',
    Login = 'Login',
    Unknown = 'Unknown',
    Child_Router = 'Child_Router'
}

export enum RoutesSub {
    Home = 'Home sub',
    Settings = 'Settings sub',
    Protected = 'Protected sub'
}

unknowRouteHandler(() => {
    goto(href(RoutesMain.Unknown));
});

authRouteHandler(() => {
    const appState = instance(AppState);
    if (!appState.isAutenticated) {
        alert('you have no access, forwarding you to login');
        goto(href(RoutesMain.Login));
        return false;
    } else {
        return true;
    }
});

/**
 * Main router
 */

addRouterConfig('main', [
    {
        path: '',
        name: RoutesMain.Home,
        load: () => {
            return import('./routes/home');
        },
        componentName: 'home-route'
    },
    {
        path: 'settings',
        name: RoutesMain.Settings,
        load: () => {
            return import('./routes/settings');
        },
        componentName: 'settings-route'
    },
    {
        path: 'login',
        name: RoutesMain.Login,
        load: () => {
            return import('./routes/login');
        },
        componentName: 'login-route',
        isNav: false
    },
    {
        path: 'unknown',
        name: RoutesMain.Unknown,
        load: () => {
            return import('./routes/unknown');
        },
        componentName: 'unknown-route',
        isNav: false
    },
    {
        path: 'child',
        name: RoutesMain.Child_Router,
        load: () => {
            return import('./routes/childrouter');
        },
        componentName: 'childrouter-route',
        children: true
    }
]);

/**
 * Sub router
 */
addRouterConfig('sub', [
    {
        name: RoutesSub.Home,
        path: 'child',
        load: () => {
            return import('./routes/home');
        },
        componentName: 'home-route'
    },
    {
        name: RoutesSub.Settings,
        path: `child/settings`,
        load: () => {
            return import('./routes/settings');
        },
        componentName: 'settings-route'
    },
    {
        name: RoutesSub.Protected,
        path: `child/protected`,
        load: () => {
            return import('./routes/protected');
        },
        componentName: 'protected-route',
        isAuth: true
    }
]);
