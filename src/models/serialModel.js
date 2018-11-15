const debug = require('debug')('MOM:model:serial');
const sql = require('mssql');
require("msnodesqlv8");

function serialModel() {
    function searchSerials(params) {
        return new Promise((resolve, reject) => {
            let { serial, sku, status, orderno } = params;
            sku = sku.toUpperCase();
            debug(`Retrieving serials for ${serial}, ${sku}, ${status}, ${orderno}`);

            const request = new sql.Request();
            const sqlQuery = `SELECT item, status, serial, orderno FROM serial
            WHERE 1=1
            ${serial ? `AND serial like '%${serial}%'` : ''}
            ${sku ? `AND item = '${sku}'` : ''}
            ${status ? `AND status = '${status}'` : ''}
            ${orderno ? `AND orderno = '${orderno}'` : ''}
            ORDER BY serial_id DESC`;

            request.query(sqlQuery, (err, recordset) => {
                if(err) {
                    debug(err);
                    return reject(err);
                }

                resolve(recordset.recordset);
            });
        }).catch(err => {
            return err;
        });
    }
    
    return {
        searchSerials
    }
}

module.exports = serialModel();