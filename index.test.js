const { it } = require('mocha');
const { expect } = require('chai');
const fetch = require('node-fetch').default;

const index = require('./index');

const springboard = (() => {
    const fs = require('fs');

    // Read the credentials file.
    const rawText = fs.readFileSync('./springboard-credentials.json').toString();

    // Deserialize the Springboard object stored inside the credentials file.
    return JSON.parse(rawText);
})();

/**
 * Returns the length of a Springboard Retail paginated collection. That is, the number of elements in the collection.
 * @param {String} path - the relative path of the collection
 * @return {Promise<number>} a promise that resolves to the number of elements in the collection.
 */
const getCollectionLength = async (path) => {
    const authorizationHeader = { 'Authorization': `Bearer ${springboard.token}` };
    const data = await fetch(`https://${springboard.subDomain}.myspringboard.us/api/${path}`, { headers: authorizationHeader })
        .then(response => response.json());
    return data['total'];
};

it('iterates over every element', async function() {
    // We are performing some network operation...
    // This might take a minute.
    this.timeout(5000);

    const path = 'purchasing/vendors';

    let vendors;

    try {
        vendors = await index.getPaginatedList(springboard, path);
    } catch (error) {
        // The network is down, our Springboard token is invalid, etc.
        expect.fail(error.message);
    }

    // Verify the number of elements returned in the array matches the number of elements that exist
    // in Springboard Retail.
    const actualLength = await getCollectionLength(path);
    expect(vendors.length).equals(actualLength);
});

it('stops iterating when cancelled', async function () {
    const path = 'items';

    let totalElementsIterated = 0;

    await index.iteratePaginatedList(springboard, path, (element, cancel) => {
        totalElementsIterated++;
        cancel();
    });

    expect(totalElementsIterated).equals(1);
});
