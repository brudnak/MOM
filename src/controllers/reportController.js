const sendMail = require('../modules/nodemailer');
const reportModel = require('../models/reportModel');
const shipstation = require('../modules/shipstation');

function reportController() {
    function displayProfitPOs(req, res) {
        const { startDate, endDate, bottomDollar, bottomPercent, recipients } = req.query;
        reportModel.getProfitPOs(startDate, endDate, bottomDollar, bottomPercent).then(POs => {
            POs.forEach(PO => {
                PO['Total Extended'] = PO['Total Extended'].toFixed(2);
                PO['Total Cost'] = PO['Total Cost'].toFixed(2);
                PO.Profit = PO.Profit.toFixed(2);
            })

            var link = (req.protocol + '://' + req.get('host') + req.originalUrl).replace('recipients','');
            
            if(recipients && recipients !== '') {
                sendMail(POs, recipients, 'Dropship Low Profitability Report', {startDate, endDate, bottomDollar, bottomPercent, link}).then(response => {
                    global.io.emit('emailSuccess', { recipients });
                }).catch(err => {
                    global.io.emit('emailFailure', { recipients });  
                });
            }

            res.render(
                'reportsDropshipProfit',
                {
                    POs,
                    startDate,
                    endDate
                }
            )
        })
    }

    function displayProfitLineItems(req, res) {
        const { startDate, endDate, bottomDollar, bottomPercent } = req.params;
        const keys = eval(req.params.keys);
        reportModel.getProfitLineItems(startDate, endDate, bottomDollar, bottomPercent, keys).then(lineItems => {
            res.render(
                'reportsLIProfit',
                {
                    lineItems,
                    startDate,
                    endDate,
                    bottomDollar,
                    bottomPercent,
                    keys
                }
            )
        });
    }

    function displayProfitOrders(req, res) {
        const { startDate, endDate, bottomDollar, bottomPercent, includeFBA, includeShipped, includeQuotes, recipients } = req.query;
        const keys = eval(req.query.keys);
        Promise.all([reportModel.getProfitOrders(startDate, endDate, bottomDollar, bottomPercent, keys, includeFBA, includeShipped, includeQuotes)]).then(([orders]) => {
            orders.forEach(order => {
                order.odr_date = order.odr_date.toString().substring(4,16);
                order.cost = order.cost.toFixed(2);
                order.merchTotal = order.merchTotal.toFixed(2);
                order.profit = order.profit.toFixed(2);
            });

            var link = (req.protocol + '://' + req.get('host') + req.originalUrl).replace('recipients','');

            if(recipients && recipients !== '') {
                sendMail(orders, recipients, 'Low Profitability Before Shipping - Orders', {startDate, endDate, bottomDollar, bottomPercent, includeFBA, includeShipped, includeQuotes, keys, link}).then(response => {
                    global.io.emit('emailSuccess', { recipients });
                }).catch(err => {
                    global.io.emit('emailFailure', { recipients });  
                });
            }

            res.render(
                'reportsOrderProfit',
                {
                    orders,
                    startDate,
                    endDate,
                    bottomDollar,
                    bottomPercent,
                    keys: req.params.keys,
                }
            )
        }).catch(err => {
            res.send(err);
        })
    }

    function displayShippedProfitOrders(req, res) {
        const { startDate, endDate, recipients, salesperson } = req.query;
        const keys = eval(req.query.keys);
        Promise.all([reportModel.getShippedProfitOrders(startDate, endDate, keys, salesperson), shipstation.getShippingCosts(startDate, endDate)]).then(([orders, shippingCosts]) => {
            let stats = {
                totalGross: 0,
                totalNet: 0,
                totalLoss: 0,
            };

            orders.forEach(order => {
                order.odr_date = order.odr_date.toString().substring(4,16);
                order.cost = order.cost.toFixed(2);
                order.totalAfterTax = order.totalAfterTax.toFixed(2);
                order.shipping = (shippingCosts[order.alt_order.trim().length==19 ? order.alt_order.trim() : order.orderno] || 0).toFixed(2);
                order.fees = (['AMAZON','AMZPRIME','WAL'].includes(order.cl_key.trim()) ? order.totalAfterTax*.15 : ['EBAY','EBAYCPR'].includes(order.cl_key.trim()) ? order.totalAfterTax*.10 : order.cl_key.trim()=='AMZVC' ? order.totalAfterTax*.1 : 0).toFixed(2);
                order.net = (order.totalAfterTax - order.cost - order.shipping - order.fees).toFixed(2);
                order.margin = ((order.net / order.totalAfterTax)*100).toFixed(2);

                stats.totalGross = stats.totalGross + eval(order.totalAfterTax);
                stats.totalNet = stats.totalNet + eval(order.net);
                stats.totalLoss = stats.totalLoss + (order.net < 0 ? eval(order.net) : 0);
            })

            //orders = orders.filter(order => { eval(order.net) < bottomDollar || eval(order.margin) < bottomPercent });

            var link = (req.protocol + '://' + req.get('host') + req.originalUrl).replace('recipients','');
            
            if(recipients && recipients !== '') {
                sendMail(orders, recipients, 'Shipped Profitability Report', {startDate, endDate, keys, link}).then(response => {
                    global.io.emit('emailSuccess', { recipients });
                }).catch(err => {
                    global.io.emit('emailFailure', { recipients });  
                });
            }

            res.render(
                'reportsShippedOrderProfit',
                {
                    orders,
                    parameters: { startDate,
                        endDate,
                        keys: req.query.keys
                    },
                    stats
                }
            )
        }).catch(err => {
            res.send(err);
        })
    }

    function displayRTSProfitOrders(req, res) {
        const { startDate, endDate, recipients } = req.query;
        const keys = eval(req.query.keys);
        Promise.all([reportModel.getRTSProfitOrders(startDate, endDate, keys), shipstation.getShippingCosts(startDate, endDate)]).then(([orders, shippingCosts]) => {

            orders.forEach(order => {
                order.odr_date = order.odr_date.toString().substring(4,16);
                order.cost = order.cost.toFixed(2);
                order.totalAfterTax = order.totalAfterTax.toFixed(2);
                order.shipping = (shippingCosts[order.alt_order.trim().length==19 ? order.alt_order.trim() : order.orderno] || 0).toFixed(2);
                order.fees = (['AMAZON','AMZPRIME','WAL'].includes(order.cl_key.trim()) ? order.totalAfterTax*.15 : ['EBAY','EBAYCPR'].includes(order.cl_key.trim()) ? order.totalAfterTax*.10 : order.cl_key.trim()=='AMZVC' ? order.totalAfterTax*.1 : 0).toFixed(2);
                order.net = (order.totalAfterTax - order.cost - order.shipping - order.fees).toFixed(2);
                order.margin = ((order.net / order.totalAfterTax)*100).toFixed(2);
            })

            var link = (req.protocol + '://' + req.get('host') + req.originalUrl).replace('recipients','');
            
            if(recipients && recipients !== '') {
                sendMail(orders, recipients, 'Ready-to-Ship Profitability Report', {startDate, endDate, keys, link}).then(response => {
                    global.io.emit('emailSuccess', { recipients });
                }).catch(err => {
                    global.io.emit('emailFailure', { recipients });  
                });
            }

            res.render(
                'reportsRTSOrderProfit',
                {
                    orders,
                    parameters: { startDate,
                        endDate,
                        keys: req.query.keys
                    }
                }
            )
        }).catch(err => {
            res.send(err);
        })
    }

    function displayBackorder(req, res) {
        reportModel.getBackorder().then((items) => {
            let promiseArr = [];
            items.forEach((item) => {
                promiseArr.push(reportModel.getBackorderOrders(item.item));
            })
            Promise.all(promiseArr).then(orders => {
                let ordersByItem = {};
                orders.forEach((ordersBySKU, index) => {
                    ordersBySKU.forEach((order, index) => {
                        if (!ordersByItem[order.item]) {
                            ordersByItem[order.item] = []
                        } 
                        ordersByItem[order.item].push(order.orderno);
                    })
                })
                res.render(
                    'reportsBackorderFull',
                    {
                        items,
                        ordersByItem
                    }
                )
            })
        })
    }

    function displayBackorderSKU(req, res) {
        const { SKU } = req.params;
        Promise.all([reportModel.getBackorderOrders(SKU), reportModel.getBackorderPOs(SKU), reportModel.getCommittedOrders(SKU)]).then(([BOorders, pos, CMorders]) => {
            res.render(
                'reportsBackorderSKU',
                {
                    SKU,
                    BOorders,
                    CMorders,
                    pos
                }
            )
        })
    }

    return {
        displayProfitPOs,
        displayProfitLineItems,
        displayProfitOrders,
        displayBackorder,
        displayBackorderSKU,
        displayShippedProfitOrders,
        displayRTSProfitOrders
    };
}

module.exports = reportController;