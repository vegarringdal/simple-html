export function getUrlVars(string: string) {
    const vars = {};
    // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
    //@ts-ignore
    string.replace(/[?&]+([^=&]+)=([^&]*)/gi, (_m, key, value) => {
        vars[key] = value;
    });
    return vars;
}
