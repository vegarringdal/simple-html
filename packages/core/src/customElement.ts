import { render } from 'lit-html';
import {
    getObservedAttributesSymbol,
    getObservedAttributesMapSymbol,
    getConstructorDoneSymbol,
    getDisconnectCallbackCallerSymbol,
    getUpdateCallbackCallersSymbol
} from './symbols';

/**
 * @customElement- decorator
 * only log if method is not standard, else its just
 */
export function customElement(elementName: string, extended?: ElementDefinitionOptions) {
    return function reg(elementClass: any) {
        const observedAttributes = elementClass.observedAttributes;
        Object.defineProperty(elementClass, 'observedAttributes', {
            set: function (value) {
                elementClass.prototype[getObservedAttributesSymbol()] = value;
                return true;
            },
            get: function () {
                return elementClass.prototype[getObservedAttributesSymbol()];
            },
            configurable: true
        });

        if (Array.isArray(observedAttributes) && Array.isArray(elementClass.observedAttributes)) {
            elementClass.observedAttributes = elementClass.observedAttributes.concat(
                observedAttributes
            );
        }
        // if @attribute is not used we just use the standard if any
        if (Array.isArray(observedAttributes) && !Array.isArray(elementClass.observedAttributes)) {
            elementClass.observedAttributes = observedAttributes;
        }

        const Base: any = class extends elementClass {
            ['updateCallbackCallersSymbol']: (() => void)[];
            ['getDisconnectCallbackCallerSymbol']: (() => void)[];
            ['getConstructorDoneSymbol']: boolean;

            constructor(...result: any[]) {
                super(...result);
                // lets have this to know if constructor is done or not
                // this way we can skip prop attribute changed values happing before constructor
                this[getUpdateCallbackCallersSymbol()] = [];
                this[getDisconnectCallbackCallerSymbol()] = [];
                this[getConstructorDoneSymbol()] = true;
            }

            render(...result: any[]) {
                if (super.render) {
                    const template = super.render.call(this, ...result);
                    Promise.resolve(template).then((templates) => {
                        render(templates, this as any, { eventContext: this as any });
                        const callers = this[getUpdateCallbackCallersSymbol()];
                        if (super.updatedCallback || callers.length) {
                            //delay so it actually get a chance to update
                            requestAnimationFrame(() => {
                                if (callers.length) {
                                    callers.forEach((call: () => void) => call());
                                }
                                this[getUpdateCallbackCallersSymbol()] = [];
                                if (super.updatedCallback) {
                                    super.updatedCallback();
                                }
                            });
                        }
                    });
                }
            }

            adoptedCallback(...result: any[]) {
                if (super.adoptedCallback) {
                    super.adoptedCallback.call(this, ...result);
                }
            }

            connectedCallback(...result: any[]) {
                if (super.connectedCallback) {
                    super.connectedCallback.call(this, ...result);
                }
                this.render(this);
            }

            /**
             * register for disconnectCallback event
             * @param call
             */
            registerDisconnectCallback(call: () => void) {
                this[getDisconnectCallbackCallerSymbol()].push(call);
            }

            /**
             * register for next callback event - only once
             * @param call
             */
            registerUpdatedCallback(call: () => void) {
                this[getUpdateCallbackCallersSymbol()].push(call);
            }

            disconnectedCallback(...result: any[]) {
                const callers = this[getDisconnectCallbackCallerSymbol()];
                if (callers.length) {
                    callers.forEach((call: () => void) => call());
                }
                this[getUpdateCallbackCallersSymbol()] = []; // remove these if any we dont stop it getting garbage collected
                this[getDisconnectCallbackCallerSymbol()] = [];
                if (super.disconnectedCallback) {
                    super.disconnectedCallback.call(this, ...result);
                }
            }

            attributeChangedCallback(name: string, oldValue: string, newValue: string) {
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
                //if our simpler method is set (this is used by the @attribute and @property decorators)
                if (super.valuesChangedCallback) {
                    super.valuesChangedCallback('attribute', name, oldValue, newValue);
                }
            }
        };
        if (!customElements.get(elementName)) {
            if (extended) {
                customElements.define(elementName, Base, extended);
            } else {
                customElements.define(elementName, Base);
            }
        } else {
            if ((globalThis as any).hmrCache) {
                if (extended) {
                    customElements.define(elementName, Base, extended);
                } else {
                    customElements.define(elementName, Base);
                }
            }
        }
    };
}
