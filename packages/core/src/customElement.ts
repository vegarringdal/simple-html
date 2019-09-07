import { render } from 'lit-html';
import { requestRender } from './requestRender';
import {
    getObservedAttributesSymbol,
    getObservedAttributesMapSymbol,
    getInjectSymbol
} from './symbols';
import { instance } from './instance';

/**
 * @customElement- decorator
 *
 */
export function customElement(elementName: string, extended?: ElementDefinitionOptions) {
    return function reg(elementClass: any) {
        Object.defineProperty(elementClass, 'observedAttributes', {
            get: function() {
                return elementClass.prototype[getObservedAttributesSymbol()];
            }
        });

        const getinject = (args: any): any[] => {
            const classes: any[] = [];
            if (Array.isArray(args)) {
                args.forEach(element => {
                    classes.push(instance(element));
                });
            }
            return classes;
        };

        const base = class extends elementClass {
            constructor() {
                super(...getinject(elementClass.prototype[getInjectSymbol()]));
            }
            render(...result: any[]) {
                render(super.render.call(this, ...result), <any>this, { eventContext: <any>this });
                if (super.updated) {
                    //delay so it actually get a chance to update
                    setTimeout(() => {
                        super.updated();
                    });
                }
            }
            connectedCallback() {
                if (super.connectedCallback) {
                    super.connectedCallback.call(this);
                }
                this.render(this);
            }
            disconnectedCallback() {
                if (super.disconnectedCallback) {
                    super.disconnectedCallback.call(this);
                }
            }
            attributeChangedCallback(name: string, oldValue: string, newValue: string) {
                //get map
                const nameProp = this[getObservedAttributesMapSymbol()].get(name);
                this[nameProp] = newValue || '';
                // if normal attributeChanged is set
                if (super.attributeChangedCallback) {
                    super.attributeChangedCallback.call(this, name, oldValue, newValue);
                }
                //if our simpler method is set
                if (super.valuesChangedMethod) {
                    super.valuesChangedMethod('attribute', name, oldValue, newValue);
                }
                requestRender(this);
            }
        };
        if (!customElements.get(elementName)) {
            if (extended) {
                customElements.define(elementName, base, extended);
            } else {
                customElements.define(elementName, base);
            }
        } else {
            if ((<any>globalThis).hmrCache) {
                if (extended) {
                    customElements.define(elementName, base, extended);
                } else {
                    customElements.define(elementName, base);
                }
            }
        }
    };
}
