import { config } from './config';

import { JwtService } from './jwtservice';
import { status, parseError } from './servicehelper';
import { instance, FetchClient } from '@simple-html/core';
import { urlqueryStringify } from '../queryStringify';

export class ApiService {
    public http: FetchClient;
    public jwtService: JwtService;

    constructor() {
        this.jwtService = instance(JwtService);
        this.http = new FetchClient();
    }

    public setHeaders() {
        const headersConfig = {
            'Content-Type': 'application/json',
            Accept: 'application/json'
        };

        if (this.jwtService.getToken()) {
            headersConfig['Authorization'] = `Token ${this.jwtService.getToken()}`;
        }

        return new Headers(headersConfig);
    }

    public async get(path: any, params?: any): Promise<any> {
        const options = {
            method: 'GET',
            headers: this.setHeaders()
        };

        try {
            const result = await this.http.fetch(
                `${config.api_url}${path}?${urlqueryStringify(params)}`,
                options
            );

            return status(result);
        } catch (e) {
            return parseError(e);
        }
    }

    public async put(path: any, body = {}): Promise<any> {
        const options = {
            method: 'PUT',
            headers: this.setHeaders(),
            body: JSON.stringify(body)
        };

        try {
            const result = await this.http.fetch(`${config.api_url}${path}`, options);

            return status(result);
        } catch (e) {
            return await parseError(e);
        }
    }

    public async post(path: any, body = {}): Promise<any> {
        const options = {
            method: 'POST',
            headers: this.setHeaders(),
            body: JSON.stringify(body)
        };

        try {
            const result = await this.http.fetch(`${config.api_url}${path}`, options);

            return status(result);
        } catch (e) {
            return await parseError(e);
        }
    }

    public async delete(path: any): Promise<any> {
        const options = {
            method: 'DELETE',
            headers: this.setHeaders()
        };

        try {
            const result = await this.http.fetch(`${config.api_url}${path}`, options);

            return status(result);
        } catch (e) {
            return await parseError(e);
        }
    }
}
