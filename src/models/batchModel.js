const debug = require('debug')('MOM:model:batch');
const sql = require('mssql');
require('msnodesqlv8');

function batchModel() {
    function getStage1() {
        return new Promise((resolve, reject) => {
            debug('Getting Stage 1');
            const request = new sql.Request();
            const sqlQuery = `SELECT cms.odr_date, cms.orderno, cms.sales_id, cms.cl_key, cms.alt_order FROM cms
                WHERE order_st2 = 'PI'
                ORDER BY cms.odr_date`;

            request.query(sqlQuery, (err, recordset) => {
                if(err) {
                    return reject(err);
                };

                resolve(recordset.recordset);
            })
        })
    }

    function getStage2() {
        return new Promise((resolve, reject) => {
            debug('Getting Stage 2');
            const request = new sql.Request();
            const sqlQuery = `SELECT cms.odr_date, cms.orderno, cms.sales_id, cms.cl_key, cms.alt_order FROM cms
            WHERE order_st2 = 'IN'
            ORDER BY cms.odr_date`;

            request.query(sqlQuery, (err, recordset) => {
                if(err) {
                    return reject(err);
                }

                resolve(recordset.recordset);
            })
        })
    }

    function getStage89() {
        return new Promise((resolve, reject) => {
            debug('Getting Stage 8-9');
            const request = new sql.Request();
            const sqlQuery = `SELECT cms.odr_date, items.orderno, item, quantb, it_uncost*quantb as 'totalEstCost', ship_from, cms.sales_id FROM items
                INNER JOIN cms on cms.orderno = items.orderno
                WHERE items.dropship = 1 AND items.ordered = 0 AND items.item_state = 'ND' AND cms.sys_hold = 0 AND cms.perm_hold = 0 AND ccheck <> 'D'
                ORDER BY cms.odr_date`;

            request.query(sqlQuery, (err, recordset) => {
                if(err) {
                    return reject(err);
                }
                resolve(recordset.recordset);
            });
        })
        
    }

    return {
        getStage1,
        getStage2,
        getStage89
    }
}

module.exports = batchModel();