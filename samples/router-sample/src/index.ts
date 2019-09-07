// import main css
import './hmr';
import {
    enableLogger,
    unknowRouteHandler,
    authRouteHandler,
    addRouterConfig,
    goto,
    href
} from '@simple-html/router';
import './index.css';
// import our app
import './components/app-component';

enableLogger();

unknowRouteHandler(() => {
    goto(href('unknown'));
});

authRouteHandler(() => {
    alert('you have no access');
    goto(href('home'));

    return false;
});

addRouterConfig('main', [
    {
        path: '',
        name: 'home',
        load: () => {
            return import('./components/home');
        },
        componentName: 'home-component'
    },
    {
        name: 'about',
        path: 'about',
        load: () => {
            return import('./components/about');
        },
        componentName: 'about-component'
    },
    {
        name: 'settings',
        path: 'settings',
        load: () => {
            return import('./components/settings');
        },
        componentName: 'settings-component',
        isAuth: true
    },
    {
        name: 'settings-type',
        path: 'settings/:type',
        load: () => {
            return import('./components/settings');
        },
        componentName: 'settings-component',
        isNav: false
    },
    {
        name: 'notfound',
        path: 'unknown',
        load: () => {
            return import('./components/notfound');
        },
        componentName: 'notfound-component',
        isNav: false
    },
    {
        name: 'else',
        path: 'else',
        children: true,
        load: () => {
            return import('./components/else');
        },
        componentName: 'else-component'
    }
]);

addRouterConfig('sub', [
    {
        name: 'home sub',
        path: 'else',
        load: () => {
            return import('./components/home');
        },
        componentName: 'home-component'
    },
    {
        name: 'else sub',
        path: `else/about`,
        load: () => {
            return import('./components/about');
        },
        componentName: 'about-component'
    },
    {
        name: 'settings sub',
        path: `else/settings`,
        load: () => {
            return import('./components/settings');
        },
        componentName: 'settings-component'
    }
]);
