import { subscribe, publish, publishSync, publishNext } from '../src';

describe('transmitter', () => {
    it('publish', (done) => {
        let calls = '';

        subscribe('call1', this, (e: any) => {
            calls = e;
        });

        publish('call1', 'two');
        publish('call1', 'one');
        expect(calls).toEqual('');
        setImmediate(() => {
            expect(calls).toEqual('one');
            publish('call1', 'two');
            expect(calls).toEqual('one');
            setImmediate(() => {
                expect(calls).toEqual('two');
                done();
            });
        });
    });

    it('publishSync', (done) => {
        let calls = '';

        subscribe('call1', this, (e: any) => {
            calls = e;
        });

        publishSync('call1', 'two');
        expect(calls).toEqual('two');
        publishSync('call1', 'one');
        expect(calls).toEqual('one');

        setImmediate(() => {
            expect(calls).toEqual('one');
            publishSync('call1', 'two');
            expect(calls).toEqual('two');
            setImmediate(() => {
                expect(calls).toEqual('two');
                done();
            });
        });
    });

    it('publishNext', (done) => {
        let calls = '';

        subscribe('call1', this, (e: any) => {
            calls = e;
        });

        publishNext('call1', 'two');
        expect(calls).toEqual('');
        publishNext('call1', 'one');
        expect(calls).toEqual('');

        setImmediate(() => {
            expect(calls).toEqual('');
            setTimeout(() => {
                expect(calls).toEqual('one');
                done();
            });
        });
    });
});
