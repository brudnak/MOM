const debug = require('debug')('MOM:model:ap');
const sql = require('mssql');
require("msnodesqlv8");

function apModel() {
    function searchAps(query) {
        return new Promise((resolve, reject) => {
            debug(`Retrieving APs: ${query.invoicenumber}, ${query.ponumber}, ${query.supplier}, ${query.payment}, ${query.paymentMin}`)
            const request = new sql.Request();
            const sqlQuery = `SELECT invoice, paydate, ponumber, supplier, userid, payment, check_no
            FROM appaymnt
            WHERE 1=1
            ${query.invoicenumber ? `AND invoice like '%${query.invoicenumber}%'` : ''}
            ${query.ponumber ? `AND ponumber = ${query.ponumber}` : ''}
            ${query.supplier ? `AND supplier = '${query.supplier}'` : ''}
            ${query.payment ? `AND payment = ${query.payment}` : ''} 
            ${query.paymentMin ? `AND payment >= ${query.paymentMin}` : ''} 
            ORDER BY paydate DESC`;

            request.query(sqlQuery, (err, recordset) => {
                if (err) {
                    return reject(err);
                };
                resolve(recordset.recordset);
            })
        }) 
        
    }

    return {
        searchAps
    }
}

module.exports = apModel();