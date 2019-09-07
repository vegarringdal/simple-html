import { ApiService } from './apiservice';
import { JwtService } from './jwtservice';
import { SharedState } from '../state/sharedstate';
import { instance } from '@simple-html/core';

export class UserService {
    public apiService: ApiService;
    public jwtService: JwtService;
    public sharedState: SharedState;

    constructor() {
        this.jwtService = instance(JwtService);
        this.sharedState = instance(SharedState);
        this.apiService = instance(ApiService);
    }

    // Verify JWT in localstorage with server & load user's info.
    // This runs once on application startup.
    public async populate() {
        if (this.jwtService.getToken()) {
            const data = await this.apiService.get('/user');
            this.setAuth(data.user);
        } else {
            // Remove any potential remnants of previous auth states
            this.purgeAuth();
        }
    }

    public setAuth(user: any) {
        // Save JWT sent from server in localstorage
        this.jwtService.saveToken(user.token);
        this.sharedState.saveState(user);
        this.sharedState.setState();
    }

    public purgeAuth() {
        // Remove JWT from localstorage
        this.jwtService.destroyToken();
        this.sharedState.resetState();
    }

    public async attemptAuth(type: any, credentials: any) {
        const route = type === 'Login' ? '/login' : '';
        const data = await this.apiService.post('/users' + route, { user: credentials });
        this.setAuth(data.user);

        return data;
    }

    public async update(user: any) {
        const data = await this.apiService.put('/user', { user });
        this.sharedState.currentUser = data.user;
        this.setAuth(data.user); //hmm, I dont get newest data ?

        return data.user;
    }
}
