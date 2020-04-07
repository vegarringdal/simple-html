import { validateKey, stateContainer, stateResult } from '@simple-html/core';

//key and validate key, so we know we dont have duplicates
const STATE_KEY = 'USER_FORM_PROFILE';
validateKey(STATE_KEY);

export type userFormStateType = { firstName: string; lastName: string; email: string };

export function userFormState(
    defaultValue: userFormStateType = {} as userFormStateType
): stateResult<userFormStateType> {
    return stateContainer<userFormStateType>(STATE_KEY, defaultValue);
}
