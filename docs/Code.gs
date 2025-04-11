/**
 * Google Apps Script: Spreadsheet API as DB
 *
 * Endpoints:
 *   GET /list              - Retrieves data with optional filtering
 *   POST /insert           - Inserts a new record
 *   POST /update           - Updates a record or multiple records with match filter
 *   POST /delete           - Deletes a record or multiple records with match filter
 *
 * All responses are in JSON format (terminated with a newline).
 *
 * Advanced filtering:
 * - Simple params: /list?name=John&age=30
 * - Advanced filter: /list?filter=age>20 AND name CONTAINS "John"
 *
 * Match filtering for update and delete:
 * - Update multiple records: {"match": "age>30", "status": "active"}
 * - Delete multiple records: {"match": "status='inactive'"}
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

      // Check if an advanced filter was provided
      if (e.parameter && e.parameter.filter) {
        var jsFilter = translateFilterToJs(e.parameter.filter);
        dataObj.data = applyAdvancedFilter(dataObj.data, jsFilter);
        return outputJSON({
          sheet: sheet.getName(),
          filter: e.parameter.filter,
          translated_filter: jsFilter,
          columns: dataObj.columns,
          data: dataObj.data
        });
      }

      // Otherwise use the legacy filtering system
      var filters = {};
      for (var key in e.parameter) {
        if (key && e.parameter.hasOwnProperty(key) && key !== "sheet" && key.indexOf("$") !== 0) {
          filters[key] = e.parameter[key];
        }
      }
      if (Object.keys(filters).length > 0) {
        dataObj.data = applyFilters(dataObj.data, filters);
      }

      return outputJSON({
        sheet: sheet.getName(),
        filters: filters,
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
      // Check if a match filter was provided for updating multiple records
      if (params.match) {
        var matchFilter = params.match;
        delete params.match; // Remove match from fields to update

        var result = updateMultipleData(sheet, params, matchFilter);
        return outputJSON({
          sheet: sheet.getName(),
          match: matchFilter,
          columns: result.columns,
          updatedCount: result.updatedCount,
          data: result.updated
        });
      } else {
        // Fallback to original row-based update logic
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
    }

    if (action === "delete") {
      // Check if a match filter was provided for deleting multiple records
      if (params.match) {
        var matchFilter = params.match;
        delete params.match;

        var result = deleteMultipleData(sheet, matchFilter);
        return outputJSON({
          sheet: sheet.getName(),
          match: matchFilter,
          columns: result.columns,
          deletedCount: result.deletedCount,
          data: result.deleted
        });
      } else {
        // Fallback to original deletion logic
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
 * Updates multiple records that match a filter expression
 *
 * @param {Sheet} sheet - The sheet to update
 * @param {Object} updateData - The data to update
 * @param {string} matchFilter - The filter expression to select records
 * @return {Object} Result with updated records
 */
function updateMultipleData(sheet, updateData, matchFilter) {
  // Read all data from the sheet
  var dataObj = readData(sheet);

  // Translate the filter to JavaScript if it's in natural language format
  var jsFilter = translateFilterToJs(matchFilter);

  // Apply the filter to find matching records
  var matchingRecords = applyAdvancedFilter(dataObj.data, jsFilter);

  if (matchingRecords.length === 0) {
    return {
      columns: dataObj.columns,
      updatedCount: 0,
      updated: []
    };
  }

  var updatedRecords = [];

  // Update each matching record
  for (var i = 0; i < matchingRecords.length; i++) {
    var record = matchingRecords[i];
    var rowNum = record.row;

    // Create an update object with the row
    var updateObj = Object.assign({}, updateData, { row: rowNum });

    // Call the existing update function
    var result = updateData(sheet, updateObj);
    if (!result.error) {
      updatedRecords.push(result.updated);
    }
  }

  return {
    columns: dataObj.columns,
    updatedCount: updatedRecords.length,
    updated: updatedRecords
  };
}

