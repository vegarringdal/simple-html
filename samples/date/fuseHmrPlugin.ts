import { HMRHelper, HMRPayload } from 'fuse-box/types/hmr';
export default function (_payload: HMRPayload, helper: HMRHelper) {
    window.dispatchEvent(new CustomEvent('SIMPLE_HTML_SAVE_STATE'));
    helper.flushAll();
    helper.updateModules();
    helper.callEntries();
}
