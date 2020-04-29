# springboard-pagination-tool
Iterate over Springboard Retail paginated collections.

## Example
```js
const { iterate, getAll } = require('./index'); // You would write: springboard-pagination-tool

const springboard = {
    subDomain: 'examplestore123',
    token: '123456789'
};

// Iterate over a collection. 
// Useful for larger collections.
iterate(springboard, 'items', (item, cancel) => {
    // Do something for every item.
    
    // Optionally, you can stop the iteration prematurely...
    // Just invoke: cancel();
});

// Save a collection to array.
// Only use on small collections.
(async () => {
    const vendors = await getAll(springboard, 'purchasing/vendors');
    
    for (const vendor of vendors) {
        // Do something for every vendor.
    }

})();

```
