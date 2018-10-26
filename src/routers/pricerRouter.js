const express = require('express');
const pricerRouter = express.Router();
const pricerController = require('../controllers/pricerController');
const { displayAmazonPricer } = pricerController();

pricerRouter.route('/')
    .get((req, res) => {
        res.render('pricerForm');
    })

pricerRouter.route('/amazon')
    .get(displayAmazonPricer);

module.exports = pricerRouter;