import { requestRender } from './requestRender';
import { getPropSymbol } from './symbols';
import { logger } from './logger';

/**
 * @property decorator
 *
 */
export function property(): Function {
    return function reg(_class: Function, prop: string): void {
        Object.defineProperty(_class, prop, {
            get: function() {
                return this[getPropSymbol(this.tagName + '_' + prop)];
            },
            set: function(x: any) {

                logger('property set', this, this.tagName)

                const oldValue = this[getPropSymbol(this.tagName + '_' + prop)];
                this[getPropSymbol(this.tagName + '_' + prop)] = x;
                if (this.valuesChanged && oldValue !== x) {
                    this.valuesChanged('property', prop, oldValue, x);
                }
                if (oldValue !== x) {
                    requestRender(this);
                }
            },
            configurable: true
        });
    };
}
