const fetch = require('node-fetch').default;

/**
 * @typedef {Object} Springboard
 * @property {string} subDomain
 * @property {string} token
 */

/**
 * @typedef {Function} RecordConsumer
 * @param {Object} record - a record in the paginated collection.
 * @param {Function} cancel - stops iteration over the collection.
 * @returns {undefined} any output returned from the consumer will be ignored
 */

/**
 * Iterates over a Springboard Retail paginated collection.
 * @param {Springboard} springboard the instance of Springboard to fetch the collection from
 * @param {string} path relative path to the collection
 * @param {RecordConsumer} consumer invoked once for every item in the list
 * @returns {Promise<void>} resolves after all records have been iterated over or a {@link RecordConsumer} cancels iteration.
 */
const iteratePaginatedList = async (springboard, path, consumer) => {
    // The absolute URL of the Springboard Retail collection.
    // This is before any iteration query parameters have been interpolated.
    const baseUrl = `https://${springboard.subDomain}.myspringboard.us/api/${path}`;

    // The page that we are currently on.
    // Zero if iteration has not started yet.
    let page = 0;

    // The total number of pages in this collection. There will always be at least once page,
    // though it may be empty.
    let pages = 1;

    // Run until we've iterated over every single page.
    while (page < pages) {

        // The url to this page in the collection. This is the baseUrl but with iteration query parameters.
        let url = baseUrl;

        // Adds a query parameter to the end of the URL.
        const appendQueryParam = (key, value) =>
            url += (url.includes('?') ? '&' : '?') + `${key}=${value}`;

        appendQueryParam('page', ++page);

        const authorizationHeader = { 'Authorization': `Bearer ${springboard.token}` };

        const data = await fetch(url, { headers: authorizationHeader })
            .then(response => response.json());

        if (data.error) throw new Error(data.error);

        // Update the pages count. The collection might have expanded or contracted while we iterated
        // over the elements on the current page.
        pages = data['pages'];

        // Invoke the consumer for each element on the page.
        for (const element of data.results) {
            let isCancelled = false;
            const cancel = () => isCancelled = true;

            consumer(element, cancel);

            // If the consumer cancelled iteration, return from the function and forgo any more pages or element.
            if (isCancelled) return;
        }
    }
};


/**
 * Returns all the members of a paginated list at once. Only use this on small list.
 * @param {Springboard} springboard the instance of Springboard to fetch the collection from
 * @param {string} path relative path to the collection
 * @returns {Promise<[]>} the results stored in the collection
 */
const getPaginatedList = async (springboard, path) => {
    const compilation = [];

    const consumer = (element, _) => {
        compilation.push(element)
    };

    await iteratePaginatedList(springboard, path, consumer);

    return compilation;
};

module.exports = { iteratePaginatedList, getPaginatedList }
