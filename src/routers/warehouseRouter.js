const express = require('express');
const warehouseRouter = express.Router();
const warehouseController = require('../controllers/warehouseController');
const { sendWarehouseLog } = warehouseController(); 

warehouseRouter.route('/')
    .get((req, res) => {
        res.render('warehouseLogForm');
    });

warehouseRouter.route('/sendLog')
    .get(sendWarehouseLog); 

module.exports = warehouseRouter;