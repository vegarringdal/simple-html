import type { Entity } from '../../datasource/entity';
import type { Grid } from '../grid';

/**
 * Undo and redo from the keyboard, in a body cell of an editable grid: Ctrl+Z (Cmd+Z) undoes,
 * Ctrl+Y, Ctrl+Shift+Z (Cmd+Shift+Z) redo - `datasource.undo()` / `redo()`.
 *
 * While the user types in the cell the keys are the input's own: the grid writes every keystroke to
 * the row, and what was typed since the cell got the focus is one step of the history (see
 * History.typing). As long as that step is the cell's, the browser undoes the typing in the input -
 * its input event writes the value back, into the same step - and once the cell is back at the value
 * it started from (the step is dropped) the keys go to the history. When the history has nothing to
 * undo or redo the key is left to the browser too.
 *
 * Called by the cell inputs' keydown before the key navigation. The header filters and the filter
 * editor do not call it.
 *
 * @param row the row of the cell
 * @param field the field of the cell
 * @returns true when the history did it: the key's default (the browser's own undo) is prevented
 */
export function undoRedoKey(ctx: Grid, event: KeyboardEvent, row: Entity, field: string): boolean {
    const action = undoRedoAction(event);
    if (!action || ctx.gridInterface.__getGridConfig().readonly) {
        return false;
    }

    const datasource = ctx.gridInterface.getDatasource();
    if (datasource.getDataContainer().__history.isTyping(row, field)) {
        return false;
    }

    // the grid renders the cells again on the history-changed event it sends
    const done = action === 'undo' ? datasource.undo() : datasource.redo();
    if (done) {
        event.preventDefault();
    }
    return done;
}

/** the letter of the keys undo and redo use, by where they are on a US keyboard */
const LETTER_OF_CODE: Readonly<Record<string, string>> = { KeyZ: 'z', KeyY: 'y' };

/**
 * the action of a key: Ctrl or Cmd with Z undoes, with Shift+Z or Y redoes. Not with Alt (AltGr is
 * Ctrl+Alt on Windows, it types characters). The letter is the one the layout gives (`key`), the key
 * where it is on a US keyboard (`code`) when the layout gives no latin letter - a Russian layout, say
 */
function undoRedoAction(event: KeyboardEvent): 'undo' | 'redo' | null {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) {
        return null;
    }
    const key = /^[a-z]$/i.test(event.key) ? event.key.toLowerCase() : LETTER_OF_CODE[event.code];
    if (key === 'z') {
        return event.shiftKey ? 'redo' : 'undo';
    }
    if (key === 'y' && !event.shiftKey) {
        return 'redo';
    }
    return null;
}
