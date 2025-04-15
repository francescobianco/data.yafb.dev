
const { describe, it, expect, beforeAll } = require('@jest/globals');

describe('api -> delete', () => {
    let insertedRow;

    beforeAll(async () => {
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
        const listResponse = await apiClient.get(`/list?sheet=${sheetName}`);
        expect(listResponse.status).toBe(200);
        expect(listResponse.data.data.some(record => record.row === insertedRow)).toBe(true);

        const deleteResponse = await apiClient.post('/delete', {
            sheet: sheetName,
            row: insertedRow
        });
        expect(deleteResponse.status).toBe(200);

        const listAfterDelete = await apiClient.get(`/list?sheet=${sheetName}`);
        expect(listAfterDelete.status).toBe(200);
        expect(listAfterDelete.data.data.some(record => record.row === insertedRow)).toBe(false);
    });
});
