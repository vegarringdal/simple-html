export function initSymbolCache() {
    if (!(globalThis as any)._LHF_SYMBOL) {
        (globalThis as any)._LHF_SYMBOL = {};
        (globalThis as any)._LHF_PROP_SYMBOL = {};
    }
}

export function getObservedAttributesMapSymbol() {
    if (!(globalThis as any)._LHF_SYMBOL.observedAttributesMap) {
        (globalThis as any)._LHF_SYMBOL.observedAttributesMap = Symbol('observedAttributesMap');
        return (globalThis as any)._LHF_SYMBOL.observedAttributesMap;
    } else {
        return (globalThis as any)._LHF_SYMBOL.observedAttributesMap;
    }
}

export function getObservedAttributesSymbol() {
    if (!(globalThis as any)._LHF_SYMBOL.observedAttributes) {
        (globalThis as any)._LHF_SYMBOL.observedAttributes = Symbol('observedAttributes');
        return (globalThis as any)._LHF_SYMBOL.observedAttributes;
    } else {
        return (globalThis as any)._LHF_SYMBOL.observedAttributes;
    }
}

export function getPropSymbol(name: string) {
    if (!(globalThis as any)._LHF_PROP_SYMBOL[name]) {
        (globalThis as any)._LHF_PROP_SYMBOL[name] = Symbol(name);
        return (globalThis as any)._LHF_PROP_SYMBOL[name];
    } else {
        return (globalThis as any)._LHF_PROP_SYMBOL[name];
    }
}

export function getTransmitterSymbol() {
    if (!(globalThis as any)._LHF_SYMBOL.transmitter) {
        (globalThis as any)._LHF_SYMBOL.transmitter = Symbol('transmitter');
        return (globalThis as any)._LHF_SYMBOL.transmitter;
    } else {
        return (globalThis as any)._LHF_SYMBOL.transmitter;
    }
}

initSymbolCache();
