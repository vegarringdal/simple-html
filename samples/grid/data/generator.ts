/* eslint-disable @typescript-eslint/ban-ts-comment */
export class Generator {
    public rowTop: number;
    private totalGenerated: number;
    constructor() {
        this.totalGenerated = 0;
    }

    public reset(): void {
        this.totalGenerated = 0;
    }

    public generateData(no: any): any {
        const dummyArray = [];
        for (let i = 0; i < no; i++) {
            this.totalGenerated++;
            // up count
            const x = {};
            x['index'] = this.totalGenerated;

            for (let y = 1; y < 300; y++) {
                if (y < 10) {
                    if (y < 5) {
                        // @ts-ignore
                        x['word' + y] = 'person' + parseInt(Math.random() * 100);
                    } else {
                        // @ts-ignore
                        x['word' + y] = 'person' + parseInt(Math.random() * 5);
                    }
                } else {
                    x['word' + y] = y + ':' + this.totalGenerated;
                }
            }

            dummyArray.push(x);
        }

        return dummyArray;
    }
}
