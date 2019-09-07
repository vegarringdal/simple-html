import { ApiService } from './apiservice';
import { instance } from '@simple-html/core';

export class ProfileService {
    public apiService: ApiService;
    constructor() {
        this.apiService = instance(ApiService);
    }

    public async get(username: string) {
        const data = await this.apiService.get('/profiles/' + username);

        return data.profile;
    }

    public async follow(username: string) {
        const result = await this.apiService.post('/profiles/' + username + '/follow');

        return result;
    }

    public async unfollow(username: string) {
        const result = await this.apiService.delete('/profiles/' + username + '/follow');

        return result;
    }
}
