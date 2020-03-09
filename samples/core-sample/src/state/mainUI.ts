import { subscribe, unSubscribe } from "@simple-html/core";
import { validateKey, stateContainer, stateResult } from "@simple-html/core";

//key and validate key, so we know we dont have duplicates
const STATE_KEY = "MAIN_UI";
validateKey(STATE_KEY);

export function mainUIStateSubscribe(context: any, callback: Function): void {
  subscribe(STATE_KEY, context, callback);
}

export function mainUIStateUnsubscribe(context: any): void {
  unSubscribe(STATE_KEY, context);
}

export type mainUIStateType = {show_dialog:string, loading:string}

export function mainUIState(defaultValue: mainUIStateType = {} as mainUIStateType): stateResult<mainUIStateType> {
  return stateContainer<mainUIStateType>(STATE_KEY, defaultValue);
}
