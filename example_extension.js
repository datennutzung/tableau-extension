'use strict';
const versionNumber = "0.3.5"

// Use the jQuery document ready signal to know when everything has been initialized
$(document).ready(function() {
    // Tell Tableau we'd like to initialize our extension
    initializeButtons(); // muss unter das initialize extension
    tableau.extensions.initializeAsync().then(function() {
        initializeExtension();
    });
});

function initializeExtension() {
    // Fetch the saved sheet name from settings. This will be undefined if there isn't one configured yet
    const savedSheetName = tableau.extensions.settings.get('sheet');
    if (savedSheetName) {
        // We have a saved sheet name, show its selected marks
        loadSelectedMarks(savedSheetName);
    } else {
        // If there isn't a sheet saved in settings, show the dialog
        showChooseSheetDialog();
    }
}

/**
 * Shows the choose sheet UI. Once a sheet is selected, the data table for the sheet is shown
 */
function showChooseSheetDialog() {
    // Clear out the existing list of sheets
    $('#choose_sheet_buttons').empty();

    // Set the dashboard's name in the title
    const dashboardName = tableau.extensions.dashboardContent.dashboard.name;
    $('#choose_sheet_title').text(dashboardName);

    // The first step in choosing a sheet will be asking Tableau what sheets are available
    const worksheets = tableau.extensions.dashboardContent.dashboard.worksheets;

    // Next, we loop through all of these worksheets and add buttons for each one
    worksheets.forEach(function(worksheet) {
        // Declare our new button which contains the sheet name
        const button = $("<button type='button' class='btn btn-default btn-block'>"+worksheet.name+"</button>");

        // Create an event handler for when this button is clicked
        button.click(function() {
            // Get the worksheet name and save it to settings.
            filteredColumns = [];
            const worksheetName = worksheet.name;
            tableau.extensions.settings.set('sheet', worksheetName);
            tableau.extensions.settings.saveAsync().then(function() {
                // Once the save has completed, close the dialog and show the data table for this worksheet
                $('#choose_sheet_dialog').modal('toggle');
                loadSelectedMarks(worksheetName);
            });
        });

        // Add our button to the list of worksheets to choose from
        $('#choose_sheet_buttons').append(button);
    });

    // Show the dialog
    $('#choose_sheet_dialog').modal('toggle');
}

// This variable will save off the function we can call to unregister listening to marks-selected events
var unregisterEventHandlerFunction;
function loadSelectedMarks(worksheetName) {
    // Remove any existing event listeners
    if (unregisterEventHandlerFunction) {
        unregisterEventHandlerFunction();
    }

    // Get the worksheet object we want to get the selected marks for
    const worksheet = getSelectedSheet(worksheetName);

    // Set our title to an appropriate value
    $('#selected_marks_title').text(worksheet.name);

    // Call to get the selected marks for our sheet
    worksheet.getSelectedMarksAsync().then(function(marks) {
        // Get the first DataTable for our selected marks (usually there is just one)
        const worksheetData = marks.data[0];

        // Map our data into the format which the data table component expects it
        const data = worksheetData.data.map(function(row, index) {
            const rowData = row.map(function(cell) {
                return cell.formattedValue;
            });

            return rowData;
        });

        const columns = worksheetData.columns.map(function(column) {
            return {
                title: column.fieldName
            };
        });

        // Populate the data table with the rows and columns we just pulled out
        findGroups();
        
        populateDataTable(data, columns);
    });

    // Add an event listener for the selection changed event on this sheet.
    unregisterEventHandlerFunction = worksheet.addEventListener(tableau.TableauEventType.MarkSelectionChanged, function(selectionEvent) {
        // When the selection changes, reload the data
        loadSelectedMarks(worksheetName);
    });
}

