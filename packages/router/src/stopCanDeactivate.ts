import { canDeactivateCallers } from './canDeactivateCallers';
export const stopCanDeactivate = function (promise: Promise<Boolean>) {
    canDeactivateCallers.push(promise);
};