/**
 * Deletes multiple records that match a filter expression
 *
 * @param {Sheet} sheet - The sheet to delete from
 * @param {string} matchFilter - The filter expression to select records
 * @return {Object} Result with deleted records
 */
function deleteMultipleData(sheet, matchFilter) {
  // Read all data from the sheet
  var dataObj = readData(sheet);

  // Translate the filter to JavaScript if it's in natural language format
  var jsFilter = translateFilterToJs(matchFilter);

  // Apply the filter to find matching records
  var matchingRecords = applyAdvancedFilter(dataObj.data, jsFilter);

  if (matchingRecords.length === 0) {
    return {
      columns: dataObj.columns,
      deletedCount: 0,
      deleted: []
    };
  }

  // Sort records by row, in descending order
  // This is important to delete rows from bottom to top
  // and not interfere with row indices
  matchingRecords.sort(function(a, b) {
    return b.row - a.row;
  });

  var deletedRecords = [];

  // Delete each matching record
  for (var i = 0; i < matchingRecords.length; i++) {
    var record = matchingRecords[i];
    var rowNum = record.row;

    // Get row data before deleting it
    var rowData = sheet.getRange(rowNum, 1, 1, dataObj.columns.length).getValues()[0];
    var recordData = {};
    for (var j = 0; j < dataObj.columns.length; j++) {
      recordData[dataObj.columns[j]] = rowData[j];
    }
    recordData.row = rowNum;
    deletedRecords.push(unflattenObject(recordData));

    // Delete the row
    sheet.deleteRow(rowNum);
  }

  return {
    columns: dataObj.columns,
    deletedCount: deletedRecords.length,
    deleted: deletedRecords
  };
}

/**
 * Translates a filter expression written in natural language to JavaScript
 *
 * @param {string} filter - The natural language filter expression
 * @return {string} The JavaScript filter expression
 */
