import { State } from '@simple-html/core';

export type state = { firstName: string; lastName: string };

export const formState = new State<state>('FORM_STATE', {} as state);
