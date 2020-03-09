export let canDeactivateCallers: any[] = [];

export const canDeactivate = async function() {
    canDeactivateCallers = [];
    window.dispatchEvent(new CustomEvent('canDeactivate'));
    let result = true;
    for (let i = 0; i < canDeactivateCallers.length; i++) {
        let y = await Promise.resolve(canDeactivateCallers[i]);
        if (y === false) {
            result = y;
        }
    }
    return result;
};


