const express = require('express');
const itemRouter = express.Router();
const itemController = require('../controllers/itemController');
const { displayItem, displayItemSearch } = itemController();

itemRouter.route('/')
    .get((req, res) => {
        res.render('itemSearch')
    });

itemRouter.route('/search')
    .get(displayItemSearch);

itemRouter.route('/:sku')
    .get(displayItem);

module.exports = itemRouter;