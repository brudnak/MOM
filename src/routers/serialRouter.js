const express = require('express');
const serialRouter = express.Router();
const serialController = require('../controllers/serialController');

// display field to search serial number
// or search serials for SKU
// or search serials for SKU sold between dates
serialRouter.route('/')
    .get((req, res) => {
        res.render('serialSearch');
    });

// search serials by SKU, partial serial number, status:
serialRouter.route('/search')
    .get(serialController().displaySerialSearch);

// report duplicate serial numbers:
// serialRouter.route('/duplicates')

// report serials sold between dates:
// ?sku=___&startDate=___&endDate=___
// serialRouter.route('/report') 

module.exports = serialRouter;