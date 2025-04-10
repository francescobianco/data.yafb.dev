/**
 * Google Apps Script: Spreadsheet API as DB
 *
 * Endpoints:
 *   GET /list
 *   POST /insert
 *   POST /update
 *   POST /delete
 *
 * All responses are in JSON format (terminated with a newline).
 */

function doGet(e) {
  try {
    var action = extractAction(e);
    var sheetName = extractSheetNameFromGet(e);
    var sheet = getSheet(sheetName);
    if (!sheet) {
      return outputJSON({ error: "Sheet not found", sheet: sheetName });
    }

    if (action === "list") {
      var dataObj = readData(sheet);

      // Build filters from query parameters: all keys that are not "$*" or "sheet"
      var filters = {};
      for (var key in e.parameter) {
        if (e.parameter.hasOwnProperty(key) && key !== "sheet" && key.indexOf("$") !== 0) {
          filters[key] = e.parameter[key];
        }
      }
      if (Object.keys(filters).length > 0) {
        dataObj.data = applyFilters(dataObj.data, filters);
      }

      return outputJSON({
        sheet: sheet.getName(),
        columns: dataObj.columns,
        data: dataObj.data
      });
    }

    return outputJSON({ error: "Invalid action", sheet: sheetName });
  } catch (error) {
    return outputJSON({ error: "Error processing request: " + error.message });
  }
}

function doPost(e) {
  try {
    var action = extractAction(e);
    var params;
    try {
      params = JSON.parse(e.postData.contents);
    } catch (error) {
      return outputJSON({ error: "Invalid JSON data" });
    }

    // Flatten the incoming JSON object so that nested fields become "parent.child"
    params = flattenObject(params);

    // For POST, the sheet name is provided in the JSON payload ("sheet")
    var sheetName = params.sheet || getFirstSheetName();
    // Remove the 'sheet' key so it is not inserted/updated as a column
    delete params.sheet;

    var sheet;
    if (action === "insert") {
      // Only for insert: create the sheet if it does not exist.
      sheet = getOrCreateSheet(sheetName);
    } else {
      sheet = getSheet(sheetName);
    }
    if (!sheet) {
      return outputJSON({ error: "Sheet not found", sheet: sheetName });
    }

    if (action === "insert") {
      var result = insertData(sheet, params);
      return outputJSON({
        sheet: sheet.getName(),
        columns: result.columns,
        data: [result.inserted]
      });
    }

    if (action === "update") {
      var result = updateData(sheet, params);
      if (result.error) {
        return outputJSON({ error: result.error, sheet: sheet.getName(), columns: result.columns });
      }
      return outputJSON({
        sheet: sheet.getName(),
        columns: result.columns,
        data: [result.updated]
      });
    }

    if (action === "delete") {
      var result = deleteData(sheet, params);
      if (result.error) {
        return outputJSON({ error: result.error, sheet: sheet.getName(), columns: result.columns });
      }
      // Ensure the deleted data is always returned as an array.
      var deletedData = Array.isArray(result.deleted) ? result.deleted : [result.deleted];
      return outputJSON({
        sheet: sheet.getName(),
        columns: result.columns,
        data: deletedData
      });
    }

    return outputJSON({ error: "Invalid action", sheet: sheetName });
  } catch (error) {
    return outputJSON({ error: "Error processing request: " + error.message });
  }
}

/**
 * Extracts the API action from the $REQUEST_URI parameter.
 * Example: "/list" becomes "list"
 */
function extractAction(e) {
  var uri = e.parameter && e.parameter["$REQUEST_URI"];
  if (uri) {
    if (typeof uri === "string") {
      return uri.substring(1); // remove leading '/'
    } else if (uri instanceof Array) {
      return uri[0].substring(1);
    }
  }
  return "";
}

/**
 * Extracts the sheet name for GET requests from query parameters.
 */
function extractSheetNameFromGet(e) {
  if (e.parameter && e.parameter.sheet) {
    if (typeof e.parameter.sheet === "string") {
      return e.parameter.sheet;
    } else if (e.parameter.sheet instanceof Array) {
      return e.parameter.sheet[0];
    }
  }
  return getFirstSheetName();
}

