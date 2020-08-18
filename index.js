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
 * @property {string} subDomain - the Springboard instance that contains this collection
 * @property {string} path - the url to this collection (Relative to the root API endpoint)
 */

/**
 * @param {Springboard} springboard - the instance of Springboard Retail to get the page from.
 * @param  {Cursor} cursor - cursor pointing to the page you wish to retrieve
 * @return {Promise<Object>} deserialized JSON response returned by Springboard Retail.
 */
const getRawPage = async (springboard, cursor) => {
    // The absolute URL of the Springboard Retail collection.
    let url = `https://${springboard.subDomain}.myspringboard.us/api/${cursor.path}`;

    // Adds a query parameter to the end of the URL.
    const appendQueryParam = (key, value) =>
        url += (url.includes('?') ? '&' : '?') + `${key}=${value}`;

    appendQueryParam('page', cursor.page);

    const authorizationHeader = { 'Authorization': `Bearer ${springboard.token}` };

    const fetchPage = () => fetch(url, { headers: authorizationHeader })
        .then(response => response.json());

    // Retry a couple of times in case some one-off network error occurred.
    const data = await retry(fetchPage, { retries: 5 });

    if (data.error) throw new Error(data.error);

    return data
};

/**
 * @typedef {Function} PageConsumer
 * @param {Array} elements - all elements on the the current page
 * @param {Function} cancel - stops iteration over the collection.
 * @returns {undefined} any output returned from the consumer will be ignored
 */

/**
 * Iterates over every page in the collection.
 * @param {Springboard} springboard - the Springboard Retail instance containing this collection.
 * @param path - the path to the collection (relative to the root API endpoint). Can also contain query parameters.
 * @param {PageConsumer} consumer - a function that processes each page in the collection
 * @return {Promise<void>} the returned promise resolves after the consumer has been invoked on each page in the collection.
 */
const iteratePages = async (springboard, path, consumer) => {
    // The page that we are currently on.
    // Zero if iteration has not started yet.
    let page = 0;

    // The total number of pages in this collection. There will always be at least once page,
    // though it may be empty.
    let pages = 1;

    // Run until we've iterated over every single page.
    while (page < pages) {
        const cursor = {
            page: ++page,
            subDomain: springboard.subDomain,
            path
        };

        const data = await getRawPage(springboard, cursor);

        // Update the pages count. The collection might have expanded or contracted while we iterated
        // over the elements on the current page.
        pages = data['pages'];

        // Pass the page to the consumer for processing.
        {
            let isCancelled = false;
            const cancel = () => isCancelled = true;

            await consumer(data.results, cancel);

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
 * Iterates over each element in a Springboard Retail paginated collection.
 * @param {Springboard} springboard the instance of Springboard to fetch the collection from
 * @param {string} path relative path to the collection
 * @param {ElementConsumer} consumer invoked once for every item in the list
 * @returns {Promise<void>} resolves after all records have been iterated over or a {@link ElementConsumer} cancels iteration.
 */
const iterate = (springboard, path, consumer) => {
    const pageConsumer = async (elements, cancel) => {
        for (const element of elements) {
            let isCancelled = false;
            const innerCancel = () => isCancelled = true;

            await consumer(element, innerCancel);

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

/**
 * @typedef {Object} PageData
 * @property {Cursor|null} next - a cursor that points to the next page in the collection. Null if this is the last page.
 *  Pass the cursor to {@link getPage} to get subsequent pages.
 * @property {Array} elements - an array of the elements on this page
 */

/**
 * Returns the collection page that corresponds to the given cursor.
 * @param {Springboard} springboard - the instance of Springboard Retail to get the page from.
 * @param {Cursor} cursor
 * @return {Promise<PageData>}
 */
const getPage = async (springboard, cursor) => {
    if (cursor.subDomain !== springboard.subDomain)
        throw new Error('The given Springboard instance can\'t be used to access that cursor.');

    const rawPageData = await getRawPage(springboard, cursor);

    const pageData = {
        /** @type {Cursor|null} */
        next: null,

        /** @type {Array} */
        elements: rawPageData.results
    };

    if (cursor.page < rawPageData['pages']) {
        pageData.next = Object.assign({}, cursor);
        pageData.next.page++;
    }

    return pageData;
 };

/**
 * Returns the first page of a Springboard Retail collection.
 * @param {Springboard} springboard - the instance of Springboard Retail to fetch the collection from
 * @param {string} path - the relative path to the collection
 * @return {Promise<PageData>}
 */
const getFirstPage = (springboard, path) =>
    getPage(springboard, {
        page: 1,
        subDomain: springboard.subDomain,
        path
    });

module.exports = { iteratePages, iterate, getAll, getPage, getFirstPage };
