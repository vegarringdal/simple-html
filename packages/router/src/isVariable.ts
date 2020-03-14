export function isVariable(path: string): boolean {
    if (path && typeof path === 'string' && path[0] === ':') {
        if (path.split(':').length > 2) {
            console.error(`route argument contains illigal string: ${path}, please fix`);
        }
        return true;
    }
    else {
        return false;
    }
}
