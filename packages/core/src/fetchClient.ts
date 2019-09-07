// helper for fetch
export class FetchClient {
    constructor(private config = {} as IFetchConfig) {
        this.setConfig(config);
    }

    public setConfig(config: IFetchConfig) {
        if (config.defaultUrl) {
            this.config.defaultUrl = config.defaultUrl;
        }

        if (config.cache) {
            this.config.cache = config.cache;
        }

        if (config.credentials) {
            this.config.credentials = config.credentials;
        }

        if (config.headers) {
            this.config.headers = config.headers;
        }

        if (config.method) {
            this.config.method = config.method;
        }

        if (config.mode) {
            this.config.mode = config.mode;
        }

        if (config.redirect) {
            this.config.redirect = config.redirect;
        }

        if (config.referrer) {
            this.config.referrer = config.referrer;
        }
    }

    public getConfig() {
        return this.config;
    }

    public fetch(url: string, options: IFetchConfig): Promise<any> {
        const fetchUrl = this.config.defaultUrl ? this.config.defaultUrl + url : url;
        const fetchOptions: any = {
            body: options.body ? options.body : undefined,
            cache: options.cache || this.config.cache,
            credentials: options.credentials || this.config.credentials,
            headers: options.headers || this.config.headers,
            method: options.method || this.config.method,
            mode: options.mode || this.config.mode,
            redirect: options.redirect || this.config.redirect,
            referrer: options.referrer || this.config.referrer
        };

        return fetch(fetchUrl, fetchOptions as any);
    }
}

export interface IFetchConfig {
    // default url to use
    defaultUrl?: string;

    // data formsdata, json/string
    body?: any;

    // 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
    cache?: string;

    // 'same-origin', // include, same-origin, *omit
    credentials?: string;

    // {
    //  'user-agent': 'Mozilla/4.0 MDN Example',
    //  'content-type': 'application/json'
    // },
    headers?: Object;

    // 'POST', // *GET, POST, PUT, DELETE, etc.
    method?: string;

    // 'cors', // no-cors, cors, *same-origin
    mode?: string;

    // 'follow', // manual, *follow, error
    redirect?: string;

    // 'no-referrer', // *client, no-referrer
    referrer?: string;
}
