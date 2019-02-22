const debug = require('debug')('MOM:model:report');
const sql = require('mssql');
require("msnodesqlv8");

function reportModel() {
    function getProfitPOs(startDate, endDate, bottomDollar = 10, bottomPercent = 10) {
        return new Promise((resolve, reject) => {
            debug(`Retrieving Profitability for POs between ${startDate} and ${endDate}`);
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
        }).catch(err => {
            return err;
        });
    }

    function getProfitLineItems(startDate, endDate, bottomDollar = 1, bottomPercent = 10, clKeys = ['AMAZON','AMZPRIME','AMZVC','BID','EBAY','EBAYCPR','EMAIL','FAI','GRANT','GROUPON','GS','PAYPAL','PHONE','PO','TRN','WAL','WEBSALE']) {
        return new Promise((resolve, reject) => {
            debug(`Retrieving Profitability for line items between ${startDate} and ${endDate} from only keys: ${clKeys.toString()}`);
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
        }).catch(err => {
            return err;
        });
    }

    function getProfitOrders(startDate, endDate, bottomDollar = 10, bottomPercent = 10, clKeys = [], includeFBA = 'false', includeShipped = 'false', includeQuotes = 'false') {
        return new Promise((resolve, reject) => {
            debug(`Retrieving Profitability for orders between ${startDate} and ${endDate} from only keys: ${clKeys.toString()}`);
            const request = new sql.Request();
            const sqlQuery = `SELECT cms.orderno, odr_date, cl_key, order_st2, cost, ord_total-tax AS 'merchTotal', pocount, 
            CAST(( ord_total - tax - cost - ( CASE
                WHEN cl_key IN ('AMAZON','AMZPRIME','WAL') THEN (ord_total-tax)*.15
                WHEN cl_key = 'EBAY' OR cl_key = 'EBAYCPR' THEN (ord_total-tax)*.10
                WHEN cl_key = 'AMZVC' THEN (ord_total-tax)*.1
                ELSE (ord_total-tax)*.03 END
            )) AS DECIMAL(16,2)) AS 'profit',
            CAST(ROUND(( ( ord_total - tax - cost - ( CASE
                WHEN cl_key IN ('AMAZON','AMZPRIME','WAL') THEN (ord_total-tax)*.15
                WHEN cl_key = 'EBAY' OR cl_key = 'EBAYCPR' THEN (ord_total-tax)*.10
                WHEN cl_key = 'AMZVC' THEN (ord_total-tax)*.1
                ELSE (ord_total-tax)*.03 END
            ) ) / (ord_total-tax) ) * 100,2) AS DECIMAL(16,2)) AS 'percentProfit'
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
            AND cms.order_st2 <> 'EP' 
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
        }).catch(err => {
            return err;
        });
    }

    function getShippedProfitOrders(startDate, endDate, clKeys = [], salesperson) {
        return new Promise((resolve, reject) => {
            debug(`Retrieving Profitability for orders between ${startDate} and ${endDate} from only keys: ${clKeys.toString()}`);
            const request = new sql.Request();
            const sqlQuery = `SELECT cms.orderno, cms.alt_order, odr_date, cl_key, order_st2, tpshiptype, ord_total-tax AS 'totalAfterTax', cost
                FROM ( SELECT orderno,SUM(it_uncost*quanto) as 'cost'
                    FROM items WHERE item_state <> 'SV'
                    GROUP BY orderno ) agg
                INNER JOIN cms ON cms.orderno = agg.orderno
                LEFT JOIN ( SELECT orderno, COUNT(*) as 'pocount' FROM purchase GROUP BY orderno ) p ON cms.orderno = p.orderno
                WHERE cms.order_st2 = 'SH' AND pocount IS NULL AND cms.ordertype <> 'FBA'
                AND cms.ship_date BETWEEN '${startDate}' AND '${endDate}'
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
        }).catch(err => {
            return err;
        });
    }

    function getRTSProfitOrders(startDate, endDate, clKeys = []) {
        return new Promise((resolve, reject) => {
            debug(`Retrieving Profitability for orders between ${startDate} and ${endDate} from only keys: ${clKeys.toString()}`);
            const request = new sql.Request();
            const sqlQuery = `SELECT cms.orderno, cms.alt_order, odr_date, cl_key, order_st2, tpshiptype, ord_total-tax AS 'totalAfterTax', ord_total, cost
                FROM ( SELECT orderno,SUM(it_uncost*quanto) as 'cost'
                    FROM items WHERE item_state <> 'SV'
                    GROUP BY orderno ) agg
                INNER JOIN cms ON cms.orderno = agg.orderno
                LEFT JOIN ( SELECT orderno, COUNT(*) as 'pocount' FROM purchase GROUP BY orderno ) p ON cms.orderno = p.orderno
                WHERE cms.order_st2 = 'PS' AND pocount IS NULL AND cms.ordertype <> 'FBA'
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
        }).catch(err => {
            return err;
        });
    }

    function getBackorder() {
        return new Promise((resolve, reject) => {
            debug(`Retrieving report of backorder items`)
            const request = new sql.Request();
            const sqlQuery = `SELECT items.item, SUM(quantb) as 'BO', po.onorder, items.nonproduct, items.item_state, stock.units - stock.fbaunits as inhouse, stock.commited
                FROM items
                LEFT JOIN ( SELECT number,SUM(quantity - delivered) as 'onorder'
                    FROM puritem
                    WHERE item_id = 0 AND quantity - delivered > 0 AND number <> 'CANCELLED' AND ponumber <> 0
                    GROUP BY number ) po ON items.item = po.number
                INNER JOIN stock ON items.item = stock.number
                INNER JOIN cms ON cms.orderno = items.orderno
                WHERE item_state IN ('BO','HS','PB') AND quantb > 0
                GROUP BY items.item, po.onorder, items.nonproduct, items.item_state, stock.units - stock.fbaunits, stock.commited
                ORDER BY item`

            request.query(sqlQuery, (err, recordset) => {
                if (err) {
                    return reject(err);
                }
                resolve(recordset.recordset);
            });
        }).catch(err => {
            return err;
        });
    }

    function getBackorderOrders(SKU) {
        return new Promise((resolve, reject) => {
            debug(`Retrieving BO orders for SKU ${SKU}`);
            const request = new sql.Request();
            const sqlQuery = `SELECT item, items.orderno, quantb, odr_date
            FROM items
            INNER JOIN cms ON items.orderno = cms.orderno
            WHERE item = '${SKU}' AND item_state IN ('BO','HS','PB')`;

            request.query(sqlQuery, (err, recordset) => {
                if(err) {
                    return reject(err);
                }
                resolve(recordset.recordset);
            });
        }).catch(err => {
            return err;
        });
    }

    function getCommittedOrders(SKU) {
        return new Promise((resolve, reject) => {
            debug(`Retrieving BO orders for SKU ${SKU}`);
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
        }).catch(err => {
            return err;
        });
    }

    function getBackorderPOs(SKU) {
        return new Promise((resolve, reject) => {
            debug(`Retrieving stock POs for SKU ${SKU}`);
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
        }).catch(err => {
            return err;
        });
    }

    function getAllItemSales(days) {
        return new Promise((resolve, reject) => {
            debug(`Retrieving sales for past ${days} days.`)
            const request = new sql.Request();
            const sqlQuery = `SELECT item, SUM(quanto) FROM items
            INNER JOIN cms ON cms.orderno = items.orderno
            WHERE item_state NOT IN ('QO','RT') AND cms.odr_date > DATEADD(DAY, -${days}, GETDATE())
            GROUP BY item`;

            request.query(sqlQuery, (err, recordset) => {
                if(err) {
                    return reject(err);
                }

                resolve(recordset.recordset);
            })
        }).catch(err => {
            return err;
        });
    }

    function getAllItemStock() {
        return new Promise((resolve, reject) => {
            debug(`Retrieving all items stock`)
            const request = new sql.Request();
            const sqlQuery = `SELECT number, units, onorder, bounits, fbaunits FROM stock`;

            request.query(sqlQuery, (err, recordset) => {
                if(err) {
                    return reject(err);
                }

                resolve(recordset.recordset);
            })
        }).catch(err => {
            return err;
        });
    }

    function getWeeklyStockCoverage() {
        return new Promise((resolve, reject) => {
            Promise.all([getAllItemsStock(),getAllItemSales(7), getAllItemSales(30), getAllItemSales(90)]).then(([stock,sales7, sales30, sales90]) => {
                let items = []
                stock.forEach(item => {
                    const sku = item.number;
                    const inhouse = item.units;
                    const onorder = item.onorder;
                    const bounits = item.bounits;
                    const fbaunits = item.fbaunits;
                })
            }).catch(err => {
                reject(err);
            })
        }).catch(err => {
            return err;
        })
    }

    return { 
        getBackorder,
        getBackorderOrders,
        getBackorderPOs,
        getCommittedOrders,
        getProfitLineItems,
        getProfitOrders,
        getProfitPOs,
        getRTSProfitOrders,
        getShippedProfitOrders
    }
}

module.exports = reportModel();