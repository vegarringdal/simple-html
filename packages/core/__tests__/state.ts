/* eslint-disable @typescript-eslint/no-unused-vars */
import {
    stateContainer,
    stateResult,
    disconnectedCallback,
    validateKey,
    unSubscribe,
    subscribe,
    customElement
} from '../src';

/**
 * key and validate key, so we know we dont have duplicates
 */
export const STATE_KEY = 'TEST_STATE';
validateKey(STATE_KEY);

/**
 * connect state
 */
export function connectToState(context: HTMLElement, callback: Function): void {
    // this register callback with simpleHtml elements disconnected callback
    disconnectedCallback(context, () => unSubscribe(STATE_KEY, context));

    // for following the event we just use the internal event handler
    subscribe(STATE_KEY, context, callback);
}

/**
 * function to get state/state setter
 */
export type state = string;
export function viewState(defaultValue = '' as state): stateResult<state> {
    return stateContainer<state>(STATE_KEY, defaultValue);
}

describe('state', () => {
    it('simple state', (done) => {
        @customElement('app-root1')
        class Ele extends HTMLElement {
            connectedCallback() {
                connectToState(this, this.render);
            }

            render() {
                const [currentState] = viewState('works');

                return 'render.' + currentState;
            }
        }

        // add custom element
        document.body.innerHTML = '<app-root1 id="my-element"></app-root1>';

        requestAnimationFrame(() => {
            const node = document.getElementById('my-element');

            const [_currentState, setCurrent] = viewState('works');
            expect(_currentState).toEqual('works');
            setCurrent('new');
            setTimeout(() => {
                expect(node.textContent).toEqual('render.new');
                done();
            }, 50);
        });
    });
});
