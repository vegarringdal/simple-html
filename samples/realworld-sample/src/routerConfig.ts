import {  getRouter, addRouterConfig } from '@simple-html/router';
import { publish } from '@simple-html/core';

// enableLogger();
getRouter().registerRouteChangeHandler((options: any, activeRouter: any) => {
    publish('routeChange', { options, activeRouter });
});

addRouterConfig('main', [
    {
        path: '',
        load: () => import('./routes/home-route'),
        componentName: 'home-comp',
        name: 'HomeBlank',
        isNav: false
    },
    {
        path: 'home',
        componentName: 'home-comp',
        load: () => import('./routes/home-route'),
        name: 'Home'
    },
    {
        path: 'home/type/feed',
        componentName: 'home-comp',
        load: () => import('./routes/home-route'),
        name: 'HomeFeed'
    },
    {
        path: 'home/type/all',
        componentName: 'home-comp',
        load: () => import('./routes/home-route'),
        name: 'HomeAll'
    },
    {
        path: 'home/:tag',
        componentName: 'home-comp',
        load: () => import('./routes/home-route'),
        name: 'HomeTag'
    },
    {
        path: 'profile/:name',
        componentName: 'profile-comp',
        load: () => import('./routes/profile-route'),
        name: 'Profile',
        children: true
    },
    {
        path: 'login',
        componentName: 'auth-comp',
        load: () => import('./routes/auth-route'),
        name: 'Login'
    },
    {
        path: 'register',
        componentName: 'Auth-comp',
        load: () => import('./routes/auth-route'),
        name: 'Register'
    },
    {
        path: 'settings',
        componentName: 'Settings-comp',
        load: () => import('./routes/settings-route'),
        name: 'Settings'
    },
    {
        path: 'editor',
        componentName: 'Editor-comp',
        load: () => import('./routes/editor-route'),
        name: 'Editor'
    },
    {
        path: 'editor/:slug',
        componentName: 'Editor-comp',
        load: () => import('./routes/editor-route'),
        name: 'EditorSlug'
    },
    {
        path: 'article/:slug',
        componentName: 'Article-comp',
        load: () => import('./routes/article-route'),
        name: 'Article'
    }
]);

addRouterConfig('subProfile', [
    {
        path: 'profile/:name',
        componentName: 'profile-article-route',
        load: () => import('./routes/profile-article-route'),
        name: 'MyPosts'
    },
    {
        path: 'profile/:name/favorites',
        componentName: 'profile-favorites-route',
        load: () => import('./routes/profile-favorites-route'),
        name: 'Favorites'
    }
]);
