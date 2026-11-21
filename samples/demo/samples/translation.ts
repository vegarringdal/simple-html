import { and, setTexts, type TextId, where } from '@simple-html/grid';
import { baseFields, baseGridConfig, createStage, type DemoSample, mountGrid } from '../demoUtils';

/**
 * Norwegian (bokmål) for every text of the grid and the datasource. Typed Record<TextId, string>, the
 * compiler names an id that is missing - Texts would take a part of them. Plain JSON: it can come from
 * a backend
 */
const norwegian: Record<TextId, string> = {
    // the row menu
    'row.copy': 'Kopier',
    'row.copy.cell': 'Celleverdi',
    'row.copy.column': 'Kolonne',
    'row.copy.column.hint': 'valgte rader',
    'row.copy.row': 'Rad',
    'row.copy.row.hint': 'valgte rader',
    'row.copy.selectedColumns': 'Rad',
    'row.copy.selectedColumns.hint': 'valgte rader/kol',
    'row.copy.range': 'Område',
    'row.filter': 'Filter',
    'row.filter.replace': 'Erstatt filter',
    'row.filter.replace.hint': 'alle',
    'row.filter.add': 'Legg til i filter',
    'row.filter.add.hint': 'og',
    'row.view': 'Visning',
    'row.view.dimRepeatedValues': 'Demp gjentatte verdier',
    'row.view.changedOnly': 'Bare endrede rader',
    'row.paste': 'Lim inn',
    'row.paste.cell': 'Lim inn celle',
    'row.paste.cell.hint': 'valgte rader',
    'row.paste.range': 'Lim inn område',
    'row.clear': 'Tøm',
    'row.clear.cell': 'Tøm celle',
    'row.clear.cell.hint': 'valgte rader',
    'row.clear.range': 'Tøm område',
    'row.delete': 'Slett',
    'row.delete.rows': 'Rader',
    'row.delete.rows.hint': 'valgte rader',
    'row.delete.undo': 'Angre',
    'row.delete.undo.hint': 'valgte rader',
    'row.edit.undo': 'Angre siste endring',
    'row.edit.undo.hint': 'Ctrl+Z',
    'row.edit.redo': 'Gjør om',
    'row.edit.redo.hint': 'Ctrl+Y',
    'row.edit.revertCell': 'Angre endring i cellen',
    'row.edit.revertRow': 'Angre endringer i raden',
    'row.edit.revertRows': 'Angre endringer i radene',
    'row.edit.revertRows.hint': 'valgte rader',
    'row.size': 'Størrelse',
    'row.size.fitColumn': 'Tilpass kolonnen til cellen',
    'row.size.fitRow': 'Tilpass radhøyden',
    'row.size.fitRows': 'Tilpass radhøyden',
    'row.size.fitRows.hint': 'valgte rader',
    'row.size.fitAllRows': 'Tilpass alle rader',
    'row.size.resetRow': 'Tilbakestill radhøyden',
    'row.size.resetAllRows': 'Tilbakestill alle radhøyder',
    'row.export': 'Eksport',
    'row.export.excel': 'Excel, alle rader',
    'row.export.excelSelected': 'Excel, valgte rader',

    // the header menu
    'header.column.pin': 'Fest',
    'header.column.pinLeft': 'Fest til venstre',
    'header.column.pinLeftCopy': 'Fest til venstre (kopi)',
    'header.column.pinRight': 'Fest til høyre',
    'header.column.pinRightCopy': 'Fest til høyre (kopi)',
    'header.column.unpin': 'Løsne',
    'header.column.hide': 'Skjul kolonne',
    'header.column.removeSorting': 'Fjern sortering',
    'header.column.chooser': 'Velg kolonner…',
    'header.size': 'Størrelse',
    'header.size.column': 'Tilpass kolonnebredden',
    'header.size.all': 'Tilpass alle kolonner',
    'header.size.resetColumn': 'Tilbakestill kolonnebredden',
    'header.size.resetAll': 'Tilbakestill alle kolonnebredder',
    'header.aggregate': 'Aggregat',
    'header.aggregate.sum': 'Sum',
    'header.aggregate.avg': 'Gjennomsnitt',
    'header.aggregate.min': 'Min',
    'header.aggregate.max': 'Maks',
    'header.aggregate.count': 'Antall',
    'header.aggregate.totalsRow': 'Totalrad',
    'header.grouping': 'Gruppering',
    'header.grouping.expandAll': 'Utvid alle',
    'header.grouping.collapseAll': 'Slå sammen alle',
    'header.grouping.clear': 'Fjern alle',

    // the filter menu and its value list
    'filter.filter.clear': 'Fjern filter',
    'filter.filter.clearAll': 'Fjern alle filtre',
    'filter.filter.blank': 'Tom',
    'filter.filter.isBlank': 'Er tom',
    'filter.filter.isNotBlank': 'Er ikke tom',
    'filter.filter.advanced': 'Avansert filter…',
    'filter.operator': 'Operator',
    'filter.operator.greaterThanOrEqualTo': 'Større enn eller lik',
    'filter.operator.lessThanOrEqualTo': 'Mindre enn eller lik',
    'filter.operator.equal': 'Lik',
    'filter.operator.notEqualTo': 'Ikke lik',
    'filter.operator.contains': 'Inneholder',
    'filter.values.search': 'Søk:',
    'filter.values.searchPlaceholder': 'skriv for å søke',
    'filter.values.availableOnly': 'Bare tilgjengelige',
    'filter.values.rowsFound': '{count} rader funnet',
    'filter.values.truncated': 'Viser bare de første {max}!',
    'filter.values.selectAll': 'Velg alle',
    'filter.values.blank': 'Tom',
    'filter.values.run': 'Søk',

    // the column chooser
    'columnChooser.title': 'Alle felt:',
    'columnChooser.search': 'søk',
    'columnChooser.close': 'Lukk',

    // the filter editor
    'filterEditor.title': 'Filterredigering',
    'filterEditor.title.tooltip': 'Dra for å flytte vinduet',
    'filterEditor.close.tooltip': 'Lukk uten å filtrere',
    'filterEditor.operatorAnd': 'OG',
    'filterEditor.operatorAnd.tooltip': 'Alle betingelsene i gruppen må stemme. Klikk for ELLER',
    'filterEditor.operatorOr': 'ELLER',
    'filterEditor.operatorOr.tooltip': 'En av betingelsene i gruppen må stemme. Klikk for OG',
    'filterEditor.wrapGroup.tooltip': 'Legg alt i gruppen inn i en ny gruppe',
    'filterEditor.addSubGroup.tooltip': 'Legg til en undergruppe i gruppen',
    'filterEditor.addCondition.tooltip': 'Legg til en betingelse i gruppen',
    'filterEditor.deleteGroup.tooltip': 'Slett gruppen og alt i den',
    'filterEditor.clearAll.tooltip': 'Fjern alle betingelser',
    'filterEditor.label.field': 'Felt:',
    'filterEditor.label.operator': 'Operator:',
    'filterEditor.label.value': 'Verdi:',
    'filterEditor.pickAttribute': 'Klikk for å velge felt',
    'filterEditor.pickAttribute.tooltip': 'Velg hvilken kolonne betingelsen ser på',
    'filterEditor.pickOperator': 'Klikk for å velge operator',
    'filterEditor.pickOperator.tooltip': 'Velg hvordan verdien sammenlignes, for eksempel lik eller større enn',
    'filterEditor.pickValueAttribute': 'Klikk for å velge felt',
    'filterEditor.pickValueAttribute.tooltip': 'Velg hvilken kolonne det sammenlignes med',
    'filterEditor.deleteCondition.tooltip': 'Slett betingelsen',
    'filterEditor.useValue.tooltip': 'Sammenlign med en verdi i stedet for en annen kolonne',
    'filterEditor.useAttribute.tooltip': 'Sammenlign med en annen kolonne i stedet for en verdi',
    'filterEditor.filterAndClose': 'Filtrer og lukk',
    'filterEditor.filterAndClose.tooltip': 'Bruk filteret og lukk vinduet',
    'filterEditor.filterOnly': 'Bare filtrer',
    'filterEditor.filterOnly.tooltip': 'Bruk filteret, men la vinduet stå åpent så du kan justere det videre',
    'filterEditor.closeButton': 'Lukk',
    'filterEditor.closeButton.tooltip': 'Lukk vinduet og behold filteret som det er',
    'filterEditor.fieldMenu': 'Tilgjengelige felt:',
    'filterEditor.fieldMenu.search': 'søk',
    'filterEditor.operatorMenu': 'Operator:',
    'filterEditor.operator.EQUAL': 'Lik',
    'filterEditor.operator.LESS_THAN_OR_EQUAL_TO': 'Mindre enn eller lik',
    'filterEditor.operator.GREATER_THAN_OR_EQUAL_TO': 'Større enn eller lik',
    'filterEditor.operator.LESS_THAN': 'Mindre enn',
    'filterEditor.operator.GREATER_THAN': 'Større enn',
    'filterEditor.operator.CONTAINS': 'Inneholder',
    'filterEditor.operator.NOT_EQUAL_TO': 'Ikke lik',
    'filterEditor.operator.DOES_NOT_CONTAIN': 'Inneholder ikke',
    'filterEditor.operator.BEGIN_WITH': 'Begynner med',
    'filterEditor.operator.END_WITH': 'Slutter med',
    'filterEditor.operator.IN': 'I listen',
    'filterEditor.operator.NOT_IN': 'Ikke i listen',
    'filterEditor.operator.IS_BLANK': 'Er tom',
    'filterEditor.operator.IS_NOT_BLANK': 'Er ikke tom',

    // the footer
    'footer.rowCount': '{shown} av {total}',
    'footer.clear': '✕ Fjern',
    'footer.clear.tooltip': 'Fjern filteret',
    'footer.filter.tooltip': 'Rediger filteret',
    'footer.collapsed.one': '{count} filter — klikk for å redigere',
    'footer.collapsed.other': '{count} filtre — klikk for å redigere',
    'footer.and': 'OG',
    'footer.or': 'ELLER',
    'footer.changedOnly': 'Bare endrede rader',
    'footer.summary': 'Valgte celler',
    'footer.summary.count': 'Antall: {count}',
    'footer.summary.sum': 'Sum: {sum}',
    'footer.summary.avg': 'Snitt: {avg}',
    'footer.summary.min': 'Min: {min}',
    'footer.summary.max': 'Maks: {max}',
    'footer.operator.EQUAL': '=',
    'footer.operator.LESS_THAN_OR_EQUAL_TO': '≤',
    'footer.operator.GREATER_THAN_OR_EQUAL_TO': '≥',
    'footer.operator.LESS_THAN': '<',
    'footer.operator.GREATER_THAN': '>',
    'footer.operator.CONTAINS': 'inneholder',
    'footer.operator.NOT_EQUAL_TO': '≠',
    'footer.operator.DOES_NOT_CONTAIN': 'inneholder ikke',
    'footer.operator.BEGIN_WITH': 'begynner med',
    'footer.operator.END_WITH': 'slutter med',
    'footer.operator.IN': 'i',
    'footer.operator.NOT_IN': 'ikke i',
    'footer.operator.IS_BLANK': 'er tom',
    'footer.operator.IS_NOT_BLANK': 'er ikke tom',

    // the aggregates of the columns, in the group rows and the totals row
    'aggregate.sum': 'Sum',
    'aggregate.avg': 'Snitt',
    'aggregate.min': 'Min',
    'aggregate.max': 'Maks',
    'aggregate.count': 'Antall',
    'aggregate.total': 'Totalt',

    // for screen readers
    'grid.label': 'Tabell',
    'grid.rowSelector': 'radvelger',
    'filter.placeholder.text': 'Tekst',
    'filter.placeholder.number': 'Tall',
    'grid.filter': 'Filtrer {label}',
    'grid.groupToggle': '{name} ({total})',
    'grid.removeGroup': 'Fjern grupperingen på {title}',
    'rowStatus.new': 'Ny rad',
    'rowStatus.edited': 'Endret',
    'rowStatus.deleted': 'Merket for sletting',
    'rowStatus.error': 'Feil: {errors}',
    'rowStatus.conflict': 'Også endret på serveren: {fields}',
    'rowStatus.removedOnServer': 'Slettet på serveren, har endringer her',
    'cell.editedMarker.tooltip': 'Opprinnelig verdi: {value}',
    'cell.editedMarker.blank': '(tom)',
    'cell.editedMarker.revert': 'Klikk for å angre',
    'cell.conflictMarker.tooltip': 'Endret på serveren til {value} mens du endret den',
    'cell.conflictMarker.take': 'Klikk for å bruke serverens verdi',
    'cell.multiline.more': 'Flere linjer, Enter viser alt',
    'cell.multiline.moreLines': '… {count} linjer til',
    'cell.multiline.hint': 'Ctrl+Enter lagrer, Esc avbryter',
    'cell.multiline.hintReadonly': 'Esc lukker',

    // the date picker
    'datePicker.hours': 'TT',
    'datePicker.minutes': 'MM',
    'datePicker.week': 'U',
    'datePicker.clear': 'Tøm',
    'datePicker.now': 'Nå',
    'datePicker.use': 'Bruk',
    'datePicker.previousYear': 'Forrige år',
    'datePicker.previousMonth': 'Forrige måned',
    'datePicker.nextMonth': 'Neste måned',
    'datePicker.nextYear': 'Neste år',
    'datePicker.month.january': 'Januar',
    'datePicker.month.february': 'Februar',
    'datePicker.month.march': 'Mars',
    'datePicker.month.april': 'April',
    'datePicker.month.may': 'Mai',
    'datePicker.month.june': 'Juni',
    'datePicker.month.july': 'Juli',
    'datePicker.month.august': 'August',
    'datePicker.month.september': 'September',
    'datePicker.month.october': 'Oktober',
    'datePicker.month.november': 'November',
    'datePicker.month.december': 'Desember',
    'datePicker.day.sunday': 'Sø',
    'datePicker.day.monday': 'Ma',
    'datePicker.day.tuesday': 'Ti',
    'datePicker.day.wednesday': 'On',
    'datePicker.day.thursday': 'To',
    'datePicker.day.friday': 'Fr',
    'datePicker.day.saturday': 'Lø',

    // made by the datasource: setTexts() only
    'validation.required': 'Må fylles ut',
    'validation.min': 'Må være minst {value}',
    'validation.max': 'Kan være høyst {value}',
    'validation.minLength': 'Må ha minst {value} tegn',
    'validation.maxLength': 'Kan ha høyst {value} tegn',
    'validation.pattern': 'Har ikke riktig format',
    'filterString.and': 'OG',
    'filterString.or': 'ELLER',
    'filterString.operator.EQUAL': 'lik',
    'filterString.operator.LESS_THAN_OR_EQUAL_TO': 'mindre_eller_lik',
    'filterString.operator.GREATER_THAN_OR_EQUAL_TO': 'større_eller_lik',
    'filterString.operator.LESS_THAN': 'mindre_enn',
    'filterString.operator.GREATER_THAN': 'større_enn',
    'filterString.operator.CONTAINS': 'inneholder',
    'filterString.operator.NOT_EQUAL_TO': 'ikke_lik',
    'filterString.operator.DOES_NOT_CONTAIN': 'inneholder_ikke',
    'filterString.operator.BEGIN_WITH': 'begynner_med',
    'filterString.operator.END_WITH': 'slutter_med',
    'filterString.operator.IN': 'i',
    'filterString.operator.NOT_IN': 'ikke_i',
    'filterString.operator.IS_BLANK': 'er_tom',
    'filterString.operator.IS_NOT_BLANK': 'er_ikke_tom',
    'grouping.blank': 'tom'
};

