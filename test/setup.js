require('dotenv').config();
const axios = require('axios');

const { createDataClient } = require('../index.js');

global.DATA_URL = process.env.DATA_URL;
global.DATA_SECRET = process.env.DATA_SECRET;
global.createDataClient = createDataClient;
global.dataClient = createDataClient(process.env.DATA_SECRET);
global.sheetName = `test_sheet_${Date.now()}`;
global.apiClient = axios.create({
    baseURL: DATA_URL,
    timeout: 60000,
    headers: { Secret: DATA_SECRET }
});

jest.setTimeout(60000);

