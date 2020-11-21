import { disconnectedCallback, publish, subscribe, unSubscribe } from '.';

let state = (window as any).state || {};
const keys = new Set();
type valueSetter<T> = (value: T) => void;

// helper for fusebox hmr event
if (!(window as any).state) {
    window.addEventListener('HMR-FUSEBOX', () => {
        (window as any).state = state;
        console.log('HMR-FUSEBOX', (window as any).state);
    });
}

export type stateResult<T> = [T, valueSetter<T>];

/**
 * Get current glabal state
 * great for saving state for next time user opens website
 */
export function getState() {
    state;
}

/**
 * overide current state
 * great for restoring state time user opens website
 */
export function setState<T>(newState: T) {
    state = newState;
}

export function assignState<T, K extends keyof T>(obj: T, part: Pick<T, K>) {
    return Object.assign(obj, part);
}

/**
 * simple state container
 * @param key key used in state container and event
 * @param defaultValue default state value
 * @param customPublishedTrigger if you do not want it to publish update event
 */
export function stateContainer<T>(
    key: string,
    defaultValue: T,
    customPublishedTrigger?: boolean
): stateResult<T> {
    //set default value if not set
    if (!state.hasOwnProperty(key)) {
        state[key] = defaultValue;
    }

    const currentState: T = state[key];
    const setter = function (value: T) {
        state[key] = value;
    };

    const middleware = function (value: any) {
        setter(value);
        publish(key, value);
    };

    return [currentState, customPublishedTrigger ? setter : middleware];
}

/**
 * simple warning if you reuse a key by accident
 * @param key
 */
export function validateKey(key: string) {
    if (keys.has(key)) {
        throw new Error(`state key used allready, use another name`);
    } else {
        keys.add(key);
        return key;
    }
}

export class State<T> {
    stateKey: string;
    defaultValue: T;
    constructor(STATE_KEY: string, defaultValue: T) {
        this.stateKey = STATE_KEY;
        this.defaultValue = defaultValue;
        validateKey(this.stateKey);
    }

    get(defaultState?: T): stateResult<T> {
        if (defaultState) {
            this.defaultValue = defaultState;
        }
        return stateContainer<T>(this.stateKey, this.defaultValue);
    }

    connect(context: HTMLElement, callback: () => void): void {
        // this register callback with simpleHtml elements disconnected callback
        disconnectedCallback(context, () => unSubscribe(this.stateKey, context));

        // for following the event we just use the internal event handler
        subscribe(this.stateKey, context, callback);
    }
}
