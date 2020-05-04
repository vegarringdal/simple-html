# @simple-html/{packages}

### Custom mono repo for :

-   [`@simple-html/grid`](https://github.com/simple-html/simple-html/tree/master/packages/grid)
-   [`@simple-html/core`](https://github.com/simple-html/simple-html/tree/master/packages/core)
-   [`@simple-html/router`](https://github.com/simple-html/simple-html/tree/master/packages/router)

## Production use

I only use it for very simple pages, if you use it make sure to lock down versions. Since breaking
changes comes to router/core and grid when needed until version 1.0.0 When I get there I will start
using semver. (maybe even at version 0.1.0)

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

### I need EdgeHTML browser to work in 2020...++

Your really should consider updating to newest Edge built with chromium..

```html
<script>
    // so it works in edge

    if (this.customElements) {
        try {
            // feature detect browsers that "forgot" 🙄 to implement built-in extends
            customElements.define('built-in', document.createElement('p').constructor, {
                extends: 'p'
            });
        } catch (_) {
            // only WebKit or Safari
            document.write('<script src="//unpkg.com/@ungap/custom-elements-builtin"><\x2fscript>');
        }
    } else {
        // only legacy browsers

        if (!window.globalThis) {
            window.globalThis = window;
        }

        if (!('isConnected' in Node.prototype)) {
            Object.defineProperty(Node.prototype, 'isConnected', {
                get() {
                    return (
                        !this.ownerDocument ||
                        !(
                            this.ownerDocument.compareDocumentPosition(this) &
                            this.DOCUMENT_POSITION_DISCONNECTED
                        )
                    );
                }
            });
        }

        document.write('<script src="//unpkg.com/document-register-element"><\x2fscript>');
    }
</script>
```
