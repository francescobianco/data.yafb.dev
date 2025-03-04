require('dotenv').config();
const axios = require('axios');
const { describe, it, expect, beforeAll } = require('@jest/globals');

const DATA_URL = process.env.DATA_URL;
const DATA_SECRET = process.env.DATA_SECRET;

const apiClient = axios.create({
    baseURL: DATA_URL,
    timeout: 60000, // Imposta timeout a 60 secondi
    headers: { Secret: DATA_SECRET }
});

jest.setTimeout(60000);

describe('API Delete Test', () => {
    let sheetName = `test_sheet_${Date.now()}`;
    let insertedRow;

    beforeAll(async () => {
        // Inserisci un record di test
        const insertResponse = await apiClient.post('/insert', {
            sheet: sheetName,
            data: { name: 'Test Record', value: 42 }
        });

        expect(insertResponse.status).toBe(200);
        expect(insertResponse.data).toHaveProperty('data');
        expect(insertResponse.data.data).toHaveLength(1);

        insertedRow = insertResponse.data.data[0].row;
    });

    it('should delete the inserted record', async () => {
        // Verifica che il record sia stato inserito
        const listResponse = await apiClient.get(`/list?sheet=${sheetName}`);
        expect(listResponse.status).toBe(200);
        expect(listResponse.data.data.some(record => record.row === insertedRow)).toBe(true);

        // Cancella il record
        const deleteResponse = await apiClient.post('/delete', {
            sheet: sheetName,
            row: insertedRow
        });
        expect(deleteResponse.status).toBe(200);

        // Verifica che il record sia stato cancellato
        const listAfterDelete = await apiClient.get(`/list?sheet=${sheetName}`);
        expect(listAfterDelete.status).toBe(200);
        expect(listAfterDelete.data.data.some(record => record.row === insertedRow)).toBe(false);
    });
});
