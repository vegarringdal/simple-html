export class JwtService {
    public getToken() {
        return window.localStorage['jwtToken'];
    }

    public saveToken(token: any) {
        window.localStorage['jwtToken'] = token;
    }

    public destroyToken() {
        window.localStorage.removeItem('jwtToken');
    }
}
