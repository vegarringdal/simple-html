import { getInjectSymbol } from './symbols';

export function inject(...args: any) {
    return function reg(elementClass: any) {
        elementClass.prototype[getInjectSymbol()] = args;
    };
}
