const fetch = require('node-fetch').default;
const retry = require('p-retry');

/**
 * @typedef {Object} Springboard
 * @property {string} subDomain
 * @property {string} token
 */

/**
 * @typedef {Object} Cursor
 * @description Represents the iterator's current position in the collection.
 * @property {int} page
 * @property {Springboard} springboard - the Springboard instance that contains this collection
 * @property {string} path - the url to this collection (Relative to the root API endpoint)
 */

/**
 * @typedef {Function} PageConsumer
 * @param {Array} elements - all elements on the the current page
 * @param {Cursor} cursor - the current position in the collection
 * @param {Function} cancel - stops iteration over the collection.
 * @returns {undefined} any output returned from the consumer will be ignored
 */

/**
 * Iterates over each page in the collection.
 * @param springboard - the Springboard Retail instance containing this collection.
 * @param path - the path to the collection (relative to the root API endpoint). Can also contain query parameters.
 * @param {PageConsumer} consumer - a function that processes each page in the collection
 * @return {Promise<void>} the returned promise resolves after the consumer has been invoked on each page in the collection.
 */
const iteratePages = async (springboard, path, consumer) => {
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

        const fetchPage = () => fetch(url, { headers: authorizationHeader })
            .then(response => response.json());

        // Retry a couple of times in case some one-off network error occurred.
        const data = await retry(fetchPage, { retries: 5 });

        if (data.error) throw new Error(data.error);

        // Update the pages count. The collection might have expanded or contracted while we iterated
        // over the elements on the current page.
        pages = data['pages'];

        // Pass the page to the consumer for processing.
        {
            const cursor = { page, springboard, path };
            let isCancelled = false;
            const cancel = () => isCancelled = true;

            consumer(data.results, cursor, cancel);

            if (isCancelled) return
        }
    }
};


/**
 * @typedef {Function} ElementConsumer
 * @param {Object} record - a record in the paginated collection.
 * @param {Function} cancel - stops iteration over the collection.
 * @returns {undefined} any output returned from the consumer will be ignored
 */

/**
 * Iterates over a Springboard Retail paginated collection.
 * @param {Springboard} springboard the instance of Springboard to fetch the collection from
 * @param {string} path relative path to the collection
 * @param {ElementConsumer} consumer invoked once for every item in the list
 * @returns {Promise<void>} resolves after all records have been iterated over or a {@link ElementConsumer} cancels iteration.
 */
const iterate = (springboard, path, consumer) => {
    const pageConsumer = (elements, cursor, cancel) => {
        for (const element of elements) {
            let isCancelled = false;
            const innerCancel = () => isCancelled = true;

            consumer(element, innerCancel);

            if (isCancelled) {
                // If the ElementConsumer cancelled iteration, we must cancel the page iterator.
                cancel();

                // The ElementConsumer cancelled iteration, do not pass anymore elements to it.
                break;
            }
        }
    };

    return iteratePages(springboard, path, pageConsumer);
};


/**
 * Returns all the members of a paginated list at once. Only use this on small list.
 * @param {Springboard} springboard the instance of Springboard to fetch the collection from
 * @param {string} path relative path to the collection
 * @returns {Promise<[]>} the results stored in the collection
 */
const getAll = async (springboard, path) => {
    const compilation = [];

    const consumer = (element, _) => {
        compilation.push(element)
    };

    await iterate(springboard, path, consumer);

    return compilation;
};

module.exports = { iteratePages, iterate, getAll };
