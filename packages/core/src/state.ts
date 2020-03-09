import { publish } from '.';

const state = (window as any).state || {};
const keys = new Set();
type valueSetter = (value: any) => void;

if(!(window as any).state){
  window.addEventListener("hmr", () => {
    (window as any).state = state;
    console.log("current state", (window as any).state);
  });
}


export type stateResult<T> = [T, valueSetter];

export function stateContainer<T>(
  key: string,
  defaultValue: T,
  customPublishedTrigger?: boolean
): stateResult<T> {

  //set default value if not set
  if (!state.hasOwnProperty(key)) {
    state[key] = defaultValue;
  }


  const currentState = state[key];
  const setter = function(value: T) {
    state[key] = value;
  };

  const middleware = function(value: any) {
    setter(value);
    publish(key, value);
  };


  return [currentState, customPublishedTrigger ? setter: middleware];
}

export function validateKey(key: string) {
  if (keys.has(key)) {
    throw new Error(`state key used allready, use another name`);
  } else {
    keys.add(key);
    return key;
  }
}
