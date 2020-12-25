import { disconnectedCallback, publish, subscribe, unSubscribe } from './index';

const state = (window as any).state || {};
const keys = new Set();

export const GLOBAL_STATE_EVENT = 'GLOBAL_STATE_EVENT';

// helper for fusebox hmr event
if (!(window as any).state) {
    (window as any).state = {};
    window.addEventListener('SIMPLE_HTML_SAVE_STATE', () => {
        (window as any).state = state;
        console.log('SIMPLE_HTML_HMR', (window as any).state);
    });
}

/**
 * Types only
 */
type valueSetter<T> = (value: T) => void;
export type stateResult<T> = [T, valueSetter<T>];
export type stateResultObj<T> = [T, <K extends keyof T>(part: Pick<T, K>) => void];

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
    private mainStateKey: string;
    private forceObject: boolean;
    internalStateKey: string;

    /**
     * Simple global state container
     * @param STATE_KEY
     * @param defaultValue
     * @param forceObject
     * @param internalStateKey if you use internal store then it wont be verified if you override old keys
     */
    constructor(
        STATE_KEY: string,
        defaultValue: T = null,
        forceObject = false,
        internalStateKey: string = null
    ) {
        this.mainStateKey = STATE_KEY;
        if (internalStateKey) {
            // set main state
            if (!this.getStateContainer().hasOwnProperty(this.mainStateKey)) {
                this.getStateContainer()[this.mainStateKey] = {};
            }

            // set internal state
            this.internalStateKey = internalStateKey;
            if (!this.getStateContainer().hasOwnProperty(this.internalStateKey)) {
                if (typeof defaultValue === 'object' && defaultValue !== null) {
                    this.getStateContainer()[this.internalStateKey] = defaultValue;
                } else {
                    this.getStateContainer()[this.internalStateKey] = {};
                }
            }
        } else {
            if (!this.getStateContainer().hasOwnProperty(this.mainStateKey)) {
                this.getStateContainer()[this.mainStateKey] = defaultValue;
            }

            this.forceObject = forceObject;
            if (!this.getStateContainer()[this.mainStateKey] && this.forceObject) {
                this.getStateContainer()[this.mainStateKey] = {};
            }

            validateKey(this.mainStateKey);
        }
    }

    getStateContainer() {
        if (this.internalStateKey) {
            return state[this.mainStateKey];
        }
        return state;
    }

    reset(val: any = null) {
        if (this.forceObject) {
            throw 'this is object only state, use resetObj';
        }
        this.getStateContainer()[this.getStateKey()] = val;
    }

    resetObj(val = {}) {
        this.getStateContainer()[this.getStateKey()] = val;
    }

    /**
     * Return key of this state
     */
    getStateKey() {
        return this.internalStateKey || this.mainStateKey;
    }

    /**
     * return state [value, setter]
     */
    getState(): stateResult<T> {
        if (this.forceObject) {
            throw 'this is object only state, use getObjectValue';
        }

        const STATE_KEY = this.getStateKey();
        const STATE = this.getStateContainer();

        const setAndPublish = function (value: any) {
            STATE[STATE_KEY] = value;
            publish(GLOBAL_STATE_EVENT, state);
            publish(STATE_KEY, value);
        };

        return [STATE[STATE_KEY], setAndPublish];
    }

    /**
     * just return simple value
     */
    getStateValue(): T {
        if (this.forceObject) {
            throw 'this is object only state, use getObject';
        }

        return this.getStateContainer()[this.getStateKey()];
    }

    /**
     * return state [value, setter]
     * this uses built in object.assign in setter
     */
    getStateObject(): stateResultObj<T> {
        const STATE_KEY = this.getStateKey();
        const STATE = this.getStateContainer();

        function assignState<T, K extends keyof T>(obj: T, part: Pick<T, K>) {
            return Object.assign(obj, part);
        }

        function assignAndPublish<K extends keyof T>(part: Pick<T, K>): void {
            STATE[STATE_KEY] = assignState(STATE[STATE_KEY] as T, part);
            publish(GLOBAL_STATE_EVENT, state);
            publish(STATE_KEY, STATE[STATE_KEY]);
        }

        return [STATE[STATE_KEY], assignAndPublish];
    }

    /**
     * just return simple value, of object
     */
    getObjectValue(): T {
        return this.getStateContainer()[this.getStateKey()];
    }

    /**
     * connect to state in elements connectedcallback, will automatically disconnect if dicconnectedcallback is called
     * @param context
     * @param callback
     */
    connectStateChanges(context: HTMLElement, callback: () => void): void {
        // this register callback with simpleHtml elements disconnected callback
        disconnectedCallback(context, () => unSubscribe(this.getStateKey(), context));

        // for following the event we just use the internal event handler
        subscribe(this.getStateKey(), context, callback);
    }
}
