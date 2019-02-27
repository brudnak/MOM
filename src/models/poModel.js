const debug = require('debug')('MOM:model:po');
const sql = require('mssql');
require("msnodesqlv8");

function poModel() {
    function getPO(ponumber) {
        return new Promise((resolve, reject) => {
            debug(`Retrieving PO ${ponumber}`);
            if(!Number.isNaN(ponumber)) {
                debug('Not a number');
                return reject(`${ponumber} is an invalid PO number.`);
            }
            const request = new sql.Request();
            const sqlQuery = `SELECT ponumber, supplier, odr_date, ord_total, reference, orderno, mer_total, shipping, tax, completed, printed
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
            debug(`Retrieving items for PO ${ponumber}`);
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
            debug(`Retrieving APs for po ${ponumber}`);
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

    function searchPOs(supplier, pototal, sku) {
        return new Promise((resolve, reject) => {
            sku = sku.toUpperCase();
            debug(`Retrieving POs ${supplier}, ${pototal}, ${sku}`);
            const request = new sql.Request();
            const sqlQuery = `SELECT purchase.ponumber, supplier, odr_date, ord_total, purchase.completed, purchase.printed, reference ${sku && ', quantity'} FROM purchase 
            ${sku ? `INNER JOIN puritem ON purchase.ponumber = puritem.ponumber` : ''}
            WHERE 1=1
            ${sku && `AND number = '${sku}'`}
            ${supplier && `AND supplier = '${supplier}'`}
            ${pototal && `AND ord_total = ${pototal}`}
            ${sku && `GROUP BY purchase.ponumber, supplier, odr_date, ord_total, reference, quantity, purchase.completed, purchase.printed`}
            ORDER BY odr_date DESC`;

            request.query(sqlQuery, (err, recordset) => {
                if(err) {
                    return reject(err);
                }
                resolve(recordset.recordset);
            })
        })
    }

    return {
        getPO,
        getPOitems,
        getPOaps,
        searchPOs
    }
}

module.exports = poModel();