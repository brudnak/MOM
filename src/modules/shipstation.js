const btoa = require("btoa");

const ssKey = process.env.SS_KEY;
const ssSecret = process.env.SS_SECRET;
const encoded = btoa(`${ssKey}:${ssSecret}`);


module.exports = encoded;