import { getPropSymbol } from './symbols';

/**
 * @property value
 * To get around this issue: I get this when class have properties and I use createElement
 * Uncaught DOMException: Failed to construct 'CustomElement': The result must not have attributes
 *
 */
export function value(): Function {
    return function reg(_class: Function, prop: string): void {
        Object.defineProperty(_class, prop, {
            get: function () {
                return this[getPropSymbol(this.tagName + '_' + prop)];
            },
            set: function (x: any) {
                this[getPropSymbol(this.tagName + '_' + prop)] = x;
                return true;
            },
            configurable: true
        });
    };
}
