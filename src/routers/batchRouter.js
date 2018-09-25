const express = require('express');
const batchRouter = express.Router();
const batchController = require('../controllers/batchController');
const { displayStage1, displayStage89 } = batchController();

batchRouter.route('/')
    .get((req, res) => {
        res.render('batchHome');
    });
    
batchRouter.route('/stage1')
    .get(displayStage1);

batchRouter.route('/stage8-9')
    .get(displayStage89);

module.exports = batchRouter;