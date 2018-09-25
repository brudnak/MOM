const express = require('express');
const poRouter = express.Router();
const poController = require('../controllers/poController');
const { displayPO, displayPOsSearch } = poController();

poRouter.route('/')
    .get((req, res) => {
        res.render('poSearch');
    });

poRouter.route('/search')
    .get(displayPOsSearch);

poRouter.route('/:ponumber')
    .get(displayPO);

module.exports = poRouter;