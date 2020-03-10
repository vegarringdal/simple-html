export function initSymbolCache() {
    if (!(<any>globalThis)._LHF_SYMBOL) {
        (<any>globalThis)._LHF_SYMBOL = {};
        (<any>globalThis)._LHF_PROP_SYMBOL = {};
    }
}

export function getObservedAttributesMapSymbol() {
    if (!(<any>globalThis)._LHF_SYMBOL.observedAttributesMap) {
        (<any>globalThis)._LHF_SYMBOL.observedAttributesMap = Symbol('observedAttributesMap');
        return (<any>globalThis)._LHF_SYMBOL.observedAttributesMap;
    } else {
        return (<any>globalThis)._LHF_SYMBOL.observedAttributesMap;
    }
}

export function getObservedAttributesSymbol() {
    if (!(<any>globalThis)._LHF_SYMBOL.observedAttributes) {
        (<any>globalThis)._LHF_SYMBOL.observedAttributes = Symbol('observedAttributes');
        return (<any>globalThis)._LHF_SYMBOL.observedAttributes;
    } else {
        return (<any>globalThis)._LHF_SYMBOL.observedAttributes;
    }
}

export function getInjectSymbol() {
    if (!(<any>globalThis)._LHF_SYMBOL.inject) {
        (<any>globalThis)._LHF_SYMBOL.inject = Symbol('inject');
        return (<any>globalThis)._LHF_SYMBOL.inject;
    } else {
        return (<any>globalThis)._LHF_SYMBOL.inject;
    }
}

export function getPropSymbol(name: string) {
    if (!(<any>globalThis)._LHF_PROP_SYMBOL[name]) {
        (<any>globalThis)._LHF_PROP_SYMBOL[name] = Symbol(name);
        return (<any>globalThis)._LHF_PROP_SYMBOL[name];
    } else {
        return (<any>globalThis)._LHF_PROP_SYMBOL[name];
    }
}

export function getiInjectSymbol() {
    if (!(<any>globalThis)._LHF_SYMBOL.inject) {
        (<any>globalThis)._LHF_SYMBOL.inject = Symbol('inject');
        return (<any>globalThis)._LHF_SYMBOL.inject;
    } else {
        return (<any>globalThis)._LHF_SYMBOL.inject;
    }
}


export function getCustomSymbol(customSymbol: string) {
    if (!(<any>globalThis)._LHF_SYMBOL.inject) {
        (<any>globalThis)._LHF_SYMBOL.inject = Symbol(customSymbol);
        return (<any>globalThis)._LHF_SYMBOL.inject;
    } else {
        return (<any>globalThis)._LHF_SYMBOL.inject;
    }
}

initSymbolCache();
