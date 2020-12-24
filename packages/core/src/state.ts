import { disconnectedCallback, publish, subscribe, unSubscribe } from '.';

let state = (window as any).state || {};
const keys = new Set();

// helper for fusebox hmr event
if (!(window as any).state) {
    window.addEventListener('HMR-FUSEBOX', () => {
        console.warn('please publish: SIMPLE_HTML_SAVE_STATE as event, will remove HMR-FUSEBOX');
        (window as any).state = state;
        console.log('HMR-FUSEBOX', (window as any).state);
    });

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
    private stateKey: string;
    private forceObject: boolean;

    constructor(STATE_KEY: string, defaultValue?: T, forceObject = false) {
        this.stateKey = STATE_KEY;
        if (!state.hasOwnProperty(this.stateKey)) {
            state[this.stateKey] = defaultValue;
        }

        this.forceObject = forceObject;
        if (!state[this.stateKey] && this.forceObject) {
            state[this.stateKey] = {};
        }

        validateKey(this.stateKey);
    }

    reset(val: any = null) {
        if (this.forceObject) {
            throw 'this is object only state, use resetObj';
        }
        state[this.stateKey] = val;
    }

    resetObj(val = {}) {
        state[this.stateKey] = val;
    }

    /**
     * Return key of this state
     */
    getStateKey() {
        return this.stateKey;
    }

    /**
     * return state [value, setter]
     */
    getState(): stateResult<T> {
        if (this.forceObject) {
            throw 'this is object only state, use getObjectValue';
        }

        const STATE_KEY = this.stateKey;

        const setAndPublish = function (value: any) {
            state[STATE_KEY] = value;
            publish(STATE_KEY, value);
        };

        return [state[STATE_KEY], setAndPublish];
    }

    /**
     * just return simple value
     */
    getStateValue(): T {
        if (this.forceObject) {
            throw 'this is object only state, use getObject';
        }

        return state[this.stateKey];
    }

    /**
     * return state [value, setter]
     * this uses built in object.assign in setter
     */
    getStateObject(): stateResultObj<T> {
        const STATE = this.stateKey;

        function assignState<T, K extends keyof T>(obj: T, part: Pick<T, K>) {
            return Object.assign(obj, part);
        }

        function assignAndPublish<K extends keyof T>(part: Pick<T, K>): void {
            state[STATE] = assignState(state[STATE] as T, part);
            publish(STATE, state[STATE]);
        }

        return [state[STATE], assignAndPublish];
    }

    /**
     * just return simple value, of object
     */
    getObjectValue(): T {
        return state[this.stateKey];
    }

    /**
     * connect to state in elements connectedcallback, will automatically disconnect if dicconnectedcallback is called
     * @param context
     * @param callback
     */
    connectStateChanges(context: HTMLElement, callback: () => void): void {
        // this register callback with simpleHtml elements disconnected callback
        disconnectedCallback(context, () => unSubscribe(this.stateKey, context));

        // for following the event we just use the internal event handler
        subscribe(this.stateKey, context, callback);
    }
}
