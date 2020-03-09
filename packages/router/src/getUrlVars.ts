export function getUrlVars(string: string) {
    let vars = {};
    //@ts-ignore
    string.replace(/[?&]+([^=&]+)=([^&]*)/gi, (_m, key, value) => {
        vars[key] = value;
    });
    return vars;
}
