/**
 * check if sting starts with : and does not contain more then 1
 */
export function isVariable(path: string): boolean {
    if (path && typeof path === 'string' && path[0] === ':') {
        return true;
    } else {
        return false;
    }
}
