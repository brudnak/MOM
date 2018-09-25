const express = require('express');
const custRouter = express.Router();
const custController = require('../controllers/custController');
const { displayCust, displayCustSearch } = custController();

custRouter.route('/')
    .get((req, res) => {
        res.render('custSearch');
    });

custRouter.route('/search')
    .get(displayCustSearch);

custRouter.route('/:custnum')
    .get(displayCust);

module.exports = custRouter;