/**
 * Returns the name of the first sheet in the spreadsheet.
 */
function getFirstSheetName() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets()[0].getName();
}

/**
 * Gets a sheet by its name.
 */
function getSheet(sheetName) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
}

/**
 * Gets or creates a sheet.
 * Only used in the insert API. If the sheet does not exist, it is created.
 */
function getOrCreateSheet(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (!sheet) throw new Error("Failed to create sheet: " + sheetName);
  }
  return sheet;
}

/**
 * Reads all data from the sheet.
 * Returns an object with "columns" (the header row) and "data" (records).
 * Each record includes the "row" property (the actual spreadsheet row number).
 */
function readData(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 1) return { columns: [], data: [] };

  // Filter out any empty header cells.
  var headers = data[0].filter(function(h) { return h !== ""; });
  var result = [];
  for (var i = 1; i < data.length; i++) {
    var flatObj = {};
    for (var j = 0; j < headers.length; j++) {
      flatObj[headers[j]] = data[i][j];
    }
    // Add the actual row number.
    flatObj["row"] = i + 1;
    result.push(unflattenObject(flatObj));
  }
  return { columns: headers, data: result };
}

/**
 * Flattens a nested object using dot notation.
 * Example: { a: { b: "value" } } becomes { "a.b": "value" }.
 */
function flattenObject(obj, prefix) {
  var result = {};
  prefix = prefix ? prefix + "." : "";
  for (var key in obj) {
    if (!obj.hasOwnProperty(key)) continue;
    if (typeof obj[key] === "object" && obj[key] !== null && !Array.isArray(obj[key])) {
      var flatObject = flattenObject(obj[key], prefix + key);
      for (var subKey in flatObject) {
        if (flatObject.hasOwnProperty(subKey)) {
          result[subKey] = flatObject[subKey];
        }
      }
    } else {
      result[prefix + key] = obj[key];
    }
  }
  return result;
}

/**
 * Unflattens a flat object with dot notation into a nested object.
 */
function unflattenObject(data) {
  var result = {};
  for (var key in data) {
    if (!data.hasOwnProperty(key)) continue;
    var parts = key.split('.');
    var current = result;
    for (var i = 0; i < parts.length; i++) {
      if (i === parts.length - 1) {
        current[parts[i]] = data[key];
      } else {
        if (current[parts[i]] === undefined) {
          current[parts[i]] = {};
        }
        current = current[parts[i]];
      }
    }
  }
  return result;
}

/**
 * Updates the header row of the sheet with new keys from newData.
 * Merges existing headers with keys from newData (ignoring "sheet" and "row"),
 * and removes any empty header cells when the sheet is empty.
 */
