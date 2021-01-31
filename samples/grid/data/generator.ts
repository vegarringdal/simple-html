
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
                x['word' + y] = y + ':' + this.totalGenerated;
            }

            dummyArray.push(x);
        }

        return dummyArray;
    }
}
