import {
    applyPolyfill,
    ReflowStrategy,
    rerenderInnerHTML
} from 'custom-elements-hmr-polyfill';

import { clearInstance } from '@simple-html/core';

// resetting all so we get a fresh start
clearInstance(null);

rerenderInnerHTML();

applyPolyfill(ReflowStrategy.NONE, 0, (elementName: string) => {
    // rerenderInnerHTML();
    console.log('updated', elementName);
});
