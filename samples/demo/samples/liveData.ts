// datasource.upsert(rows) merges rows from a server by key: values change in the cells on their own, and
// an edit the user has not saved is never overwritten - it is a conflict, resolved with resolveConflict()
import { type Changes, type Conflict, createGrid, Datasource, type GridConfig } from '@simple-html/grid';
import { createStage, type DemoSample } from '../demoUtils';

interface Stock {
    id: number;
    name: string;
    price: number;
    stock: number;
}

/**
 * The server: its own rows, which change every second. It hands out copies - a row upsert() adds
 * becomes a row of the grid, the user's edits must not change the server's rows
 */
class FakeServer {
    private rows = new Map<number, Stock>();
    private nextId = 1;

    constructor() {
        for (let i = 0; i < 40; i++) {
            this.add();
        }
    }

    /** every row, as a full poll gets them */
    all(): Stock[] {
        return Array.from(this.rows.values(), (row) => ({ ...row }));
    }

    /**
     * One second on the server: the prices of the first three rows change (edit one of them to see a
     * conflict) and a few others, and with `comeAndGo` now and then a row is added and one removed
     * @returns the rows that changed, the fields that changed only - what a push sends
     */
    tick(comeAndGo: boolean): Partial<Stock>[] {
        const changed: Partial<Stock>[] = [];
        const ids = Array.from(this.rows.keys());
        const picked = new Set([
            ...ids.slice(0, 3),
            ...Array.from({ length: 4 }, () => ids[Math.floor(Math.random() * ids.length)])
        ]);
        for (const id of picked) {
            const row = this.rows.get(id) as Stock;
            row.price = Math.round(row.price * (0.95 + Math.random() * 0.1) * 100) / 100;
            if (Math.random() < 0.3) {
                row.stock = Math.max(0, row.stock + Math.floor(Math.random() * 21) - 10);
                changed.push({ id, price: row.price, stock: row.stock });
            } else {
                changed.push({ id, price: row.price });
            }
        }
        if (comeAndGo && Math.random() < 0.3) {
            changed.push({ ...this.add() });
            // not one of the first rows: they are the ones to edit
            const gone = ids[3 + Math.floor(Math.random() * (ids.length - 3))];
            this.rows.delete(gone);
        }
        return changed;
    }

    /** a save: the server takes the user's changes */
    save(changes: Changes<Stock>) {
        for (const row of changes.modifiedEntities) {
            const saved = row.id === undefined ? undefined : this.rows.get(row.id);
            if (saved) {
                Object.assign(saved, row);
            }
        }
        for (const row of changes.deletedEntities) {
            this.rows.delete(row.id);
        }
    }

    private add(): Stock {
        const id = this.nextId++;
        const row = {
            id,
            name: `Stock ${id}`,
            price: Math.round((10 + Math.random() * 90) * 100) / 100,
            stock: Math.floor(Math.random() * 100)
        };
        this.rows.set(id, row);
        return row;
    }
}

/** the flash of a cell an upsert changed: an animation that runs once, when the class is added */
const FLASH_STYLE = `
@keyframes demo-live-flash { from { background: #ffe58a; } to { background: transparent; } }
.demo-live-flash { animation: demo-live-flash 1s ease-out; }
`;

export const liveData: DemoSample = {
    id: 'live-data',
    title: 'Live data',
    group: 'Live data',
    description:
        'A fake server changes prices every second, and datasource.upsert() merges its rows by key: the cells show the new values on their own, no refresh(). The cells a merge changed flash (getMergedAt() in a cellClass hook). Edit the price of one of the first three rows: the next merge does not overwrite it - your value stays, the server\'s is its original now, and it is a conflict. "Keep mine" and "Take server\'s" resolve the conflicts. "Full poll" sends every row with removeMissing: rows come and go, but a row you changed is kept, in conflict. Type in a cell while the timer runs: what you type stays.',
    run(stage) {
        const ui = createStage(stage);
        const style = document.createElement('style');
        style.textContent = FLASH_STYLE;
        stage.appendChild(style);

        const server = new FakeServer();
        const config: GridConfig = {
            readonly: false,
            columns: { id: { readonly: true } },
            layout: {
                center: [
                    { fields: ['id'], width: 60 },
                    { fields: ['name'], width: 160 },
                    { fields: ['price'], width: 100 },
                    { fields: ['stock'], width: 100 }
                ]
            }
        };
        const datasource = new Datasource<Stock>({ key: 'id', fields: { id: 'number', price: 'number', stock: 'number' } });
        datasource.setData(server.all());
        createGrid(ui.gridHost, {
            config,
            datasource,
            hooks: {
                // the cells an upsert changed in the last second
                cellClass: (row, field) => {
                    const at = datasource.getMergedAt(row, field);
                    return at !== undefined && Date.now() - at < 1000 ? { input: 'demo-live-flash' } : null;
                }
            }
        });

        // the last merge and the conflicts, above the grid
        const panel = document.createElement('pre');
        panel.className = 'demo-log';
        panel.style.margin = '0 0 10px';
        panel.style.height = '120px';
        stage.insertBefore(panel, ui.gridHost);
        let lastMerge = '';
        const describeConflict = (conflict: Conflict<Stock>) =>
            conflict.field === null
                ? `row ${conflict.row.id}: removed on the server, it has changes here`
                : `row ${conflict.row.id} ${conflict.field}: yours ${conflict.local}, the server's ${conflict.remote} (was ${conflict.original})`;
        const showPanel = () => {
            const conflicts = datasource.getConflicts();
            panel.textContent = [lastMerge, `${conflicts.length} conflict(s)`, ...conflicts.map(describeConflict)].join('\n');
        };
        datasource.on('conflicts-changed', showPanel);

        let fullPoll = false;
        let running = true;
        const timer = setInterval(() => {
            // the sample's page was left
            if (!stage.isConnected) {
                clearInterval(timer);
                return;
            }
            if (!running) {
                return;
            }
            // a push sends what changed; a full poll every row, and the rows not sent are gone there
            const changes = server.tick(fullPoll);
            const result = fullPoll ? datasource.upsert(server.all(), { removeMissing: true }) : datasource.upsert(changes);
            lastMerge = `${fullPoll ? 'full poll' : 'push'}: ${result.updated.length} updated, ${result.added.length} added, ${result.removed.length} removed`;
            showPanel();
        }, 1000);

        const pauseButton = ui.button('Pause', () => {
            running = !running;
            pauseButton.textContent = running ? 'Pause' : 'Resume';
        });
        const pollButton = ui.button('Push changes (use full poll)', () => {
            fullPoll = !fullPoll;
            pollButton.textContent = fullPoll ? 'Full poll, removeMissing (use push)' : 'Push changes (use full poll)';
        });
        ui.button('Keep mine', () => {
            for (const conflict of datasource.getConflicts()) {
                datasource.resolveConflict(conflict.row, conflict.field, 'local');
            }
        });
        ui.button("Take server's", () => {
            for (const conflict of datasource.getConflicts()) {
                datasource.resolveConflict(conflict.row, conflict.field, 'remote');
            }
        });
        ui.button('Save', () => {
            // the server takes the changes, they are no changes here any more
            server.save(datasource.getChanges());
            datasource.acceptChanges();
        });
        ui.button('Reset changes', () => {
            datasource.resetData();
        });

        showPanel();
    }
};
