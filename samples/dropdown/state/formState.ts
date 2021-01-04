import { ObjectState } from '@simple-html/core';

export type state = { defaultVal1: string; defaultVal2: string };

export const formState = new ObjectState<state>('FORM_STATE', {} as state);
