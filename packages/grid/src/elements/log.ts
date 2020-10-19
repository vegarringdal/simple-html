const logger = false;

// helper to see if we have events going in circles
export function log(element: any, e: any) {
    if (logger) console.log('logger:', element?.nodeName, e?.type);
}
