export function getUrlVars(string: string) {
    const vars = {};
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    //@ts-ignore
    string.replace(/[?&]+([^=&]+)=([^&]*)/gi, (_m, key, value) => {
        vars[key] = value;
    });
    return vars;
}
