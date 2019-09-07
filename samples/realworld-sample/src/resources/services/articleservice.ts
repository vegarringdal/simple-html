import { ApiService } from './apiservice';
import { instance } from '@simple-html/core';

export class ArticleService {
    apiService: any;

    constructor() {
        this.apiService = instance(ApiService);
    }

    public async getList(type: any, params: any) {
        const data = await this.apiService.get(
            '/articles' + (type === 'feed' ? '/feed' : ''),
            params
        );

        return data;
    }

    public async get(slug: any) {
        const data = await this.apiService.get('/articles/' + slug);

        return data.article;
    }

    public async destroy(slug: any) {
        const result = await this.apiService.delete('/articles/' + slug);

        return result;
    }

    public async save(article: any) {
        if (article.slug) {
            // If we're updating an existing article
            const data = await this.apiService.put('/articles/' + article.slug, {
                article: article
            });

            return data.article;
        } else {
            // Otherwise, create a new article
            const data = await this.apiService.post('/articles/', { article: article });

            return data.article;
        }
    }

    public async favorite(slug: any) {
        const result = await this.apiService.post('/articles/' + slug + '/favorite');

        return result;
    }

    public async unfavorite(slug: any) {
        const result = await this.apiService.delete('/articles/' + slug + '/favorite');

        return result;
    }
}
