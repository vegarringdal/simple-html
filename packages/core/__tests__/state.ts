/* eslint-disable @typescript-eslint/no-unused-vars */
import { State } from '../src';

/**
 * simple state
 */
export const STATE_KEY1 = 'TEST_STATE';
export type state1 = number | undefined;
export const simpleState = new State<state1>(STATE_KEY1, null);

/**
 * simple state
 */
export const STATE_KEY2 = 'TEST_STATE2';
export type state2 = { name: string };
export const objectState = new State<state2>(STATE_KEY2, null, true);

describe('state', () => {
    it('simple state', () => {
        const key = simpleState.getStateKey();
        expect(key).toEqual(STATE_KEY1);
        const [state1, setter1] = simpleState.getState();
        expect(state1).toEqual(null);
        setter1(1);
        const state2 = simpleState.getStateValue();
        expect(state2).toEqual(1);
    });

    it('object state', () => {
        const key = objectState.getStateKey();
        expect(key).toEqual(STATE_KEY2);
        const [state3, setter3] = objectState.getStateObject();
        expect(state3).toEqual({});
        setter3({ name: 'cool' });
        const state4 = objectState.getObjectValue();
        expect(state4).toEqual({ name: 'cool' });
    });
});
