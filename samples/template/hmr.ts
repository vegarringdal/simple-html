import { applyPolyfill, ReflowStrategy, rerenderInnerHTML } from 'custom-elements-hmr-polyfill';

// apply polly fill
rerenderInnerHTML();

// if you want to customize...
applyPolyfill(
    /* no reflowing */ ReflowStrategy.NONE,
    /* ignored, because reflowing is disabled */ -1,
    /* gets called for every re-definition of a web component */
    (elementName: string) => {
        console.log(elementName, 'updated');
    }
);
