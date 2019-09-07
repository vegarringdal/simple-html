export function status(response: any) {
    if (response.status >= 200 && response.status < 400) {
        return response.json();
    }

    throw response;
}

export function parseError(error: any) {
    if (!(error instanceof Error)) {
        return new Promise((_resolve, reject) => reject(error.json()));
    } else {
        return Promise.resolve(null);
    }
}
