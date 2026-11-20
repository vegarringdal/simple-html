import type { DemoSample } from './demoUtils';
import { basicGrid } from './samples/basicGrid';
import { cellStyling } from './samples/cellStyling';
import { columnLayout } from './samples/columnLayout';
import { contextMenu } from './samples/contextMenu';
import { customFormatter } from './samples/customFormatter';
import { dropdownGrid } from './samples/dropdownGrid';
import { dynamicCellTypes } from './samples/dynamicCellTypes';
import { editing } from './samples/editing';
import { events } from './samples/events';
import { filtering } from './samples/filtering';
import { filterOperatorHeader } from './samples/filterOperatorHeader';
import { formatters } from './samples/formatters';
import { mandatoryPlaceholders } from './samples/mandatoryPlaceholders';
import { miscConfig } from './samples/miscConfig';
import { rowsData } from './samples/rowsData';
import { saveLoadConfig } from './samples/saveLoadConfig';
import { selection } from './samples/selection';
import { sortingGrouping } from './samples/sortingGrouping';
import { tooltips } from './samples/tooltips';

/**
 * order here = order in the sidebar, samples with the same group are
 * rendered under one group header
 */
export const SAMPLES: DemoSample[] = [
    // getting started
    basicGrid,
    columnLayout,
    // datasource
    sortingGrouping,
    filtering,
    selection,
    rowsData,
    // editing
    editing,
    contextMenu,
    dropdownGrid,
    // cells
    dynamicCellTypes,
    mandatoryPlaceholders,
    // formatting
    formatters,
    customFormatter,
    cellStyling,
    // events
    events,
    filterOperatorHeader,
    // config
    saveLoadConfig,
    tooltips,
    miscConfig
];
