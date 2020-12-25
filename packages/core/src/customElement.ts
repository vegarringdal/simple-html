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

        const Base: any = class extends elementClass {
            constructor() {
                super();
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
                        if (super.updatedCallback) {
                            //delay so it actually get a chance to update
                            requestAnimationFrame(() => {
                                super.updatedCallback();
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
                if (this.callers) {
                    this.callers.push(call);
                } else {
                    this.callers = [];
                    this.callers.push(call);
                }
            }

            disconnectedCallback() {
                if (this.callers) {
                    this.callers.forEach((call: () => void) => call());
                }
                this.callers = [];
                if (super.disconnectedCallback) {
                    super.disconnectedCallback.call(this);
                }
            }

            attributeChangedCallback(name: string, oldValue: string, newValue: string) {
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
