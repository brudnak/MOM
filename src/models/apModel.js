const sql = require('mssql');
require("msnodesqlv8");

function apModel() {
    function searchAps(invoicenumber, ponumber, supplier, payment) {
        return new Promise((resolve, reject) => {
            console.log(`Retrieving APs: ${invoicenumber}, ${ponumber}, ${supplier}, ${payment}`)
            const request = new sql.Request();
            const sqlQuery = `SELECT invoice, paydate, ponumber, supplier, userid, payment, check_no
            FROM appaymnt
            WHERE 1=1
            ${invoicenumber ? `AND invoice like '%${invoicenumber}%'` : ''}
            ${ponumber ? `AND ponumber = ${ponumber}` : ''}
            ${supplier ? `AND supplier = '${supplier}'` : ''}
            ${payment ? `AND payment = ${payment}` : ''} 
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