
const { describe, it, expect, beforeAll } = require('@jest/globals');

describe('lib -> list', () => {
    beforeAll(async () => {
        const insertResponse = await dataClient.insert({
            sheet: sheetName,
            data: { name: 'Test Record', value: 42 }
        });

        expect(insertResponse).toHaveProperty('data');
    });

    it('list all data inside a sheet', async () => {
        const listResponse = await dataClient.list({
            sheet: sheetName
        });

        expect(listResponse).toHaveProperty('data');
    });
});
