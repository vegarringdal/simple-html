# @simple-html/{packages}

### Custom mono repo for :


-   [`@simple-html/core`](https://github.com/simple-html/simple-html/tree/master/packages/core)
-   [`@simple-html/router`](https://github.com/simple-html/simple-html/tree/master/packages/router)
-   [`@simple-html/grid`](https://github.com/simple-html/simple-html/tree/master/packages/grid)
-   [`@simple-html/datasource`](https://github.com/simple-html/simple-html/tree/master/packages/datasource)
-   [`@simple-html/date`](https://github.com/simple-html/simple-html/tree/master/packages/date)  (experiment only atm)

## Why not use some other framework and where is the docs

I really did not want to use time on frameworks, just wanted to have fun.
I wanted to learn web components and liked how lit-html worked. After a while I started making helper function to make it simple to use in apps, so ended up creating this to learn more.

There isnt any good docs at the moment, only samples under sample folder.
Its on my todo list... first part is to create simple starter for web only with tailwindcss, then simple starter for web with nodejs server.

Why 1.0.0 when there is no docs? Ive been using it a lot lately and its working great for my use. Mostly simple web pages and tools for work.
Dont think I will be making many breaking changes in the near future.


## Development on current packages

-   Run `npm install`
-   see how to run samples and start coding

Work in progress - not using lerna for mono repo.

Fusebox is in watch mode when running the samples. Any changes to packages/\* files triggers rebuild
in fusebox.

`HMR` is enabled during the samples.

## Add new package

-   copy folder `./packages/template-package` and give it a new name
-   update name in package.json
-   update description in package.json
-   make a new sample- see how to make a new sample
-   copy sample template and use same name

## To run samples

You need to read development first before trying to run these.

-   `npm start core`
-   `npm start grid`
-   `npm start router`

## Make new sample

-   copy folder `./samples/template-starter` and give it a new name
-   add script to `package.json` to start it (look at the others for how)

## To build all packages

-   Set new package version in root `package.json`
-   Run `npm run build:all` - this will now build all packages and sync package json version in all.

## To publish all packages

-   Run `pubblish:all` to publish
    -   Or `publish:test` to run publish with `--dry-run` option

### HMR info

Load before everything

```ts
import { applyPolyfill, reflowDOM } from 'custom-elements-hmr-polyfill';

if (document.body) {
    // I just want every thing to be rebuild from main element during hmr
    document.body.innerHTML = '';
    setTimeout(() => {
        document.body.innerHTML = '<app-root></app-root>'; // <-- needs to match you main root element
    }, 0);
}

// apply polly fill
applyPolyfill();
```

To make state container save it self trigger this on hmr event:
`window.dispatchEvent(new CustomEvent('HMR-FUSEBOX'));`

### I need EdgeHTML/IE browser to work in 2020++

Use something else...
