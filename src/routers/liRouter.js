const express = require('express');
const liRouter = express.Router();
const liController = require('../controllers/liController');
const { displayLineItems } = liController();

liRouter.route('/')
    .get((req, res) => {
        res.render('lineitemSearch');
    });

liRouter.route('/:itemStatus/:SKUs')
    .get(displayLineItems);

module.exports = liRouter;