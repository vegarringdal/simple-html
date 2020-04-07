export const gotoURL = function (path: string, params: any = {}, query: any = null) {
    if (path[0] === '#') {
        path = path.substr(1, path.length);
    }

    const urls = path.split('/').filter((x) => (x ? true : false));
    let newUrl = '';
    urls.forEach((val, i) => {
        if (val[0] === ':' && params[val.substr(1, val.length)] !== undefined) {
            newUrl = newUrl + params[val.substr(1, val.length)];
        } else {
            newUrl = newUrl + `${val}`;
        }
        if (urls.length - 1 !== i) {
            newUrl = newUrl + `/`;
        }
    });

    // make sure we have the #
    newUrl = newUrl[0] === '#' ? newUrl : `#${newUrl}`;

    let urlparams;
    if (query) {
        urlparams = new URLSearchParams();
        for (const k in query) {
            if (query[k]) {
                urlparams.append(k, query[k]);
            }
        }
        location.hash = `${newUrl}?${urlparams.toString()}`;
    } else {
        location.hash = newUrl;
    }
};
