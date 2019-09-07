import { requestRender } from './requestRender';
import {
    getObservedAttributesMapSymbol,
    getObservedAttributesSymbol,
    getPropSymbol
} from './symbols';

/**
 * @attibute- decorator
 *
 */
export function attribute(): Function {
    return function reg(_class: any, prop: string): void {
        Object.defineProperty(_class, prop, {
            get: function() {
                return this[getPropSymbol(this.tagName + '_' + prop)];
            },
            set: function(x: any) {
                const oldValue = this[getPropSymbol(this.tagName + '_' + prop)];
                this[getPropSymbol(this.tagName + '_' + prop)] = x;
                if (this.valuesChanged && oldValue !== x) {
                    this.valuesChanged('property', prop, oldValue, x);
                }
                if (oldValue !== x) {
                    requestRender(this);
                }
            }
        });

        // replace uppercase with lower and add '-'
        const attribute = prop
            .replace(/([a-z])([A-Z])/g, '$1-$2')
            .replace(/\s+/g, '-')
            .toLowerCase();

        //create a map so we can find it later
        if (!_class[getObservedAttributesMapSymbol()]) {
            _class[getObservedAttributesMapSymbol()] = new Map();
        }
        _class[getObservedAttributesMapSymbol()].set(attribute, prop);

        // add to observedAttributes
        if (_class[getObservedAttributesSymbol()]) {
            _class[getObservedAttributesSymbol()].push(attribute);
        } else {
            _class[getObservedAttributesSymbol()] = [];
            _class[getObservedAttributesSymbol()].push(attribute);
        }
    };
}
