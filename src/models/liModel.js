const debug = require('debug')('MOM:model:li');
const sql = require('mssql');
require("msnodesqlv8");

function liModel() {
    function getLineItems(itemStatus = [], SKUs = []) {
        return new Promise((resolve, reject) => {
            debug(`Retreiving line items for ${SKUs.toString()} with status in ${itemStatus.toString()}`);
            const request = new sql.Request();
            const sqlQuery = `SELECT items.orderno, item, quanto, quantb, quants, it_uncost, it_unlist, item_state, ship_from, items.ponumber, cms.odr_date
            FROM items
            INNER JOIN cms ON items.orderno = cms.orderno
            WHERE 1=1
            ${itemStatus[0] == undefined ? '' : `AND item_state IN (${itemStatus.map((item) => `'${item}'`).join(', ')})`}
            ${SKUs[0] == undefined ? '' : `AND item IN (${SKUs.map((item) => `'${item}'`).join(', ')})`}
            ORDER BY item ASC, cms.odr_date DESC`;

            request.query(sqlQuery, (err, recordset) => {
                if (err) {
                    return reject(err);
                }
                resolve(recordset.recordset);
            });
        });
    }

    return {
        getLineItems
    }
}

module.exports = liModel();