var data_table;
var data = [];
var columns;
function populateDataTable(p_data, p_columns) {
    data = p_data;
    // Do some UI setup here: change the visible section and reinitialize the table
    $('#data_table_wrapper').empty();
    if (settings.hideData)
        $('#selection_data').hide();
     else 
        $('#selection_data').show();

    if (p_data.length > 0) {
        columns = p_columns;
        $('#no_data_message').css('display', 'none');
        $('#data_table_wrapper').append(`<table id='data_table' class='table table-striped table-bordered'></table>`);

        // Do some math to compute the height we want the data table to be
        var top = $('#data_table_wrapper')[0].getBoundingClientRect().top;
        var height = ($(document).height() - top)/2;

        const headerCallback = function(thead, p_data) {
            const headers = $(thead).find('th');
            for (let i = 0; i < headers.length; i++) {
                const header = $(headers[i]);
                if (header.children().length === 0) {
                    const fieldName = header.text();
                    const button = $(`<a href='#'>${fieldName}</a>`);
                    button.click(function() {
                        filterByColumn(i, fieldName);
                    });
                    header.html(button);
                }
            }
        };

        // Initialize our data table with what we just gathered
        data_table = $('#data_table').DataTable({
            data: p_data,
            columns: p_columns,
            autoWidth: false,
            deferRender: true,
            scroller: true,
            scrollY: height,
            scrollX: true,
            headerCallback: headerCallback,
            dom: "<'row'<'col-sm-6'i><'col-sm-6'f>><'row'<'col-sm-12'tr>>" // Do some custom styling
        });
        $('#btn_fault_group').show();
    } else {
        // If we didn't get any rows back, there must be no marks selected
        $('#btn_fault_group').hide();
        $('#no_data_message').css('display', 'inline');
    }
}

var groups_array = [];
function getAllGroups(p_group_column_index) {
    let group_column = data_table.column(p_group_column_index).data().toArray();
    for (let i = 0; i < group_column.length; i++) {
        const element = group_column[i];
        if (element == null || element == "" || element == "%null%") {
            continue;
        } else if (!groups_array.includes(element)) {
            groups_array.push(element);
        }
    }
    return groups_array;
}

var settings = {
    date_column_index: 0,
    date_column_name: "",
    date_seperator: ".",
    date_time_seperator: " ",
    date_form: "dmy",
    time_form: 24,
    group_column_name: "",
    group_column_index: 0,
    group_seperator: "#",
    group_start_index: 0,
    group_end_index: 0,
    feedback_url: "",
    username: "",
    password: "",
    hideData: true
}

function toggleDataVisibility() {
    $('#toggle_data_visible_button').text(settings.hideData ? "Hide Data" : "Show Data");
    settings.hideData = !settings.hideData;
    populateDataTable(data, columns);
}

function loadSettings() {
    try {
        let savedSettings = tableau.extensions.settings.get('appSettings');
        if (savedSettings) {
            settings = savedSettings;
        }
    } catch (error) {
        console.error(error);   
    }
    // select datetime column and groupId
    $('#select_datetime_column').empty();
    $('#select_group_column').empty();
    $("#select_group_start").empty();
    $("#select_group_end").empty();
    if (columns !== undefined) {
        $('#select_datetime_column').prop("disabled", false);
        $('#select_group_column').prop("disabled", false);
        $("#select_group_start").prop("disabled", false);
        $("#select_group_end").prop("disabled", false);
        for (let i = 0; i < columns.length; i++) {
            if (i == settings.date_column_index) {
                $('#select_datetime_column').append("<option value="+i+" selected>"+columns[i].title+"</option>");
            } else {
                $('#select_datetime_column').append("<option value="+i+">"+columns[i].title+"</option>");
            }
            if (i == settings.group_column_index) {
                $('#select_group_column').append("<option value="+i+" selected>"+columns[i].title+"</option>");
            } else {
                $('#select_group_column').append("<option value="+i+">"+columns[i].title+"</option>");
            }
        }
    } else {
        $('#select_datetime_column').prop("disabled", true);
        $('#select_group_column').prop("disabled", true);
        $("#select_group_start").prop("disabled", true);
        $("#select_group_end").prop("disabled", true);
    }

    //datetime settings
    $('#input_date_sep').val(settings.date_seperator);
    $('#input_date_time_sep').val(settings.date_time_seperator);
    $('#select_date_format').val(settings.date_form);
    $('#select_time_format').val(settings.time_form);

    //group settings
    $('#input_group_sep').val(settings.group_seperator);
    let group_column_array = settings.group_column_name.split(settings.group_seperator);
    for (let i = 0; i < group_column_array.length; i++) {
        const column_name = group_column_array[i];
        if (i == settings.group_start_index) {
            $("#select_group_start").append("<option value="+i+" selected>"+column_name+"</option>");
        } else {
            $("#select_group_start").append("<option value="+i+">"+column_name+"</option>");
        }
        if (i == settings.group_end_index) {
            $("#select_group_end").append("<option value="+i+" selected>"+column_name+"</option>");
        } else {
            $("#select_group_end").append("<option value="+i+">"+column_name+"</option>");
        }
    }

    //feedback settings
    $('#input_feedback_server').val(settings.feedback_url);
    $('#input_feedback_username').val(settings.username);
    $('#input_feedback_password').val("");
    if (settings.password != "") {
        $('#input_feedback_password').attr("placeholder", "(*unchanged*)");
    }

    $('#version_number').text(versionNumber);
    $('#app_settings_modal').modal("show");
}

