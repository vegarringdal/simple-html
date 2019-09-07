import { ApiService } from './apiservice';
import { instance } from '@simple-html/core';

export class TagService {
    public apiService: ApiService;
    constructor() {
        this.apiService = instance(ApiService);
    }

    public async getList() {
        const data = await this.apiService.get('/tags');

        return data.tags;
    }
}