export const translation: DemoSample = {
    id: 'translation',
    title: 'Translation',
    group: 'Config',
    description:
        'Every text has an id. This grid starts in Norwegian with texts in its config: right click a cell, a header or a header filter, open the filter editor (click the footer) or the date picker of a date. The validation messages and getFilterString() are made by the datasource, which has no grid: they follow the texts of the page, setTexts(). Click "Validate" before and after "setTexts(norwegian)" - an age over 50 fails. A text set at runtime shows after the next rebuild, a validation message the next time the value is validated.',
    run(stage) {
        const ui = createStage(stage);
        const config = baseGridConfig();
        // the texts of this grid: they win over the page's (setTexts) and the defaults
        config.texts = norwegian;
        config.initialState = {
            filter: and(where('country', 'IN', ['Norway', 'Sweden']), where('age', 'GREATER_THAN_OR_EQUAL_TO', 30))
        };

        const { datasource, gridInterface } = mountGrid(ui.gridHost, config, undefined, {
            fields: { ...baseFields(), age: { type: 'number', validate: ['required', { id: 'max', value: 50 }] } }
        });

        ui.button('English (texts: undefined)', () => {
            gridInterface.updateConfig({ texts: undefined });
        });
        ui.button('Norsk (texts)', () => {
            gridInterface.updateConfig({ texts: norwegian });
        });
        ui.button('setTexts(norwegian): the page', () => {
            // every grid and datasource of the page, the validation messages and getFilterString() too
            setTexts(norwegian);
            // nothing is rendered again on its own
            gridInterface.rebuild();
            ui.log('the page is Norwegian - validate again for the messages');
        });
        ui.button('setTexts({}): English page', () => {
            setTexts({});
            gridInterface.rebuild();
        });
        ui.button('Validate', () => {
            // the messages are made now, in the language of the page
            const errors = datasource.validate();
            ui.log(errors.length ? `${errors.length} errors, e.g. "${errors[0].messages.join(', ')}"` : 'no errors');
        });
        ui.button('getFilterString()', () => {
            ui.log(datasource.getFilterString());
        });

        // this site shows other samples on the same page: they get English back when you leave this one
        window.addEventListener('hashchange', () => setTexts({}), { once: true });
    }
};
