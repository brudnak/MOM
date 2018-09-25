const express = require('express');
const apRouter = express.Router();
const apController = require('../controllers/apController');
const { displayAps, displayApsSearch } = apController(); 

apRouter.route('/')
    .get((req, res) => {
        res.render('apSearch');
    });

apRouter.route('/search')
    .get(displayApsSearch);

module.exports = apRouter;