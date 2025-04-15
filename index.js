/**
 *
 * @param deploymentId
 * @returns {string}
 */
function generateUrl(deploymentId, api, queryParams = {}) {
    if (!deploymentId) {
        throw new Error('Missing DEPLOYMENT_ID');
    }

    queryParams['$REQUEST_URI'] = `/${api}`;

    const queryParamsString = new URLSearchParams(queryParams).toString();

    return `https://script.google.com/macros/s/${deploymentId}/exec?${queryParamsString}`;
}

/**
 * Crea un client per comunicare con un'API Tupi usando un deployment ID
 * @param {string} deploymentId
 * @returns {object} client con metodi list, insert, update, remove
 */
function createDataClient(deploymentId) {
    if (!deploymentId) {
        throw new Error('Missing DEPLOYMENT_ID');
    }

    return {
        async list() {
            const url = generateUrl(deploymentId, 'list', {});

            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            });

            if (!response.ok) throw new Error('Failed to fetch list');

            return response.json();
        },

        async insert(data) {
            const url = generateUrl(deploymentId, 'insert', {});

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            if (!response.ok) throw new Error('Failed to insert data');

            return response.json();
        },

        /*
        async update(id, data) {
            const res = await fetch(`${baseUrl}/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to update data');
            return res.json();
        },

        async remove(id) {
            const res = await fetch(`${baseUrl}/${id}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('Failed to delete data');
            return true;
        },*/
    };
}

module.exports = { createDataClient };