function translateFilterToJs(filter) {
  if (!filter) return '';

  // If the filter already looks like JavaScript, return it directly
  if (typeof filter === 'string' && (
      filter.indexOf('&&') >= 0 ||
      filter.indexOf('||') >= 0 ||
      filter.indexOf('===') >= 0 ||
      filter.match(/[^=!<>]=[^=]/)
  )) {
    return filter;
  }

  // Define translations (from natural operator to JavaScript operator)
  const translations = [
    // Logical operators
    { from: / AND /gi,   to: ' && ' },
    { from: / OR /gi,    to: ' || ' },
    { from: / NOT /gi,   to: ' !' },

    // Comparison operators with words
    { from: / IS NULL/gi,     to: ' === null' },
    { from: / IS NOT NULL/gi, to: ' !== null' },
    { from: / IS EMPTY/gi,    to: ' === ""' },
    { from: / IS NOT EMPTY/gi, to: ' !== ""' },
    { from: / IS /gi,         to: ' === ' },
    { from: / IS NOT /gi,     to: ' !== ' },
    { from: / EQUALS /gi,     to: ' === ' },
    { from: / NOT EQUALS /gi, to: ' !== ' },
    { from: / CONTAINS /gi,   to: '.includes(' },
    { from: / NOT CONTAINS /gi, to: '!.includes(' },
    { from: / STARTS WITH /gi, to: '.startsWith(' },
    { from: / ENDS WITH /gi,   to: '.endsWith(' },

    // Operator aliases
    { from: /\band\b/gi,  to: ' && ' },
    { from: /\bor\b/gi,   to: ' || ' },
    { from: /\bnot\b/gi,  to: ' !' },
    { from: /\bis\b/gi,   to: ' === ' },

    // Support for comparison operators without spaces
    { from: /([a-zA-Z0-9_."\'])(>=|<=|!=|==|>|<)([a-zA-Z0-9_."\'])/g,
      to: function(match, p1, op, p3) {
        return p1 + ' ' + op + ' ' + p3;
      }
    }
  ];

  // Apply all translations
  let result = ' ' + filter + ' '; // Add spaces to make regex easier

  for (const t of translations) {
    if (typeof t.to === 'function') {
      result = result.replace(t.from, t.to);
    } else {
      result = result.replace(t.from, t.to);
    }
  }

  // Special handling for CONTAINS, STARTS WITH, ENDS WITH
  // which require a closing parenthesis
  result = result.replace(/\.includes\(([^)]*?)(?!\))/g, '.includes($1)');
  result = result.replace(/\.startsWith\(([^)]*?)(?!\))/g, '.startsWith($1)');
  result = result.replace(/\.endsWith\(([^)]*?)(?!\))/g, '.endsWith($1)');

  // Handle unquoted string values
  // Look for words that aren't already in quotes and aren't numbers or operators
  result = result.replace(/([=!<>]=?|startsWith\(|endsWith\(|includes\()[ ]*([a-zA-Z][a-zA-Z0-9_]*)(?!["\'])/g,
    function(match, op, word) {
      // Check if the word is a boolean, null or undefined
      if (word === 'true' || word === 'false' || word === 'null' || word === 'undefined') {
        return op + ' ' + word;
      }
      // Otherwise, wrap it in quotes
      return op + ' "' + word + '"';
    }
  );

  return result.trim();
}

/**
 * Applies an advanced filter based on JavaScript expressions
 *
 * @param {Array} records - Array of records to filter
 * @param {string} filterExpression - JavaScript filter expression
 * @return {Array} Filtered records that satisfy the expression
 */
function applyAdvancedFilter(records, filterExpression) {
  // Sanitize the expression for security
  var sanitizedExpression = sanitizeFilterExpression(filterExpression);

  return records.filter(function(record) {
    try {
      // Flatten the record to support access to nested properties
      var flatRecord = flattenObject(record);

      // Create a dynamic function that evaluates the expression in the context of the record
      var keys = Object.keys(flatRecord);
      var values = Object.values(flatRecord);

      // Add support functions
      keys.push('isEmpty');
      values.push(function(val) { return val === null || val === undefined || val === ''; });

      // For CONTAINS, STARTS WITH, ENDS WITH support
      // Convert all values to strings (if possible) for these methods
      for (let i = 0; i < values.length; i++) {
        if (values[i] !== null && values[i] !== undefined) {
          // Add String methods to all non-null values
          if (typeof values[i] !== 'string') {
            const originalValue = values[i];
            // Create a proxy that allows access to String methods
            values[i] = new Proxy(originalValue, {
              get: function(target, prop) {
                if (prop === 'includes' || prop === 'startsWith' || prop === 'endsWith') {
                  return String.prototype[prop].bind(String(target));
                }
                return target[prop];
              }
            });
          }
        }
      }

      // Create a function that evaluates the expression
      var evalFunc = new Function(...keys, `try { return ${sanitizedExpression}; } catch(e) { console.error(e); return false; }`);

      // Execute the function with the record values
      return evalFunc(...values);
    } catch (e) {
      console.error('Error evaluating filter expression:', e);
      return false;
    }
  });
}

/**
 * Sanitizes a filter expression to prevent code injection
 * This is a basic approach and should be improved for production
 *
 * @param {string} expression - The filter expression
 * @return {string} The sanitized expression
 */
function sanitizeFilterExpression(expression) {
  // Remove dangerous characters and potential injection attempts
  expression = expression.replace(/[;\{\}]|new\s+|eval|Function|setTimeout|setInterval|document|window|global|constructor/gi, '');

  // Allow only safe operators and method calls
  return expression;
}

/**
 * Helper function to check if a value is empty
 * @param {*} value - The value to check
 * @return {boolean} true if the value is empty, otherwise false
 */
function isEmpty(value) {
  return value === null || value === undefined || value === '';
}

/**
 * Helper function to output a JSON response.
 * The response is terminated with a newline.
 */
function outputJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data) + "\n")
    .setMimeType(ContentService.MimeType.JSON);
}