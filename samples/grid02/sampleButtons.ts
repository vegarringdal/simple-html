import { html } from 'lit';
import { gridInterface, generator } from '.';

/**
 * contains samples on how to
 * @returns
 */
export function sampleButtons() {
    return html`<!-- buttons -->
        <div class="p-2 m-2 flex-col">
            <div class="p-2 m-2 flex-row">
                <button
                    @click="${() => {
                        gridInterface.setData(generator.generateData(1000), true);
                    }}"
                >
                    add 1k
                </button>

                <button
                    @click="${() => {
                        gridInterface.autoResizeColumns();
                    }}"
                >
                    autoResizeColumns
                </button>
            </div>
            <!-- ---------------------------------------------------------------------------- -->
            <div class="grid p-2 m-2 flex-row">
                <button
                    @click="${() => {
                        gridInterface.showFilterDialog();
                    }}"
                >
                    show filter dialog
                </button>

                <button
                    @click="${() => {
                        gridInterface.clearAllFilters();
                    }}"
                >
                    clear filters
                </button>
            </div>
            <!-- ---------------------------------------------------------------------------- -->
            <div class="grid p-2 m-2 flex-row">
                <button
                    @click="${() => {
                        const x = document.getElementById('dupes');
                        if (x) {
                            x.parentElement.removeChild(x);
                        } else {
                            const style = document.createElement('style');
                            style.id = 'dupes';
                            // this is also a option
                            //[data-attribute="word5"].simple-html-grid-duplicate-value
                            style.appendChild(
                                document.createTextNode(`   
                                    .simple-html-grid-duplicate-value {
                                        opacity: 0.1;
                                    }
                            `)
                            );
                            document.body.appendChild(style);
                        }
                    }}"
                >
                    remove dup (css)
                </button>

                <button
                    @click="${() => {
                        const x = document.getElementById('darkgrid');
                        if (x) {
                            x.parentElement.removeChild(x);
                        } else {
                            const style = document.createElement('style');
                            style.id = 'darkgrid';
                            style.appendChild(
                                document.createTextNode(`
                            body,
                            .simple-html-grid-menu,
                            .simple-html-grid {
                                --simple-html-grid-main-bg-color: #374151;
                                --simple-html-grid-sec-bg-color: #4b5563;
                                --simple-html-grid-alt-bg-color: #4b5563;
                                --simple-html-grid-main-bg-border: #1f2937;
                                --simple-html-grid-sec-bg-border: #1f2937;
                                --simple-html-grid-main-bg-selected: #234882;
                                --simple-html-grid-main-font-color: #f9f7f7;
                                --simple-html-grid-sec-font-color: #979494;
                                --simple-html-grid-dropzone-color: #979494;
                                --simple-html-grid-grouping-border: #1f2937;
                                --simple-html-grid-boxshadow: #4b5563;
                                --simple-html-grid-main-hr-border: #4b5563;
                            }
                        
                            .simple-html-grid ul.dialog-row {
                                box-shadow: none;
                              
                            }
                            .simple-html-grid li.dialog-row {
                    
                                border-left: 1px dotted rgb(100, 100, 100);
                            } 
                            .simple-html-grid .grid-edit-button {
                                border-color: #374151;
                            }
                            .simple-html-grid .filter-dialog-bottom-row{
                                border-top: 0px;
                            }
                    
                            .simple-html-grid .filter-dialog-bottom-row button{
                                border: 1px solid #515458;
                            }
                            
                            `)
                            );
                            document.body.appendChild(style);
                        }
                    }}"
                >
                    darkmode
                </button>
                <!-- ---------------------------------------------------------------------------- -->
                <div class="grid p-2 m-2 flex-row">
                    <button
                        @click="${() => {
                            gridInterface.getDatasource().selectFirst();
                        }}"
                    >
                        select first
                    </button>

                    <button
                        @click="${() => {
                            gridInterface.getDatasource().selectNext();
                        }}"
                    >
                        select next
                    </button>
                </div>
                <!-- ---------------------------------------------------------------------------- -->
                <div class="grid p-2 m-2 flex-row">
                    <button
                        @click="${() => {
                            gridInterface.getDatasource().selectPrev();
                        }}"
                    >
                        select prev
                    </button>

                    <button
                        @click="${() => {
                            gridInterface.getDatasource().selectLast();
                        }}"
                    >
                        select last
                    </button>
                </div>
                <!-- ---------------------------------------------------------------------------- -->
                <div class="grid p-2 m-2 flex-row">
                    <button
                        @click="${() => {
                            gridInterface.getDatasource().selectAll(); // (can also use contr +A when grid has focus)
                            gridInterface.reRender(); // grid does not auto render when setting all
                        }}"
                    >
                        select all
                    </button>

                    <button
                        @click="${() => {
                            console.log('cell event grid listener added');
                            // simple for now, rerender will break this.
                            // removeEventListener to remove
                            gridInterface.addEventListener((type: string, data: any) => {
                                console.log('cell function', type, data);
                                return true;
                            });
                            gridInterface.addEventListener({
                                handleEvent: (type: string, data: any) => {
                                    console.log('cell handleEvent', type, data);
                                    return true;
                                }
                            });
                        }}"
                    >
                        cell event grid
                    </button>
                </div>
                <!-- ---------------------------------------------------------------------------- -->
                <div class="grid p-2 m-2 flex-row">
                    <button
                        @click="${() => {
                            console.log('ds event listener added');
                            // simple for now, rerender will break this.
                            // removeEventListener to remove
                            gridInterface
                                .getDatasource()
                                .addEventListener((type: string, data: any) => {
                                    console.log('ds function', type, data);
                                    return true;
                                });
                            gridInterface.getDatasource().addEventListener({
                                handleEvent: (type: string, data: any) => {
                                    console.log('ds handleEvent', type, data);
                                    return true;
                                }
                            });
                        }}"
                    >
                        ds events
                    </button>

                    <button
                        @click="${() => {
                            alert('not implemented');
                        }}"
                    >
                        tba
                    </button>
                </div>
                <!-- ---------------------------------------------------------------------------- -->
                <div class="grid p-2 m-2 flex-row">
                    <button
                        @click="${() => {
                            console.log(gridInterface.getDatasource().getGrouping());
                        }}"
                    >
                        get grouping
                    </button>

                    <button
                        @click="${() => {
                            alert('not implemented');
                        }}"
                    >
                        tba
                    </button>
                </div>
                <!-- ---------------------------------------------------------------------------- -->
                <div class="grid p-2 m-2 flex-row">
                    <button
                        @click="${() => {
                            alert('not implemented');
                        }}"
                    >
                        tba
                    </button>

                    <button
                        @click="${() => {
                            alert('not implemented');
                        }}"
                    >
                        tba
                    </button>
                </div>
                <!-- ---------------------------------------------------------------------------- -->
                <div class="grid p-2 m-2 flex-row">
                    <button
                        @click="${() => {
                            alert('not implemented');
                        }}"
                    >
                        tba
                    </button>

                    <button
                        @click="${() => {
                            alert('not implemented');
                        }}"
                    >
                        tba
                    </button>
                </div>
                <!-- ---------------------------------------------------------------------------- -->
                <div class="grid p-2 m-2 flex-row">
                    <button
                        @click="${() => {
                            alert('not implemented');
                        }}"
                    >
                        tba
                    </button>

                    <button
                        @click="${() => {
                            alert('not implemented');
                        }}"
                    >
                        tba
                    </button>
                </div>
                <!-- ---------------------------------------------------------------------------- -->
                <div class="grid p-2 m-2 flex-row">
                    <button
                        @click="${() => {
                            alert('not implemented');
                        }}"
                    >
                        tba
                    </button>

                    <button
                        @click="${() => {
                            alert('not implemented');
                        }}"
                    >
                        tba
                    </button>
                </div>
                <!-- ---------------------------------------------------------------------------- -->
                <div class="grid p-2 m-2 flex-row">
                    <button
                        @click="${() => {
                            alert('not implemented');
                        }}"
                    >
                        tba
                    </button>

                    <button
                        @click="${() => {
                            alert('not implemented');
                        }}"
                    >
                        tba
                    </button>
                </div>
                <!-- ---------------------------------------------------------------------------- -->
                <div class="grid p-2 m-2 flex-row">
                    <button
                        @click="${() => {
                            alert('not implemented');
                        }}"
                    >
                        tba
                    </button>

                    <button
                        @click="${() => {
                            alert('not implemented');
                        }}"
                    >
                        tba
                    </button>
                </div>
                <!-- ---------------------------------------------------------------------------- -->
                <div class="grid p-2 m-2 flex-row">
                    <button
                        @click="${() => {
                            alert('not implemented');
                        }}"
                    >
                        tba
                    </button>

                    <button
                        @click="${() => {
                            alert('not implemented');
                        }}"
                    >
                        tba
                    </button>
                </div>
                <!-- ---------------------------------------------------------------------------- -->
                <div class="grid p-2 m-2 flex-row">
                    <button
                        @click="${() => {
                            alert('not implemented');
                        }}"
                    >
                        tba
                    </button>

                    <button
                        @click="${() => {
                            alert('not implemented');
                        }}"
                    >
                        tba
                    </button>
                </div>
                <!-- ---------------------------------------------------------------------------- -->
                <div class="grid p-2 m-2 flex-row">
                    <button
                        @click="${() => {
                            alert('not implemented');
                        }}"
                    >
                        tba
                    </button>

                    <button
                        @click="${() => {
                            alert('not implemented');
                        }}"
                    >
                        tba
                    </button>
                </div>
                <!-- ---------------------------------------------------------------------------- -->
                <div class="grid p-2 m-2 flex-row">
                    <button
                        @click="${() => {
                            alert('not implemented');
                        }}"
                    >
                        tba
                    </button>

                    <button
                        @click="${() => {
                            alert('not implemented');
                        }}"
                    >
                        tba
                    </button>
                </div>
                <!-- ---------------------------------------------------------------------------- -->
                <div class="grid p-2 m-2 flex-row">
                    <button
                        @click="${() => {
                            alert('not implemented');
                        }}"
                    >
                        tba
                    </button>

                    <button
                        @click="${() => {
                            alert('not implemented');
                        }}"
                    >
                        tba
                    </button>
                </div>
                <!-- ---------------------------------------------------------------------------- -->
                <div class="grid p-2 m-2 flex-row">
                    <button
                        @click="${() => {
                            alert('not implemented');
                        }}"
                    >
                        tba
                    </button>

                    <button
                        @click="${() => {
                            alert('not implemented');
                        }}"
                    >
                        tba
                    </button>
                </div>
                <!-- ---------------------------------------------------------------------------- -->
                <div class="grid p-2 m-2 flex-row">
                    <button
                        @click="${() => {
                            alert('not implemented');
                        }}"
                    >
                        tba
                    </button>

                    <button
                        @click="${() => {
                            alert('not implemented');
                        }}"
                    >
                        tba
                    </button>
                </div>
                <!-- ---------------------------------------------------------------------------- -->
                <div class="grid p-2 m-2 flex-row">
                    <button
                        @click="${() => {
                            alert('not implemented');
                        }}"
                    >
                        tba
                    </button>

                    <button
                        @click="${() => {
                            alert('not implemented');
                        }}"
                    >
                        tba
                    </button>
                </div>
                <!-- ---------------------------------------------------------------------------- -->
            </div>
        </div>`;
}
