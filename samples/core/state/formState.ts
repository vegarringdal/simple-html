import { ObjectState } from '@simple-html/core';

export type state = { firstName: string; lastName: string };

export const formState = new ObjectState<state>('FORM_STATE', {} as state);
