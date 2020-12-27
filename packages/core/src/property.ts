import { requestRender } from './requestRender';
import { getConstructorDoneSymbol, getPropSymbol } from './symbols';

/**
 * @property decorator
 *
 */
export function property(options: { skipRender: boolean } = {} as any) {
    return function reg(_class: any, prop: string): void {
        Object.defineProperty(_class, prop, {
            get: function () {
                return this[getPropSymbol(this.tagName + '_' + prop)];
            },
            set: function (x: any) {
                const oldValue = this[getPropSymbol(this.tagName + '_' + prop)];
                this[getPropSymbol(this.tagName + '_' + prop)] = x;
                if (this[getConstructorDoneSymbol()]) {
                    if (this.valuesChangedCallback && oldValue !== x) {
                        this.valuesChangedCallback.call(this, 'property', prop, oldValue, x);
                    }
                    if (oldValue !== x && !options.skipRender) {
                        requestRender(this);
                    }
                }
            },
            configurable: true
        });
    };
}
