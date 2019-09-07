import { getInjectSymbol } from './symbols';

// singleton helper
let instanceMap = new Map();
export const instance = <T>(_class: { new (...args: any): T }): T => {
    if (instanceMap.has(_class)) {
        return instanceMap.get(_class);
    } else {
        const getinjectIT = (args: any): any[] => {
            const classes: any[] = [];
            if (Array.isArray(args)) {
                args.forEach(element => {
                    classes.push(instance(element));
                });
            }
            return classes;
        };
        const newclass = new _class(...getinjectIT(_class.prototype[getInjectSymbol()]));
        instanceMap.set(_class, newclass);
        return newclass;
    }
};

// helper for hmr
export function clearInstance(instance: any) {
    if (instanceMap.has(instance)) {
        instanceMap.delete(instance);
    } else {
        instanceMap = new Map();
    }
}
