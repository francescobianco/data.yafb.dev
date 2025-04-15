
const { describe, it, expect, beforeAll } = require('@jest/globals');

describe('API List Test', () => {


    it('insert and create sheet', async () => {
        const insertResponse = await dataClient.insert({
            sheet: sheetName,
            data: {
                name: 'Test Record',
                value: 42
            }
        });

        console.log(insertResponse);

        expect(insertResponse).toHaveProperty('data');
    });
});
