import { applyPolyfill, ReflowStrategy } from 'custom-elements-hmr-polyfill';

if (document.body) {
    // I just want every thing to be rebuild from main element during hmr
    document.body.innerHTML = '';
    setTimeout(() => {
        document.body.innerHTML = '<app-root></app-root>';
    }, 0);
}

applyPolyfill(ReflowStrategy.NONE);
