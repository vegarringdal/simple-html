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


export function getPropSymbol(name: string) {
    if (!(<any>globalThis)._LHF_PROP_SYMBOL[name]) {
        (<any>globalThis)._LHF_PROP_SYMBOL[name] = Symbol(name);
        return (<any>globalThis)._LHF_PROP_SYMBOL[name];
    } else {
        return (<any>globalThis)._LHF_PROP_SYMBOL[name];
    }
}


export function getLoggerSymbol() {
    if (!(<any>globalThis)._LHF_SYMBOL.logger) {
        (<any>globalThis)._LHF_SYMBOL.logger = Symbol('logger');
        return (<any>globalThis)._LHF_SYMBOL.logger;
    } else {
        return (<any>globalThis)._LHF_SYMBOL.logger;
    }
}

export function getLoggerCountSymbol() {
    if (!(<any>globalThis)._LHF_SYMBOL.loggerCount) {
        (<any>globalThis)._LHF_SYMBOL.loggerCount = Symbol('loggerCount');
        return (<any>globalThis)._LHF_SYMBOL.loggerCount;
    } else {
        return (<any>globalThis)._LHF_SYMBOL.loggerCount;
    }
}


export function getTransmitterSymbol() {
    if (!(<any>globalThis)._LHF_SYMBOL.transmitter) {
        (<any>globalThis)._LHF_SYMBOL.transmitter = Symbol('transmitter');
        return (<any>globalThis)._LHF_SYMBOL.transmitter;
    } else {
        return (<any>globalThis)._LHF_SYMBOL.transmitter;
    }
}

initSymbolCache();
