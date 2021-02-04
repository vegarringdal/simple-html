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
                        if (y === 2) {
                            new Date().toLocaleString(undefined, {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric'
                            });
                            // @ts-ignore
                            x['date'] = new Date(`1/${parseInt(Math.random() * 5)}/2020`);
                        } else {
                            if (y === 3) {
                                // @ts-ignore
                                x['bool'] = parseInt(Math.random() * 10) > 5 ? true : false;
                            } else {
                                // @ts-ignore
                                x['word' + y] = parseInt(Math.random() * 100);
                            }
                        }
                        // @ts-ignore
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
