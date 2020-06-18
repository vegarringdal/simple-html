import { publish } from '.';

let state = (window as any).state || {};
const keys = new Set();
type valueSetter = (value: any) => void;

// helper for fusebox hmr event
if (!(window as any).state) {
    window.addEventListener('HMR-FUSEBOX', () => {
        (window as any).state = state;
        console.log('HMR-FUSEBOX', (window as any).state);
    });
}

export type stateResult<T> = [T, valueSetter];

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
export function setState(newState: any) {
    state = newState;
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
