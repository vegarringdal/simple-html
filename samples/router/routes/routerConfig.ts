import { startRouter } from '@simple-html/router';
import { html } from 'lit-html';
startRouter();

export const routerConfig = {
    home: {
        path: '',
        href: '#',
        title: 'Home',
        load: () => import('./home'),
        html: html` <home-route></home-route> `,
        isNav: true
    },
    settings: {
        path: '#settings',
        href: '#settings',
        title: 'Settings',
        load: () => import('./settings'),
        html: html` <settings-route></settings-route> `,
        isNav: true
    },
    login: {
        path: '#login',
        href: '#login',
        title: 'Auth',
        load: () => import('./login'),
        html: html` <login-route></login-route>`,
        isNav: false
    },
    unknown: {
        path: 'unknown',
        href: 'unknown',
        title: 'Unknown',
        isNav: false
    },
    child: {
        path: '#child/*',
        href: '#child/',
        title: 'ChildRoute',
        isNav: true,
        children: {
            subHome: {
                path: '#child/',
                href: '#child/',
                title: 'SubHome',
                isNav: true
            },
            subSettings: {
                path: '#child/settings',
                href: '#child/settings',
                title: 'Sub Settings',
                isNav: true
            },
            protected: {
                path: '#child/protected',
                href: '#child/protected',
                title: 'sub Protected',
                isNav: true
            }
        }
    }
};

export function navs(router: 'sub' | 'main') {
    if (router === 'main') {
        return Object.keys(routerConfig).map((key) => routerConfig[key]);
    } else {
        const childRoutes = routerConfig.child.children;
        return Object.keys(childRoutes).map((key) => childRoutes[key]);
    }
}

export function href(param: string) {
    return param;
}
