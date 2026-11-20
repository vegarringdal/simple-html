import type { DemoSample } from './demoUtils';
import { basicGrid } from './samples/basicGrid';
import basicGridSource from './samples/basicGrid.ts?raw';
import { cellStyling } from './samples/cellStyling';
import cellStylingSource from './samples/cellStyling.ts?raw';
import { columnLayout } from './samples/columnLayout';
import columnLayoutSource from './samples/columnLayout.ts?raw';
import { contextMenu } from './samples/contextMenu';
import contextMenuSource from './samples/contextMenu.ts?raw';
import { customFormatter } from './samples/customFormatter';
import customFormatterSource from './samples/customFormatter.ts?raw';
import { dropdownGrid } from './samples/dropdownGrid';
import dropdownGridSource from './samples/dropdownGrid.ts?raw';
import { dynamicCellTypes } from './samples/dynamicCellTypes';
import dynamicCellTypesSource from './samples/dynamicCellTypes.ts?raw';
import { editing } from './samples/editing';
import editingSource from './samples/editing.ts?raw';
import { events } from './samples/events';
import eventsSource from './samples/events.ts?raw';
import { filtering } from './samples/filtering';
import filteringSource from './samples/filtering.ts?raw';
import { filterOperatorHeader } from './samples/filterOperatorHeader';
import filterOperatorHeaderSource from './samples/filterOperatorHeader.ts?raw';
import { formatters } from './samples/formatters';
import formattersSource from './samples/formatters.ts?raw';
import { gridState } from './samples/gridState';
import gridStateSource from './samples/gridState.ts?raw';
import { mandatoryPlaceholders } from './samples/mandatoryPlaceholders';
import mandatoryPlaceholdersSource from './samples/mandatoryPlaceholders.ts?raw';
import { miscConfig } from './samples/miscConfig';
import miscConfigSource from './samples/miscConfig.ts?raw';
import { rowsData } from './samples/rowsData';
import rowsDataSource from './samples/rowsData.ts?raw';
import { selection } from './samples/selection';
import selectionSource from './samples/selection.ts?raw';
import { sortingGrouping } from './samples/sortingGrouping';
import sortingGroupingSource from './samples/sortingGrouping.ts?raw';
import { tooltips } from './samples/tooltips';
import tooltipsSource from './samples/tooltips.ts?raw';

/**
 * a sample and the text of its file: the source the site shows with the running sample
 */
export interface Sample extends DemoSample {
    source: string;
}

/**
 * order here = order in the sidebar, samples with the same group are
 * rendered under one group header
 */
export const SAMPLES: Sample[] = [
    // getting started
    { ...basicGrid, source: basicGridSource },
    { ...columnLayout, source: columnLayoutSource },
    // datasource
    { ...sortingGrouping, source: sortingGroupingSource },
    { ...filtering, source: filteringSource },
    { ...selection, source: selectionSource },
    { ...rowsData, source: rowsDataSource },
    // editing
    { ...editing, source: editingSource },
    { ...contextMenu, source: contextMenuSource },
    { ...dropdownGrid, source: dropdownGridSource },
    // cells
    { ...dynamicCellTypes, source: dynamicCellTypesSource },
    { ...mandatoryPlaceholders, source: mandatoryPlaceholdersSource },
    // formatting
    { ...formatters, source: formattersSource },
    { ...customFormatter, source: customFormatterSource },
    { ...cellStyling, source: cellStylingSource },
    // events
    { ...events, source: eventsSource },
    { ...filterOperatorHeader, source: filterOperatorHeaderSource },
    // config
    { ...gridState, source: gridStateSource },
    { ...tooltips, source: tooltipsSource },
    { ...miscConfig, source: miscConfigSource }
];
