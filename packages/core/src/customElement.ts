import { render } from 'lit-html';
import { getObservedAttributesSymbol, getObservedAttributesMapSymbol } from './symbols';

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
        type fn = () => void;
        const Base: any = class extends elementClass {
            disconnectCallbackCallers: fn[];
            updateCallbackCallers: fn[];
            constructor() {
                super();
                // lets have this to know if constructor is done or not
                // this way we can skip prop attribute changed values happing before constructor
                this.__constructorDone = true;
            }

            /**
             * called
             */
            renderCallback() {
                if (super.renderCallback) {
                    super.renderCallback.call(this);
                }
            }

            render(...result: any[]) {
                this.renderCallback();
                if (super.render) {
                    const template = super.render.call(this, ...result);
                    Promise.resolve(template).then((templates) => {
                        render(templates, this as any, { eventContext: this as any });
                        if (super.updatedCallback || this.updateCallbackCallers) {
                            //delay so it actually get a chance to update
                            requestAnimationFrame(() => {
                                if (this.updateCallbackCallers) {
                                    this.updateCallbackCallers.forEach((call: () => void) =>
                                        call()
                                    );
                                }
                                this.updateCallbackCallers = [];
                                if (super.updatedCallback) {
                                    super.updatedCallback();
                                }
                            });
                        }
                    });
                }
            }

            adoptedCallback() {
                if (super.adoptedCallback) {
                    super.adoptedCallback();
                }
            }

            connectedCallback() {
                if (super.connectedCallback) {
                    super.connectedCallback.call(this);
                }
                this.render(this);
            }

            /**
             * register for disconnectCallback event
             * @param call
             */
            registerDisconnectCallback(call: () => void) {
                if (this.disconnectCallbackCallers) {
                    this.disconnectCallbackCallers.push(call);
                } else {
                    this.disconnectCallbackCallers = [];
                    this.disconnectCallbackCallers.push(call);
                }
            }

            /**
             * register for next callback event - only once
             * @param call
             */
            registerUpdatedCallback(call: () => void) {
                if (this.updateCallbackCallers) {
                    this.updateCallbackCallers.push(call);
                } else {
                    this.updateCallbackCallers = [];
                    this.updateCallbackCallers.push(call);
                }
            }

            disconnectedCallback() {
                if (this.disconnectCallbackCallers) {
                    this.disconnectCallbackCallers.forEach((call: () => void) => call());
                }
                this.updateCallbackCallers = []; // remove these if any we dont stop it getting garbage collected
                this.disconnectCallbackCallers = [];
                if (super.disconnectedCallback) {
                    super.disconnectedCallback.call(this);
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
