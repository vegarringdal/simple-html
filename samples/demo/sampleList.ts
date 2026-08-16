import type { DemoSample } from './demoUtils';
import { basicGrid } from './samples/basicGrid';
import { cellStyling } from './samples/cellStyling';
import { columnLayout } from './samples/columnLayout';
import { contextMenu } from './samples/contextMenu';
import { datepicker } from './samples/datepicker';
import { dropdownGrid } from './samples/dropdownGrid';
import { editing } from './samples/editing';
import { events } from './samples/events';
import { filtering } from './samples/filtering';
import { formatters } from './samples/formatters';
import { rowsData } from './samples/rowsData';
import { saveLoadConfig } from './samples/saveLoadConfig';
import { selection } from './samples/selection';
import { sortingGrouping } from './samples/sortingGrouping';

/**
 * order here = order in the sidebar, samples with the same group are
 * rendered under one group header
 */
export const SAMPLES: DemoSample[] = [
    basicGrid,
    columnLayout,
    sortingGrouping,
    filtering,
    selection,
    rowsData,
    editing,
    contextMenu,
    dropdownGrid,
    formatters,
    cellStyling,
    events,
    saveLoadConfig,
    datepicker
];