function saveSettings() {
    //datetime settings
    settings.date_column_index = $("#select_datetime_column").val();
    settings.date_column_name = $("#select_datetime_column :selected").text();
    settings.date_seperator =  $('#input_date_sep').val();
    settings.date_time_seperator = $('#input_date_time_sep').val();
    settings.date_form = $("#select_date_format").val();
    settings.time_form = $("#select_time_format").val();

    //group settings
    settings.group_column_name = $("#select_group_column :selected").text();
    settings.group_column_index = $("#select_group_column").val();
    settings.group_seperator = $('#input_group_sep').val();
    settings.group_start_index = $("#select_group_start").val();
    settings.group_end_index = $("#select_group_end").val();

    //feedback settings
    settings.feedback_url = $('#input_feedback_server').val();
    settings.username = $('#input_feedback_username').val();
    settings.password = $('#input_feedback_password').val()==""?settings.password:$('#input_feedback_password').val();

    try {
        tableau.extensions.settings.set('appSettings', settings);
    } catch (error) {
        console.error(error);
    }
}

function togglePassword() {
    let visible = "visibility";
    let not_visible = "visibility_off";
    let input = $($(this).attr("toggle"));
    let icon = $(this)[0].firstElementChild;
    if (input.attr("type") == "password") {
        input.attr("type", "text");
        icon.innerText = not_visible;
    } else {
        input.attr("type", "password");
        icon.innerText = visible;
    }
}

function initializeButtons() {
    $('#show_choose_sheet_button').click(showChooseSheetDialog);
    $('#reset_filters_button').click(resetFilters);

    $('#app_settings_button').click(loadSettings);
    $('#settings_reload_button').click(loadSettings);
    $('#apply_settings_button').click(function() {saveSettings(); loadSettings();});
    $('#ok_settings_button').click(saveSettings);
    $('.toggle-password').click(togglePassword);

    $('#data_fault_button').click(function() {markSelectedAsFault(true)});
    $('#data_correct_button').click(function() {markSelectedAsFault(false)});
    $('#ranges_submit_button').click(submitRanges);
    
    $("#toggle_data_visible_button").click(toggleDataVisibility);
    $('#test_data_button').click(testData);
    $('#test_things_button').click(testThings);
}

function findGroups() {
    getAllGroups(settings.group_column_index);
    createGroupsTableHeaders(settings.group_column_name, settings.group_seperator);
    $('#groups_table_body').empty();
    let group_rows = [];
    for (let i = 0; i < groups_array.length; i++) {
        const element = groups_array[i];
        group_rows.push(addGroupsTableEntry(element, settings.group_seperator));
    }
    $('#groups').show()
}

function testThings() {
    findGroups();
}

function deleteGroupsTableEntry(rowObject) {
    let index = rowObject.rowIndex-1;
    let tbody = $('#groups_table_body')[0];
    tbody.deleteRow(index);
}

function createGroupsTableHeaders(group_header_string, sep) {
    let group_header_array = group_header_string.split(sep);
    let thead = $('#groups_table_head');
    thead.empty();
    let row = thead[0].insertRow(0);
    for(let i = 0; i < group_header_array.length; i++) {
        let cell =  row.insertCell(i);
        cell.innerHTML = "<b>"+group_header_array[i]+"</b>";
    }
    let lastCell = row.insertCell(-1);
    lastCell.innerHTML = "<b>Correct</b>"
}

