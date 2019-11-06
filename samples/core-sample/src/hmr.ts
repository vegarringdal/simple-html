import { applyPolyfill, ReflowStrategy, rerenderInnerHTML } from 'custom-elements-hmr-polyfill';
import { clearInstance } from '@simple-html/core';
import { getRouter } from '@simple-html/router';

//cleanup
getRouter().cleanUp(true);
clearInstance(null);

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
