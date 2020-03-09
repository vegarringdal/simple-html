export const gotoURL = function (path: string, params: any = {}, query: any = null) {
    const urls = path.split('/').filter(x => (x ? true : false));
    let newUrl = '';
    urls.forEach((val, i) => {
        if (val[0] === ':' && params[val.substr(1, val.length)] !== undefined) {
            newUrl = newUrl + params[val.substr(1, val.length)];
        }
        else {
            newUrl = newUrl + `${val}`;
        }
        if (urls.length - 1 !== i) {
            newUrl = newUrl + `/`;
        }
    });
    let urlparams;
    if (query) {
        urlparams = new URLSearchParams();
        for (const k in params) {
            if (params[k]) {
                urlparams.append(k, params[k]);
            }
        }
        location.hash = `${newUrl}?${urlparams}`;
    }
    else {
        location.hash = newUrl;
    }
};