function addGroupsTableEntry(group_string, sep)  {
    let group_array = group_string.split(sep);
    let tbody = $('#groups_table_body')[0];
    let row = tbody.insertRow(-1);
    for(let i = 0; i < group_array.length; i++) {
        let cell =  row.insertCell(i);
        cell.innerHTML = group_array[i];
    }
    // let rI = row.rowIndex-1;
    let lastCell = row.insertCell(-1);
    let button_yes = $("<button class='btn btn-success btn-sm'>Yes</button>");
    let button_no = $("<button class='btn btn-danger btn-sm'>No</button>");
    let button_show_range = $("<button class='btn btn-secondary btn-sm'>Show</button>")

    let start = row.cells[settings.group_start_index].innerText;
    let end = row.cells[settings.group_end_index].innerText;
    start = new Date(start);
    end = new Date(end);
    button_yes.click(function() {markRangeAsFault(start, end, false)});
    button_no.click(function() {markRangeAsFault(start, end, true)});
    button_show_range.click(function() {showRange(start, end)})

    lastCell.append(button_yes[0]);
    lastCell.append(" ");
    lastCell.append(button_no[0]);
    lastCell.append(" ");
    lastCell.append(button_show_range[0]);
    return row;
}

function convertToUTC(date) {
    let year = date.getFullYear();
    let month = date.getMonth();
    let day = date.getDate();
    let hour = date.getHours();
    let minute = date.getMinutes();
    let second = date.getSeconds();

    return new Date(Date.UTC(year, month, day, hour, minute, second));
}

function showRange(start_date, end_date) {
    const worksheet = getSelectedSheet(tableau.extensions.settings.get('sheet'));
    start_date = convertToUTC(start_date);
    end_date = convertToUTC(end_date);
    worksheet.applyRangeFilterAsync(settings.date_column_name, {min: start_date, max: end_date});
    filteredColumns.push(settings.date_column_name);
}

var fdd_events = {data_step: 1337, data_start: "1970-01-01T00:00:00", data_end: "2999-12-31T23:59:59", ranges: []};
var fdd_event_ranges = [];
function addRangeEntry(array_pos) {
    let start_date = fdd_event_ranges[array_pos].start.toLocaleDateString();
    let start_time = fdd_event_ranges[array_pos].start.toLocaleTimeString();
    let start = start_date + " " + start_time;
    let end_date = fdd_event_ranges[array_pos].end.toLocaleDateString();
    let end_time = fdd_event_ranges[array_pos].end.toLocaleTimeString();
    let end = end_date + " " + end_time;
    let fault = fdd_event_ranges[array_pos].is_fault;
    
    let li = "<li>"+array_pos+". "+start+" - "+end+" | Fault: "+fault+"<span class='btn-close' onclick='removeRangeEntry(this.parentElement)'>&times;</span></li>";
    $("#ranges_list").append(li);
    $("#ranges").show();
}

function removeRangeEntry(object) {
    let array_pos = parseInt(object.innerText.split(".")[0], 10);
    delete fdd_event_ranges[array_pos];
    object.remove();

    if ($("#ranges_list").children().length === 0) {
        $("#ranges").hide();
    }
}

function markRangeAsFault(start_time, end_time, fault) {
    let range = {start: start_time, end: end_time, is_fault: fault};
    let length = fdd_event_ranges.push(range);
    addRangeEntry(length-1);
}

function markSelectedAsFault(fault) {
    // get the list of marks as selected_marks
    let dates = data_table.column(settings.date_column_index).data().toArray();
    let last = new Date("1970-01-01T00:00:00");
    let first = new Date("2999-12-31T23:59:59");
    for (let i = 0; i<dates.length; i++) {
        let date = formatDateTime(dates[i], settings.date_seperator, settings.date_time_seperator, settings.date_form, settings.time_form);
        last = date>last?date:last;
        first = date<first?date:first;
    }
    markRangeAsFault(first, last, fault);
}

function formatDateTime(datetime="", date_sep=".", date_time_sep=" ", dateFormat="dmy", time_format = 24) {
    let date_time = datetime.split(date_time_sep);
    let date_str = date_time.shift();
    let date_arr = date_str.split(date_sep);
    let time_str = date_time.join("");
    time_str.trim();
    if (time_str == "") {
        time_str = "00:00:00"
    } else {
        if (time_format == 12) {
            if (time_str.endsWith("PM")) {
                time_str = time_str.slice(0, -2);
                time_str.trim();
                let time_arr = time_str.split(":");
                time_arr[0] = parseInt(time_arr[0])+12;
                time_str = time_arr.join(":");
            } else if (time_str.endsWith("AM")){
                time_str = time_str.slice(0, -2);
                time_str.trim();
            }
        }
    }

    switch (dateFormat) { 
        case "mdy":
            var month = date_arr[0];
            var day = date_arr[1];
            var year = date_arr[2];
            break;
        case "ymd":
            var year = date_arr[0];
            var month = date_arr[1];
            var day = date_arr[2];
            break;
        case "dmy":
        default:
            var day = date_arr[0];
            var month = date_arr[1];
            var year = date_arr[2];
        break;
    }
    let new_date_str = year+"-"+month+"-"+day+"T"+time_str;
    return new Date(new_date_str);
}