function updateHeaders(sheet, newData) {
  var range = sheet.getDataRange();
  var values = range.getValues();
  var headers = [];
  if (values.length > 0) {
    headers = values[0].filter(function(h) { return h !== ""; });
  }
  var headerSet = {};
  for (var i = 0; i < headers.length; i++) {
    headerSet[headers[i]] = true;
  }
  var newKeys = Object.keys(newData).filter(function(key) {
    return key !== "sheet" && key !== "row";
  });
  var updated = false;
  for (var i = 0; i < newKeys.length; i++) {
    if (!headerSet[newKeys[i]]) {
      headers.push(newKeys[i]);
      headerSet[newKeys[i]] = true;
      updated = true;
    }
  }
  if (updated || values.length === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return headers;
}

/**
 * Inserts a record into the sheet.
 * Updates headers, appends a new row, verifies the insertion,
 * and then returns the full structured record (including the "row" number).
 */
function insertData(sheet, record) {
  var headers = updateHeaders(sheet, record);
  var row = headers.map(function(header) {
    return record[header] !== undefined ? record[header] : "";
  });
  sheet.appendRow(row);
  var lastRow = sheet.getLastRow();
  var insertedValues = sheet.getRange(lastRow, 1, 1, headers.length).getValues()[0];
  var flatInserted = {};
  for (var i = 0; i < headers.length; i++) {
    flatInserted[headers[i]] = insertedValues[i];
  }
  flatInserted["row"] = lastRow;
  var structured = unflattenObject(flatInserted);

  // Verify the insertion by comparing the values.
  for (var i = 0; i < headers.length; i++) {
    if (row[i] != insertedValues[i]) {
      throw new Error("Insertion verification failed on header: " + headers[i]);
    }
  }
  return { inserted: structured, columns: headers };
}

/**
 * Updates a record in the sheet.
 * Expects a "row" key in params to identify which row to update.
 * Returns the updated structured record.
 */
function updateData(sheet, params) {
  if (!params.row) {
    throw new Error("Missing 'row' parameter for update");
  }
  var rowNum = Number(params.row);
  // Remove 'row' from update fields.
  var updateFields = Object.assign({}, params);
  delete updateFields.row;
  var headers = updateHeaders(sheet, updateFields);
  var data = sheet.getDataRange().getValues();
  if (rowNum < 2 || rowNum > data.length) {
    throw new Error("Row not found");
  }
  // Update each cell for which an update field exists.
  for (var j = 0; j < headers.length; j++) {
    if (updateFields[headers[j]] !== undefined) {
      sheet.getRange(rowNum, j + 1).setValue(updateFields[headers[j]]);
    }
  }
  var updatedValues = sheet.getRange(rowNum, 1, 1, headers.length).getValues()[0];
  var flatUpdated = {};
  for (var j = 0; j < headers.length; j++) {
    flatUpdated[headers[j]] = updatedValues[j];
  }
  flatUpdated["row"] = rowNum;
  var structured = unflattenObject(flatUpdated);
  return { updated: structured, columns: headers };
}

/**
 * Deletes record(s) from the sheet.
 * Supports deletion by explicit "row" or by filtering with other keys.
 * Returns the full structured deleted record(s) (including "row").
 */
function deleteData(sheet, params) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 1) return { error: "Sheet is empty", columns: [] };

  var headers = data[0].filter(function(h) { return h !== ""; });
  var deletedRecords = [];

  if (params.row) {
    // Delete by explicit row number.
    var rowNum = Number(params.row);
    if (rowNum < 2 || rowNum > data.length) {
      throw new Error("Row not found");
    }
    var rowData = sheet.getRange(rowNum, 1, 1, headers.length).getValues()[0];
    var record = {};
    for (var i = 0; i < headers.length; i++) {
      record[headers[i]] = rowData[i];
    }
    record["row"] = rowNum;
    deletedRecords.push(unflattenObject(record));
    sheet.deleteRow(rowNum);
  } else {
    // Delete by filters: use all keys in params as filters.
    var filters = {};
    for (var key in params) {
      if (params.hasOwnProperty(key)) {
        filters[key] = params[key];
      }
    }
    // Read all data.
    var allData = readData(sheet).data;
    // Find matching records.
    var matchingRecords = applyFilters(allData, filters);
    // Delete rows from bottom to top.
    var rowsToDelete = matchingRecords.map(function(rec) { return rec.row; });
    rowsToDelete.sort(function(a, b) { return b - a; });
    for (var i = 0; i < rowsToDelete.length; i++) {
      var r = rowsToDelete[i];
      var rowData = sheet.getRange(r, 1, 1, headers.length).getValues()[0];
      var record = {};
      for (var j = 0; j < headers.length; j++) {
        record[headers[j]] = rowData[j];
      }
      record["row"] = r;
      deletedRecords.push(unflattenObject(record));
      sheet.deleteRow(r);
    }
  }
  return { deleted: deletedRecords, columns: headers };
}

/**
 * Applies filters to an array of records.
 * Each key in filters is compared against the flattened record.
 */
function applyFilters(records, filters) {
  return records.filter(function(record) {
    var flatRecord = flattenObject(record);
    for (var key in filters) {
      if (filters.hasOwnProperty(key)) {
        // Compare with loose equality; for more advanced filtering (e.g., >, <) you can extend this logic.
        if (flatRecord[key] != filters[key]) {
          return false;
        }
      }
    }
    return true;
  });
}

/**
 * Helper function to output a JSON response.
 * The response is terminated with a newline.
 */
function outputJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data) + "\n")
    .setMimeType(ContentService.MimeType.JSON);
}
