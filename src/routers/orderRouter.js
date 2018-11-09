const express = require('express');
const orderRouter = express.Router();
const orderController = require('../controllers/orderController')
const { displayOrder, displayOrderSearch, displayPrime } = orderController();

orderRouter.route('/')
	.get((req, res) => {
		res.render('orderSearch');
	});

orderRouter.route('/search')
	.get(displayOrderSearch);

orderRouter.route('/prime')
	.get(displayPrime);

orderRouter.route('/:orderno')
	.get(displayOrder);

module.exports = orderRouter;