import { Datasource, Entity } from '@simple-html/datasource';
import { getCellHeight } from './getCellHeight';
import { Grid } from './grid';
import { GridConfig } from './gridConfig';

/**
 * grid interface is what user have access to controll grid behavior
 */
export class GridInterface {
    private grid: Grid;
    private gridConfig: GridConfig;
    private dataSource: Datasource<any>;
    // for variable scroll
    private scrollTops: number[];
    private scrollHeights: number[];
    private scrollHeight: number;

    constructor(gridConfig: GridConfig, datasource: Datasource) {
        this.gridConfig = gridConfig;
        this.dataSource = datasource;
        this.parseConfig();
        // TODO: append sorting to datasource if any

        // TODO: append grouping to datasource if any

        // TODO: also run grouping/sorting ?

        this.dataSourceUpdated();
    }

    public parseConfig() {
        if (!this.gridConfig.attributes) {
            this.gridConfig.attributes = {};
        }

        if (!Array.isArray(this.gridConfig.columnsPinnedLeft)) {
            this.gridConfig.columnsPinnedLeft = [];
        }
        if (!Array.isArray(this.gridConfig.columnsPinnedRight)) {
            this.gridConfig.columnsPinnedRight = [];
        }
        if (!Array.isArray(this.gridConfig.columnsPinnedLeft)) {
            this.gridConfig.columnsCenter = [];
        }
        /**
         * height
         */
        let cells = getCellHeight(this.gridConfig.columnsPinnedLeft, 1);
        cells = getCellHeight(this.gridConfig.columnsPinnedRight, cells);
        cells = getCellHeight(this.gridConfig.columnsCenter, cells);

        this.gridConfig.__rowHeight = cells * this.gridConfig.cellHeight;
        this.gridConfig.__columnCells = cells;

        this.gridConfig.columnsPinnedLeft = this.gridConfig.columnsPinnedLeft.filter((e) => e.rows?.length);
        this.gridConfig.columnsPinnedRight = this.gridConfig.columnsPinnedRight.filter((e) => e.rows?.length);
        this.gridConfig.columnsCenter = this.gridConfig.columnsCenter.filter((e) => e.rows?.length);

        /**
         * widths pinned
         */
        this.gridConfig.__leftWidth =
            this.gridConfig.columnsPinnedLeft?.map((col) => col.width || 100).reduce((value, curvalue) => value + curvalue, 0) ||
            0;

        this.gridConfig.__rightWidth =
            this.gridConfig.columnsPinnedRight?.map((col) => col.width || 100).reduce((value, curvalue) => value + curvalue, 0) ||
            0;

        this.gridConfig.__scrollbarSize = 10;

        if (this.gridConfig.selectSizeHeight === undefined) {
            this.gridConfig.selectSizeHeight = this.gridConfig.cellHeight;
        }

        this.gridConfig.__selectSizeWidth = Math.floor(
            this.grid?.getTextWidth(this.dataSource.getRows().length.toString()) || 10
        );
        if (this.gridConfig.__selectSizeWidth < 25) {
            this.gridConfig.__selectSizeWidth = 25;
        }

        this.gridConfig.columnsPinnedLeft.forEach((e) => {
            if (Array.isArray(e.rows)) {
                e.rows.forEach((att) => {
                    if (!this.gridConfig.attributes[att]) {
                        this.gridConfig.attributes[att] = { attribute: att };
                    }
                });
            }
        });
        this.gridConfig.columnsPinnedRight.forEach((e) => {
            if (Array.isArray(e.rows)) {
                e.rows.forEach((att) => {
                    if (!this.gridConfig.attributes[att]) {
                        this.gridConfig.attributes[att] = { attribute: att };
                    }
                });
            }
        });
        this.gridConfig.columnsCenter.forEach((e) => {
            if (Array.isArray(e.rows)) {
                e.rows.forEach((att) => {
                    if (!this.gridConfig.attributes[att]) {
                        this.gridConfig.attributes[att] = { attribute: att };
                    }
                });
            }
        });

        console.log(this.gridConfig.__selectSizeWidth);
    }

    /**
     * do not use - used by grid to connect
     * @param grid
     */
    connectGrid(grid: Grid) {
        this.grid = grid;
        this.dataSource.addEventListener(this);
    }

    /**
     * current Gridconfig, so not use this for saving
     * @returns
     */
    getGridConfig() {
        return this.gridConfig;
    }

    /**
     * when you need to save a copy
     */
    saveGridConfig(): GridConfig {
        // TODO: get sorting and add it
        // TODO: get grouping and add it

        return structuredClone(this.gridConfig);
    }

    /**
     * when you need load
     */
    loadGridConfig(newConfig: GridConfig) {
        this.gridConfig = structuredClone(newConfig);
        // TODO: set sorting if it has it
        // TODO: set grouping if it has it
    }

    /**
     * current datasource
     * @returns
     */
    getDatasource() {
        return this.dataSource;
    }

    /**
     * do not use - used by grid to disconnect
     * @returns
     */
    disconnectGrid() {
        this.dataSource.removeEventListener(this);
        this.grid = null;
    }

    /**
     * if its connected to grid or not
     * @returns
     */
    isConnected(): boolean {
        return this.grid ? true : false;
    }

    /**
     * will update scroll tops/heights
     */
    public dataSourceUpdated() {
        this.parseConfig();
        this.scrollTops = [];
        this.scrollHeights = [];
        this.scrollHeight = 0;

        // lets make a index if datasource is > 1000k, and store top for each k

        const cell = this.gridConfig.cellHeight;
        const row = this.gridConfig.__rowHeight;
        let count = 0;

        this.dataSource.getRows().forEach((ent: Entity) => {
            const height = ent.__group ? cell : row;
            this.scrollTops.push(count);
            this.scrollHeights.push(height);
            count = count + height;
        });

        this.scrollHeight = count;
        if (this.grid && this.grid.getElement()) {
            this.grid.updateVerticalScrollHeight(this.scrollHeight);
        }
    }

    /**
     * scroll state have all row height and top values
     * this is used during a scroll event to move rows into right height
     * @returns
     */
    public getScrollState() {
        return {
            scrollHeight: this.scrollHeight,
            scrollHeights: this.scrollHeights,
            scrollTops: this.scrollTops
        };
    }

    /**
     * do not use - used to handle event from datasource
     */
    handleEvent(e: any) {
        switch (true) {
            case e.type === 'collection-filtered' && e.data?.info === 'filter':
                console.log('handleEvent:', e.type, e.data);
                this.grid.rebuild(false);
                break;
            case e.type === 'collection-sorted':
            case e.type === 'collection-grouped':
            case e.type === 'collection-expand':
            case e.type === 'collection-collapse':
            case e.type === 'collection-changed':
                console.log('handleEvent:', e.type, e.data);
                this.grid.rebuild();

                break;
            case e.type === 'curreent-Entity':
            case e.type === 'selectionChange':
                console.log('handleEvent:', e.type, e.data);
                this.dataSourceUpdated();
                this.grid.triggerScrollEvent();
                break;
            default:
                console.log('skipping:', e.type, e.data);
        }

        return true; // to hold active
    }
}
