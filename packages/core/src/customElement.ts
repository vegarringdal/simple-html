import { render } from 'lit-html';
import { requestRender } from './requestRender';
import { getObservedAttributesSymbol, getObservedAttributesMapSymbol } from './symbols';
import { logger } from './logger';






/**
 * @customElement- decorator
 *
 */
export function customElement(elementName: string, extended?: ElementDefinitionOptions) {
    return function reg(elementClass: any) {
        let observedAttributes = elementClass.observedAttributes;
        Object.defineProperty(elementClass, 'observedAttributes', {
            set: function(value) {
                elementClass.prototype[getObservedAttributesSymbol()] = value;
                return true;
            },
            get: function() {
                return elementClass.prototype[getObservedAttributesSymbol()];
            },
            configurable: true
        });
        if (Array.isArray(observedAttributes) && Array.isArray(elementClass.observedAttributes)) {
            elementClass.observedAttributes = elementClass.observedAttributes.concat(
                observedAttributes
            );
        }
        
        const base: any = class extends elementClass {
            constructor() {
                super();
                logger('constructor', this, super.tagName)
            }
            render(...result: any[]) {
                logger('render', this, super.tagName)
                const template = super.render.call(this, ...result);
                Promise.resolve(template).then(templates => {
                    render(templates, <any>this, { eventContext: <any>this });
                    if (super.updated) {
                        //delay so it actually get a chance to update
                        setTimeout(() => {
                            super.updated();
                        });
                    }
                });
            }
            connectedCallback() {
                logger('connectedCallback', this, super.tagName)
                if (super.connectedCallback) {
                    super.connectedCallback.call(this);
                }
                this.render(this);
            }
            disconnectedCallback() {
               logger('disconnectedCallback', this, super.tagName)
                if (super.disconnectedCallback) {
                    super.disconnectedCallback.call(this);
                }
            }
            attributeChangedCallback(name: string, oldValue: string, newValue: string) {
                logger('attributeChangedCallback', this, super.tagName)
                //get map

                if (!this[getObservedAttributesMapSymbol()]) {
                    const attribute = name
                        .replace(/([a-z])([A-Z])/g, '$1-$2')
                        .replace(/\s+/g, '-')
                        .toLowerCase();
                    this[getObservedAttributesMapSymbol()] = new Map();
                    this[getObservedAttributesMapSymbol()].set(attribute, name);
                }

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
