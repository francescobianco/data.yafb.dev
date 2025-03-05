# data.alterloop.dev

# Google Spreadsheet API with Google Apps Script

This project allows you to use a Google Spreadsheet as a database and interact with it via a REST API. The API supports operations such as listing, inserting, updating, and deleting records.

## Deployment Steps

### 1. Create Your Google Spreadsheet
1. Go to [Google Sheets](https://docs.google.com/spreadsheets/).
2. Create a new spreadsheet.
3. Name the sheet (e.g., `Database`).
4. In the first row, define the column names (e.g., `id`, `name`, `email`).

### 2. Open Google Apps Script
1. Click on **Extensions** → **Apps Script**.
2. Delete any existing code.
3. Copy and paste the provided Apps Script code.

### 3. Configure Script Permissions
1. Click **Deploy** → **New Deployment**.
2. Select **Web app** as the deployment type.
3. Set **Who has access** to "Anyone".
4. Click **Deploy** and authorize the script.

### 4. Get Your API URL
After deployment, you will get a URL like:
```
https://script.google.com/macros/s/your-script-id/exec
```
Use this URL to interact with your API.

### 5. API Endpoints
- `GET /list` → Retrieve all records
- `POST /insert` → Add a new record
- `POST /update` → Update an existing record
- `POST /delete` → Remove a record

### 6. Example Request
```bash
curl -X GET "https://script.google.com/macros/s/your-script-id/exec?action=list"
```

Now your Google Spreadsheet is a fully functional database API! 🚀


## Proxy 

This echo server is used to test the proxy server. It is hosted on Google Apps Script.

```
function doGet(request) {
    const response = ContentService.createTextOutput(JSON.stringify(request, null, 2));
    response.setMimeType(ContentService.MimeType.JSON);
    return response
}

function doPost(request) {
    const response = ContentService.createTextOutput(JSON.stringify(request, null, 2));
    response.setMimeType(ContentService.MimeType.JSON);
    return response
}
```
