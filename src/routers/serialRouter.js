const express = require('express');
const serialRouter = express.Router();

// display field to search serial number
// or search serials for SKU
// or search serials for SKU sold between dates
// serialRouter.route('/');

// report serial number information:
// serialRouter.route('/:serial')

// report serials for SKU:
// serialRouter.route('/sku/:sku')

// report serials sold between dates:
// ?sku=___&startDate=___&endDate=___
// serialRouter.route('/report') 

module.exports = serialRouter;