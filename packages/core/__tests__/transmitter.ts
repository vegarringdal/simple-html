import { subscribe, publish, publishSync, publishNext, unSubscribe } from '../src';

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

        setTimeout(() => {
            expect(calls).toEqual('one');
            done();
        }, 50);
    });

    it('publishSync with unsubscribe', (done) => {
        let call1 = '';
        let call2 = '';

        const ctx1 = {};
        const ctx2 = {};

        subscribe('caller', ctx1, (e: any) => {
            call1 = e;
        });

        subscribe('caller', ctx2, (e: any) => {
            call2 = e;
        });

        publishSync('caller', '1');
        expect(call1).toEqual('1');
        expect(call2).toEqual('1');
        publishSync('caller', '2');
        expect(call1).toEqual('2');
        expect(call2).toEqual('2');

        unSubscribe('caller', ctx1);
        publishSync('caller', '3');
        expect(call1).toEqual('2');
        expect(call2).toEqual('3');

        unSubscribe('caller', ctx2);
        publishSync('caller', '3');
        expect(call1).toEqual('2');
        expect(call2).toEqual('3');

        done();
    });
});
