export function initSymbolCache() {
    if (!(globalThis as any)._STD_SYMBOL) {
        (globalThis as any)._STD_SYMBOL = {
            observedAttributesMap: Symbol('observedAttributesMap'),
            observedAttributes: Symbol('observedAttributes'),
            updateCallbackCallers: Symbol('updateCallbackCallers'),
            disconnectCallbackCaller: Symbol('disconnectCallbackCaller'),
            constructorDone: Symbol('constructorDone'),
            transmitter: Symbol('transmitter')
        };
        (globalThis as any)._PROP_SYMBOL = {};
    }
}

function stdSymbol() {
    return (globalThis as any)._STD_SYMBOL;
}

function propSymbol() {
    return (globalThis as any)._PROP_SYMBOL;
}

export function getObservedAttributesMapSymbol(): 'getObservedAttributesMapSymbol' {
    return stdSymbol().observedAttributesMap;
}

export function getObservedAttributesSymbol(): 'getObservedAttributesSymbol' {
    return stdSymbol().observedAttributes;
}

export function getUpdateCallbackCallersSymbol(): 'getUpdateCallbackCallersSymbol' {
    return stdSymbol().updateCallbackCallers;
}

export function getDisconnectCallbackCallerSymbol(): 'getDisconnectCallbackCallerSymbol' {
    return stdSymbol().disconnectCallbackCaller;
}

export function getConstructorDoneSymbol(): 'getConstructorDoneSymbol' {
    return stdSymbol().constructorDone;
}
export function getTransmitterSymbol(): 'getTransmitterSymbol' {
    return stdSymbol().transmitter;
}

export function getPropSymbol(name: string) {
    if (!propSymbol()[name]) {
        propSymbol()[name] = Symbol(name);
        return propSymbol()[name];
    } else {
        return propSymbol()[name];
    }
}

initSymbolCache();
