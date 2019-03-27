const express = require('express');
const reportRouter = express.Router();
const reportController = require('../controllers/reportController')();

reportRouter.route('/')
    .get((req, res) => {
        res.render('reports');
    });
    
reportRouter.route('/po')
    .get((req, res) => {
        res.render('reportsDropshipForm');
    });
reportRouter.route('/po/report')
    .get(reportController.displayProfitPOs);

reportRouter.route('/li')
    .get((req, res) => {
        res.render('reportsLIProfitForm');
    });
reportRouter.route('/li/:startDate-:endDate/:keys/:bottomDollar/:bottomPercent')
    .get(reportController.displayProfitLineItems);

reportRouter.route('/order')
    .get((req, res) => {
        res.render('reportsOrderProfitForm');
    })
reportRouter.route('/order/report') 
    .get(reportController.displayProfitOrders);

reportRouter.route('/shippedOrder')
    .get((req, res) => {
        res.render('reportsShippedOrderProfitForm');
    })
reportRouter.route('/shippedOrder/report') 
    .get(reportController.displayShippedProfitOrders);

reportRouter.route('/RTSOrder')
    .get((req, res) => {
        res.render('reportsRTSOrderProfitForm');
    })
reportRouter.route('/RTSOrder/report') 
    .get(reportController.displayRTSProfitOrders);

reportRouter.route('/backorder')
    .get(reportController.displayBackorder);
reportRouter.route('/backorder/:SKU')
    .get(reportController.displayBackorderSKU);

reportRouter.route('/fba')
    .get(reportController.displayFBAtoSend);

module.exports = reportRouter;