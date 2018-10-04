const express = require('express');
const shipRouter = express.Router();
const shipController = require('../controllers/shipController');
const { displayOrders, displayExportOrders } = shipController();

shipRouter.route('/')
    .get(displayOrders);

shipRouter.route('/export')
    .get(displayExportOrders);

module.exports = shipRouter;