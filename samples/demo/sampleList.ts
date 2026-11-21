import type { DemoSample } from './demoUtils';
import { aggregates } from './samples/aggregates';
import aggregatesSource from './samples/aggregates.ts?raw';
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
import { exportCsv } from './samples/export';
import exportCsvSource from './samples/export.ts?raw';
import { filtering } from './samples/filtering';
import filteringSource from './samples/filtering.ts?raw';
import { filterOperatorHeader } from './samples/filterOperatorHeader';
import filterOperatorHeaderSource from './samples/filterOperatorHeader.ts?raw';
import { find } from './samples/find';
import findSource from './samples/find.ts?raw';
import { formatters } from './samples/formatters';
import formattersSource from './samples/formatters.ts?raw';
import { gridState } from './samples/gridState';
import gridStateSource from './samples/gridState.ts?raw';
import { liveData } from './samples/liveData';
import liveDataSource from './samples/liveData.ts?raw';
import { lookups } from './samples/lookups';
import lookupsSource from './samples/lookups.ts?raw';
import { miscConfig } from './samples/miscConfig';
import miscConfigSource from './samples/miscConfig.ts?raw';
import { multiline } from './samples/multiline';
import multilineSource from './samples/multiline.ts?raw';
import { ranges } from './samples/ranges';
import rangesSource from './samples/ranges.ts?raw';
import { requiredPlaceholders } from './samples/requiredPlaceholders';
import requiredPlaceholdersSource from './samples/requiredPlaceholders.ts?raw';
import { rowsData } from './samples/rowsData';
import rowsDataSource from './samples/rowsData.ts?raw';
import { saving } from './samples/saving';
import savingSource from './samples/saving.ts?raw';
import { selection } from './samples/selection';
import selectionSource from './samples/selection.ts?raw';
import { sortingGrouping } from './samples/sortingGrouping';
import sortingGroupingSource from './samples/sortingGrouping.ts?raw';
import { theming } from './samples/theming';
import themingSource from './samples/theming.ts?raw';
import { tooltips } from './samples/tooltips';
import tooltipsSource from './samples/tooltips.ts?raw';
import { translation } from './samples/translation';
import translationSource from './samples/translation.ts?raw';
import { validation } from './samples/validation';
import validationSource from './samples/validation.ts?raw';

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
    { ...aggregates, source: aggregatesSource },
    { ...filtering, source: filteringSource },
    { ...find, source: findSource },
    { ...selection, source: selectionSource },
    { ...rowsData, source: rowsDataSource },
    // editing
    { ...editing, source: editingSource },
    { ...saving, source: savingSource },
    { ...validation, source: validationSource },
    { ...multiline, source: multilineSource },
    { ...ranges, source: rangesSource },
    { ...contextMenu, source: contextMenuSource },
    { ...lookups, source: lookupsSource },
    { ...dropdownGrid, source: dropdownGridSource },
    // cells
    { ...dynamicCellTypes, source: dynamicCellTypesSource },
    { ...requiredPlaceholders, source: requiredPlaceholdersSource },
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
    { ...translation, source: translationSource },
    { ...theming, source: themingSource },
    { ...miscConfig, source: miscConfigSource },
    // export
    { ...exportCsv, source: exportCsvSource },
    // live data
    { ...liveData, source: liveDataSource }
];