function deleteAllRanges() {
    let ranges = $("#ranges_list").children();
    ranges.toArray().forEach(element => {removeRangeEntry(element)});
}

function submitRanges() {
    fdd_events.ranges = [];
    for (let range_index = 0; range_index <= fdd_event_ranges.length; range_index++) {
        if (fdd_event_ranges[range_index] != null) {
            fdd_events.ranges.push(fdd_event_ranges[range_index]);
        }
    }
    if (settings.feedback_url == "") {
        $("#feedback_server_settings").collapse('show');
        $('#app_settings_modal').modal("show");
    } else {
        // send fdd_events to feedback server
        let xhr = new XMLHttpRequest();
        xhr.open("POST", settings.feedback_url, true);
        xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
        xhr.onreadystatechange = function() {
            console.log(this.status +" "+ this.statusText);
            if (this.readyState === XMLHttpRequest.DONE && this.status === 200) {
                deleteAllRanges();
            }
        }
        xhr.onerror = function() {
            alert("Error! "+this.statusText)
        }

        if (settings.username != "")
            fdd_events.username = settings.username;
        if (settings.password != "")
            fdd_events.password = settings.password;
        
        let to_send = JSON.stringify(fdd_events);
        xhr.send(to_send);
        console.log(to_send);
    }   
}

function testData() {
    let t_columns = [{title:"Date Time"}, {title:"Fault"}, {title:"pH distillate"}, {title:"GroupID#start#end"}];
    let t_data = [["01.04.2019 22:43:15", "1", "18", "a1#2019-04-01T22:43:15#2019-05-04T00:13:11"],
                  ["05.04.2019 00:13:11", "1", "3", "a1#2019-04-01T22:43:15#2019-05-04T00:13:11"],
                  ["07.04.2019 12:11:00", "0", "7", ""]];
    data = t_data;
    columns = t_columns;
    populateDataTable(t_data, t_columns);

    settings.date_column_index = 0;
    settings.date_seperator = ".";
    settings.date_time_seperator = " ";
    settings.date_form = "dmy";
    settings.time_form = 24;

    settings.group_column_name = "GroupID#start#end";
    settings.group_column_index = 3;
    settings.group_seperator = "#";
    settings.group_start_index = 1;
    settings.group_end_index = 2;

    settings.feedback_url = "https://example.com/feedback";
    settings.username = "username";
    settings.password = "password";
    loadSettings();
}

// Save the columns we've applied filters to so we can reset them
var filteredColumns = [];

function filterByColumn(columnIndex, fieldName) {
    // Grab our column of data from the data table and filter out to just unique values
    const column = columns[columnIndex];
    const columnDomain = column.data().toArray().filter(function(value, index, self) {
        return self.indexOf(value) === index;
    });

    const worksheet = getSelectedSheet(tableau.extensions.settings.get('sheet'));
    worksheet.applyFilterAsync(fieldName, columnDomain, tableau.FilterUpdateType.Replace);
    filteredColumns.push(fieldName);
    return false;
}

function resetFilters() {
    const worksheet = getSelectedSheet(tableau.extensions.settings.get('sheet'));
    filteredColumns.forEach(function(columnName) {
        worksheet.clearFilterAsync(columnName);
    });

    filteredColumns = [];
}

function getSelectedSheet(worksheetName) {
    if (!worksheetName) {
        worksheetName = tableau.extensions.settings.get('sheet');
    }

    // Go through all the worksheets in the dashboard and find the one we want
    return tableau.extensions.dashboardContent.dashboard.worksheets.find(function(sheet) {
        return sheet.name === worksheetName;
    });
}

/*

DATEADD(
'hour', DATEPART('hour', [Time]), DATEADD(
'minute', DATEPART('minute', [Time]), DATEADD(
'second', DATEPART('second', [Time]), [#Date])))

*/
