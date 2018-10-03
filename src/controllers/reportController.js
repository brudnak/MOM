const sql = require('mssql');
require("msnodesqlv8");
const shipstation = require('../modules/shipstation');
const request = require('request');
const sendMail = require('../modules/nodemailer');


function reportController() {
    function getShippingCosts(startDate, endDate, page = 1) {
        return new Promise((resolve, reject) => {
            const sDate = `20${startDate.substring(0,2)}-${startDate.substring(2,4)}-${startDate.substring(4,6)} 00:00:00`;
            const eDate = `20${endDate.substring(0,2)}-${endDate.substring(2,4)}-${endDate.substring(4,6)} 00:00:00`;
            request({
                method: 'GET',
                url: `https://ssapi.shipstation.com/shipments?createDateStart=${sDate}&createDateEnd=${eDate}&pageSize=500&page=${page}`,
                headers: {
                    "Content-Type": "application/json",
                    'Authorization': `Basic ${shipstation}`
                },
            }, (err, response, body) => {
                if(err) {
                    return reject(err);
                }

                (async () => {
                    body = JSON.parse(body);

                    console.log(`On page ${body.page} out of ${body.pages}`)

                    let orderShippingCosts = {}
                    
                    body.shipments.forEach(shipment => {
                        if(orderShippingCosts[shipment.orderNumber]) {
                            orderShippingCosts[shipment.orderNumber] += shipment.shipmentCost + shipment.insuranceCost;
                        } else {
                            orderShippingCosts[shipment.orderNumber] = shipment.shipmentCost + shipment.insuranceCost;
                        }
                    });

                    if(body.page < body.pages) {
                        await getShippingCosts(startDate, endDate, body.page + 1).then(shippingCosts => {
                            // merge tables
                            for(order in shippingCosts) {
                                if(orderShippingCosts[order]) {
                                    orderShippingCosts[order] += shippingCosts[order];
                                } else {
                                    orderShippingCosts[order] = shippingCosts[order];
                                }
                            }
                        })
                    }

                    console.log('sending page '+body.page);

                    resolve(orderShippingCosts);
                })();   
            })
        })
    }

    function getShippingCost(orderID) {
        return new Promise((resolve, reject) => {
            request({
                method: 'GET',
                url: `https://ssapi.shipstation.com/shipments?orderNumber=${orderID}`,
                headers: {
                    "Content-Type": "application/json",
                    'Authorization': `Basic ${shipstation}`
                },
            }, (err, response, body) => {
                if(err || body=='Too Many Request') {
                    return reject(err);
                }

                body = JSON.parse(body);
                if(body.total==0) {
                    resolve(0);
                };

                let totalCost = 0;
                body.shipments.forEach(shipment => {
                    totalCost += shipment.shipmentCost;
                });

                resolve(totalCost);
            })
        })
    }

    function getProfitPOs(startDate, endDate, bottomDollar = 10, bottomPercent = 10) {
        return new Promise((resolve, reject) => {
            console.log(`Retrieving Profitability for POs between ${startDate} and ${endDate}`);
            const request = new sql.Request();
            const sqlQuery = `SELECT items.ponumber,items.orderno,items.ship_from,items.item,items.item_state,puritem.quantity,
			items.it_unlist*puritem.quantity as 'Total Extended',puritem.total as 'Total Cost',
			CAST((items.it_unlist*puritem.quantity) - puritem.total AS DECIMAL(16,2)) AS 'Profit',
			CAST(ROUND(( ( (items.it_unlist*puritem.quantity) - puritem.total ) / (items.it_unlist*puritem.quantity) ) * 100,2) AS DECIMAL(16,2)) AS '%' 
			FROM items
			INNER JOIN puritem ON items.item_id = puritem.item_id
			INNER JOIN purchase ON items.ponumber = purchase.ponumber
			WHERE ship_from <> '' AND 
			items.ponumber <> 0 AND 
			items.it_unlist > 0 AND
			purchase.odr_date BETWEEN '${startDate}' AND '${endDate}' AND
			(CAST(ROUND(( ( (items.it_unlist*puritem.quantity) - puritem.total ) / (items.it_unlist*puritem.quantity) ) * 100,2) AS DECIMAL(16,2)) < ${bottomPercent} OR CAST((items.it_unlist*puritem.quantity) - puritem.total AS DECIMAL(16,2)) < ${bottomDollar})
			ORDER BY items.orderno ASC, items.ponumber ASC`;

            request.query(sqlQuery, (err, recordset) => {
                if (err) {
                    return reject(err);
                }
                resolve(recordset.recordset);
            })
        });
    }

    function displayProfitPOs(req, res) {
        const { startDate, endDate, bottomDollar, bottomPercent, recipients } = req.query;
        getProfitPOs(startDate, endDate, bottomDollar, bottomPercent).then(POs => {
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

    function getProfitLineItems(startDate, endDate, bottomDollar = 1, bottomPercent = 10, clKeys = ['AMAZON','AMZPRIME','AMZVC','BID','EBAY','EBAYCPR','EMAIL','FAI','GRANT','GROUPON','GS','PAYPAL','PHONE','PO','TRN','WAL','WEBSALE']) {
        return new Promise((resolve, reject) => {

            console.log(`Retrieving Profitability for line items between ${startDate} and ${endDate} from only keys: ${clKeys.toString()}`);
            const request = new sql.Request();
            const sqlQuery = `SELECT items.orderno, item, it_uncost, it_unlist, quanto, item_state, cms.odr_date,
            CAST(( (items.it_unlist*quanto) - (items.it_uncost*quanto) ) AS DECIMAL(16,2)) AS 'Profit',
            CAST(ROUND(( ( (items.it_unlist*quanto) - (items.it_uncost*quanto) ) / (items.it_unlist*quanto) ) * 100,2) AS DECIMAL(16,2)) AS '%' 
            FROM items
            INNER JOIN cms on cms.orderno = items.orderno
            WHERE cms.odr_date BETWEEN '${startDate}' AND '${endDate}'
            AND items.it_unlist <> 0
            AND items.ship_from = ''
            AND items.it_uncost <> 0
            AND items.item_state NOT IN ('SV','RT')
            AND cl_key IN (${clKeys.map(item => `'${item}'`).join(',')})
            AND (CAST(ROUND(( ( (items.it_unlist*quanto) - (items.it_uncost*quanto) ) / (items.it_unlist*quanto) ) * 100,2) AS DECIMAL(16,2)) < ${bottomPercent} OR CAST((items.it_unlist*quanto) - (items.it_uncost*quanto) AS DECIMAL(16,2)) < ${bottomDollar})
			ORDER BY items.orderno ASC, items.item ASC`;

            request.query(sqlQuery, (err, recordset) => {
                if (err) {
                    return reject(err);
                }
                resolve(recordset.recordset);
            });
        });
    }

    function displayProfitLineItems(req, res) {
        const { startDate, endDate, bottomDollar, bottomPercent } = req.params;
        const keys = eval(req.params.keys);
        getProfitLineItems(startDate, endDate, bottomDollar, bottomPercent, keys).then(lineItems => {
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

    function getProfitOrders(startDate, endDate, bottomDollar = 10, bottomPercent = 10, clKeys = [], includeFBA = 'false', includeShipped = 'false', includeQuotes = 'false') {
        return new Promise((resolve, reject) => {
            console.log(`Retrieving Profitability for orders between ${startDate} and ${endDate} from only keys: ${clKeys.toString()}`);
            const request = new sql.Request();
            const sqlQuery = `SELECT cms.orderno, odr_date, cl_key, order_st2, cost, ord_total-tax AS 'merchTotal', pocount, 
            CAST(( ord_total - tax - cost - ( CASE
                WHEN cl_key IN ('AMAZON','AMZPRIME','WAL') THEN (ord_total-tax)*.15
                WHEN cl_key = 'EBAY' OR cl_key = 'EBAYCPR' THEN (ord_total-tax)*.10
                WHEN cl_key = 'AMZVC' THEN (ord_total-tax)*.1
                ELSE 0 END
            )) AS DECIMAL(16,2)) AS 'profit',
            CAST(ROUND(( ( ord_total - tax - cost ) / (ord_total-tax) ) * 100,2) AS DECIMAL(16,2)) AS 'percentProfit'
            FROM ( SELECT orderno,SUM(it_uncost*quanto) as 'cost',SUM(it_unlist*quanto) as 'price'
                FROM items WHERE item_state <> 'SV'
                GROUP BY orderno ) agg
            INNER JOIN cms ON cms.orderno = agg.orderno
            LEFT JOIN ( SELECT orderno, COUNT(*) as 'pocount' FROM purchase GROUP BY orderno ) p ON cms.orderno = p.orderno
            WHERE cms.odr_date BETWEEN '${startDate}' AND '${endDate}'
            ${clKeys[0] == undefined ? '' : `AND cl_key IN (${clKeys.map((key) => `'${key}'`).join(', ')})`}
            ${includeFBA=='false' ? `AND cms.ordertype <> 'FBA'` : ''}
            ${includeShipped=='false' ? `AND cms.order_st2 <> 'SH'` : ''}
            ${includeQuotes=='false' ? `AND cms.order_st2 <> 'QO'` : ''}
            AND (CAST(( (ord_total-tax) - cost - ( CASE
                WHEN cl_key IN ('AMAZON','AMZPRIME','WAL') THEN (ord_total-tax)*.15
                WHEN cl_key = 'EBAY' OR cl_key = 'EBAYCPR' THEN (ord_total-tax)*.10
                WHEN cl_key = 'AMZVC' THEN (ord_total-tax)*.1
                ELSE 0 END
            )) AS DECIMAL(16,2)) < ${bottomDollar} OR CAST(ROUND(( ( (ord_total-tax) - cost ) / (ord_total-tax) ) * 100,2) AS DECIMAL(16,2)) < ${bottomPercent})
            AND ord_total <> 0
            ORDER BY cms.orderno ASC`;

            request.query(sqlQuery, (err, recordset) => {
                if (err) {
                    return reject(err);
                }
                resolve(recordset.recordset);
            });
        });
    }

    function displayProfitOrders(req, res) {
        const { startDate, endDate, bottomDollar, bottomPercent, includeFBA, includeShipped, includeQuotes, recipients } = req.query;
        const keys = eval(req.query.keys);
        Promise.all([getProfitOrders(startDate, endDate, bottomDollar, bottomPercent, keys, includeFBA, includeShipped, includeQuotes)]).then(([orders]) => {
            orders.forEach(order => {
                order.odr_date = order.odr_date.toString().substring(4,16);
                order.cost = order.cost.toFixed(2);
                order.merchTotal = order.merchTotal.toFixed(2);
                order.profit = order.profit.toFixed(2);
            });

            var link = (req.protocol + '://' + req.get('host') + req.originalUrl).replace('recipients','');

            if(recipients && recipients !== '') {
                sendMail(orders, recipients, 'Low Profitability Report - Orders', {startDate, endDate, bottomDollar, bottomPercent, includeFBA, includeShipped, includeQuotes, keys, link}).then(response => {
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

    function getShippedProfitOrders(startDate, endDate, clKeys = [], salesperson) {
        return new Promise((resolve, reject) => {
            console.log(`Retrieving Profitability for orders between ${startDate} and ${endDate} from only keys: ${clKeys.toString()}`);
            const request = new sql.Request();
            const sqlQuery = `SELECT cms.orderno, cms.alt_order, odr_date, cl_key, order_st2, ord_total-tax AS 'totalAfterTax', cost
                FROM ( SELECT orderno,SUM(it_uncost*quanto) as 'cost'
                    FROM items WHERE item_state <> 'SV' AND item_state <> 'RT'
                    GROUP BY orderno ) agg
                INNER JOIN cms ON cms.orderno = agg.orderno
                LEFT JOIN ( SELECT orderno, COUNT(*) as 'pocount' FROM purchase GROUP BY orderno ) p ON cms.orderno = p.orderno
                WHERE cms.order_st2 = 'SH' AND pocount IS NULL AND cms.ordertype <> 'FBA' AND cms.cl_key <> 'AMZPRIME'
                AND cms.odr_date BETWEEN '${startDate}' AND '${endDate}'
                ${clKeys[0] == undefined ? '' : `AND cl_key IN (${clKeys.map((key) => `'${key}'`).join(', ')})`}
                ${salesperson ? `AND cms.sales_id = '${salesperson}'` : ''}
                AND ord_total <> 0
                ORDER BY odr_date DESC`;

            request.query(sqlQuery, (err, recordset) => {
                if (err) {
                    return reject(err);
                }
                resolve(recordset.recordset);
            }); 
        });
    }

    function displayShippedProfitOrders(req, res) {
        const { startDate, endDate, recipients, salesperson, bottomDollar, bottomPercent } = req.query;
        const keys = eval(req.query.keys);
        Promise.all([getShippedProfitOrders(startDate, endDate, keys, salesperson), getShippingCosts(startDate, endDate)]).then(([orders, shippingCosts]) => {
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

    function getRTSProfitOrders(startDate, endDate, clKeys = []) {
        return new Promise((resolve, reject) => {
            console.log(`Retrieving Profitability for orders between ${startDate} and ${endDate} from only keys: ${clKeys.toString()}`);
            const request = new sql.Request();
            const sqlQuery = `SELECT cms.orderno, cms.alt_order, odr_date, cl_key, order_st2, ord_total-tax AS 'totalAfterTax', cost
                FROM ( SELECT orderno,SUM(it_uncost*quanto) as 'cost'
                    FROM items WHERE item_state <> 'SV' AND item_state <> 'RT'
                    GROUP BY orderno ) agg
                INNER JOIN cms ON cms.orderno = agg.orderno
                LEFT JOIN ( SELECT orderno, COUNT(*) as 'pocount' FROM purchase GROUP BY orderno ) p ON cms.orderno = p.orderno
                WHERE cms.order_st2 = 'PS' AND pocount IS NULL AND cms.ordertype <> 'FBA' AND cms.cl_key <> 'AMZPRIME'
                AND cms.odr_date BETWEEN '${startDate}' AND '${endDate}'
                ${clKeys[0] == undefined ? '' : `AND cl_key IN (${clKeys.map((key) => `'${key}'`).join(', ')})`}
                AND ord_total <> 0
                ORDER BY odr_date DESC`;

            request.query(sqlQuery, (err, recordset) => {
                if (err) {
                    return reject(err);
                }
                resolve(recordset.recordset);
            }); 
        });
    }

    function displayRTSProfitOrders(req, res) {
        const { startDate, endDate, recipients } = req.query;
        const keys = eval(req.query.keys);
        Promise.all([getRTSProfitOrders(startDate, endDate, keys), getShippingCosts(startDate, endDate)]).then(([orders, shippingCosts]) => {

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

    function getBackorder() {
        return new Promise((resolve, reject) => {
            console.log(`Retrieving report of backorder items`)
            const request = new sql.Request();
            const sqlQuery = `SELECT items.item, SUM(quantb) as 'BO', po.onorder, items.nonproduct, items.item_state, stock.units - stock.fbaunits as inhouse, stock.commited
                FROM items
                LEFT JOIN ( SELECT number,SUM(quantity - delivered) as 'onorder'
                    FROM puritem
                    WHERE item_id = 0 AND quantity - delivered > 0 AND number <> 'CANCELLED' AND ponumber <> 0
                    GROUP BY number ) po ON items.item = po.number
                INNER JOIN stock ON items.item = stock.number
                INNER JOIN cms ON cms.orderno = items.orderno
                WHERE item_state IN ('BO','HS') AND quantb > 0
                GROUP BY items.item, po.onorder, items.nonproduct, items.item_state, stock.units - stock.fbaunits, stock.commited
                ORDER BY item`

            request.query(sqlQuery, (err, recordset) => {
                if (err) {
                    return reject(err);
                }
                resolve(recordset.recordset);
            });
        });
    }

    function displayBackorder(req, res) {
        getBackorder().then((items) => {
            let promiseArr = [];
            items.forEach((item) => {
                promiseArr.push(getBackorderOrders(item.item));
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

    function getBackorderOrders(SKU) {
        return new Promise((resolve, reject) => {
            console.log(`Retrieving BO orders for SKU ${SKU}`);
            const request = new sql.Request();
            const sqlQuery = `SELECT item, items.orderno, quantb, odr_date
            FROM items
            INNER JOIN cms ON items.orderno = cms.orderno
            WHERE item = '${SKU}' AND item_state IN ('BO','HS')`;

            request.query(sqlQuery, (err, recordset) => {
                if(err) {
                    return reject(err);
                }
                resolve(recordset.recordset);
            });
        });
    }

    function getCommittedOrders(SKU) {
        return new Promise((resolve, reject) => {
            console.log(`Retrieving BO orders for SKU ${SKU}`);
            const request = new sql.Request();
            const sqlQuery = `SELECT item, items.orderno, quantf, odr_date
            FROM items
            INNER JOIN cms ON items.orderno = cms.orderno
            WHERE item = '${SKU}' AND item_state IN ('CM')`;

            request.query(sqlQuery, (err, recordset) => {
                if(err) {
                    return reject(err);
                }
                resolve(recordset.recordset);
            });
        });
    }

    function getBackorderPOs(SKU) {
        return new Promise((resolve, reject) => {
            console.log(`Retrieving stock POs for SKU ${SKU}`);
            const request = new sql.Request();
            const sqlQuery = `SELECT puritem.ponumber, quantity, delivered, odr_date
            FROM puritem
            INNER JOIN purchase ON purchase.ponumber = puritem.ponumber
            WHERE item_id = 0 AND quantity - delivered > 0 AND puritem.ponumber <> 0
            AND number = '${SKU}'`;

            request.query(sqlQuery, (err, recordset) => {
                if (err) {
                    return reject(err);
                }
                resolve(recordset.recordset);
            })
        })
    }

    function displayBackorderSKU(req, res) {
        const { SKU } = req.params;
        Promise.all([getBackorderOrders(SKU), getBackorderPOs(SKU), getCommittedOrders(SKU)]).then(([BOorders, pos, CMorders]) => {
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