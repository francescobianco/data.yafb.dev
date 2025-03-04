# data.alterloop.dev

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
