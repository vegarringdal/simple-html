import { ApiService } from './apiservice';
import { instance } from '@simple-html/core';

export class CommentService {
    public apiService: ApiService;
    constructor() {
        this.apiService = instance(ApiService);
    }

    public async add(slug: any, payload: any) {
        const data: any = await this.apiService.post(`/articles/${slug}/comments`, {
            comment: { body: payload }
        });

        return data.comment;
    }

    public async getList(slug: any) {
        const data: any = await this.apiService.get(`/articles/${slug}/comments`);

        return data.comments;
    }

    public async destroy(commentId: any, articleSlug: any) {
        const data: any = await this.apiService.delete(
            `/articles/${articleSlug}/comments/${commentId}`
        );

        return data;
    }
}
