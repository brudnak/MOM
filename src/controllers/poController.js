const sql = require('mssql');
require("msnodesqlv8");

function poController() {
    function getPO(ponumber) {
        return new Promise((resolve, reject) => {
            console.log(`Retrieving PO ${ponumber}`);
            const request = new sql.Request();
            const sqlQuery = `SELECT ponumber, supplier, odr_date, ord_total, reference, orderno, mer_total, shipping, tax
            FROM purchase
            WHERE ponumber = ${ponumber}`;

            request.query(sqlQuery, (err, recordset) => {
                if (err) {
                    return reject(err);
                }
                resolve(recordset.recordset[0]);
            })
        })
    }

    function getPOitems(ponumber) {
        return new Promise((resolve, reject) => {
            console.log(`Retrieving items for PO ${ponumber}`);
            const request = new sql.Request();
            const sqlQuery = `SELECT puritem.number, puritem.quantity, puritem.delivered, puritem.unit_cost, items.it_unlist
            FROM puritem
            LEFT JOIN items ON puritem.item_id = items.item_id
            WHERE puritem.ponumber = ${ponumber}`;

            request.query(sqlQuery, (err, recordset) => {
                if(err) {
                    return reject(err);
                }
                resolve(recordset.recordset);
            })
        })
    }

    function getPOaps(ponumber) {
        return new Promise((resolve, reject) => {
            console.log(`Retrieving APs for po ${ponumber}`);
            const request = new sql.Request();
            const sqlQuery = `SELECT invoice, paydate, userid, payment, check_no FROM appaymnt WHERE ponumber = ${ponumber}`;

            request.query(sqlQuery, (err, recordset) => {
                if(err) {
                    return reject(err);
                }
                resolve(recordset.recordset);
            });
        });
    }

    function displayPO(req, res) {
        const { ponumber } = req.params;
        Promise.all([getPO(ponumber), getPOitems(ponumber), getPOaps(ponumber)]).then(([po, poItems, poAps]) => {
            if(!po) {
                res.render(
                    '404',
                    {
                        type: 'po',
                        number: ponumber
                    }
                )
            } else {
                po.totalExt = 0;
                poItems.forEach(item => {
                    po.totalExt += item.it_unlist * item.quantity;
                })
                res.render(
                    'po',
                    {
                        po,
                        poItems,
                        poAps
                    }
                )
            };
        });
    }

    function searchPOs(supplier, pototal, sku) {
        return new Promise((resolve, reject) => {
            sku = sku.toUpperCase();
            console.log(`Retrieving POs ${supplier}, ${pototal}, ${sku}`);
            const request = new sql.Request();
            const sqlQuery = `SELECT purchase.ponumber, supplier, odr_date, ord_total FROM purchase 
            ${sku ? `INNER JOIN puritem ON purchase.ponumber = puritem.ponumber` : ''}
            WHERE 1=1
            ${sku ? `AND number = '${sku}'` : ''}
            ${supplier ? `AND supplier = '${supplier}'` : ''}
            ${pototal ? `AND ord_total = ${pototal}` : ''}
            ${sku ? `GROUP BY purchase.ponumber, supplier, odr_date, ord_total` : ''}
            ORDER BY odr_date ASC`;

            request.query(sqlQuery, (err, recordset) => {
                if(err) {
                    return reject(err);
                }
                resolve(recordset.recordset);
            })
        })
    }

    function displayPOsSearch(req, res) {
        const { supplier, pototal, sku } = req.query;
        searchPOs(supplier, pototal, sku).then((POs) => {
            res.render(
                'poResults',
                {
                    POs,
                    params: req.query
                }
            )
        })
    }

    return {
        displayPO,
        displayPOsSearch
    };
}

module.exports = poController;