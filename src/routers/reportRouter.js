const express = require('express');
const reportRouter = express.Router();
const reportController = require('../controllers/reportController');
const { displayProfitPOs, displayProfitLineItems, displayProfitOrders, displayBackorder, displayBackorderSKU, displayShippedProfitOrders, displayRTSProfitOrders } = reportController();

reportRouter.route('/')
    .get((req, res) => {
        res.render('reports');
    });
    
reportRouter.route('/po')
    .get((req, res) => {
        res.render('reportsDropshipForm');
    });
reportRouter.route('/po/report')
    .get(displayProfitPOs);

reportRouter.route('/li')
    .get((req, res) => {
        res.render('reportsLIProfitForm');
    });
reportRouter.route('/li/:startDate-:endDate/:keys/:bottomDollar/:bottomPercent')
    .get(displayProfitLineItems);

reportRouter.route('/order')
    .get((req, res) => {
        res.render('reportsOrderProfitForm');
    })
reportRouter.route('/order/report') 
    .get(displayProfitOrders);

reportRouter.route('/shippedOrder')
    .get((req, res) => {
        res.render('reportsShippedOrderProfitForm');
    })
reportRouter.route('/shippedOrder/report') 
    .get(displayShippedProfitOrders);

reportRouter.route('/RTSOrder')
    .get((req, res) => {
        res.render('reportsRTSOrderProfitForm');
    })
reportRouter.route('/RTSOrder/report') 
    .get(displayRTSProfitOrders);

reportRouter.route('/backorder')
    .get(displayBackorder);
reportRouter.route('/backorder/:SKU')
    .get(displayBackorderSKU);

module.exports = reportRouter;