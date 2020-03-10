import {
    applyPolyfill,
    ReflowStrategy,
    rerenderInnerHTML
} from 'custom-elements-hmr-polyfill';

rerenderInnerHTML();

applyPolyfill(ReflowStrategy.NONE, 0, (elementName: string) => {
    // rerenderInnerHTML();
    console.log('updated', elementName);
});
