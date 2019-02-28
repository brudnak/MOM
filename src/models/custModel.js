const debug = require('debug')('MOM:model:cust');
const sql = require('mssql');
require("msnodesqlv8");

function custModel() {
    function getCustSearch(firstname, lastname, company, zipcode, phone, email) {
        return new Promise((resolve, reject) => {
            debug(`Searching cust`)
            const request = new sql.Request();
            const sqlQuery = `SELECT custnum, firstname, lastname, company, city, state, zipcode, phone, email
            FROM cust
            WHERE 1=1
            ${firstname ? `AND firstname like '%${firstname}%'` : ''}
            ${lastname ? `AND lastname like '%${lastname}%'` : ''}
            ${company ? `AND company like '%${company}%'` : ''}
            ${zipcode ? `AND zipcode = '${zipcode}'` : ''}
            ${email ? `AND email like '%${email}%'` : ''}
            ORDER BY lastname, firstname`;

            debug(sqlQuery);

            request.query(sqlQuery, (err, recordset) => {
                if(err) {
                    return reject(err);
                }

                resolve(recordset.recordset);
            })
        }).catch(err => {
            return err;
        })
    }

    function getCustOrders(custnum) {
        return new Promise((resolve, reject) => {
            debug(`Getting orders for cust ${custnum}`)
            const request = new sql.Request();
            const sqlQuery = `SELECT orderno, cl_key, odr_date, ship_date, checkamoun, ord_total, order_st2, next_pay, ordertype
            FROM cms
            WHERE custnum = ${custnum}`;

            request.query(sqlQuery, (err, recordset) => {
                if(err) {
                    return reject(err);
                }
                resolve(recordset.recordset);
            })
        })
    }

    function getCustInfo(custnum) {
        return new Promise((resolve, reject) => {
            debug(`Getting cust ${custnum}`);
            const request = new sql.Request();
            const sqlQuery = `SELECT lastname, firstname, company, addr, addr2, city, county, state, zipcode, country, phone, phone2, ar_balance, comment, net, gross, email, 
            tax_id 
            FROM cust
            WHERE custnum = ${custnum}`;

            request.query(sqlQuery, (err, recordset) => {
                if(err) {
                    return reject(err);
                }
                if(!recordset.recordset[0]) {
                    return reject(`Customer ${custnum} was not found.`);
                }
                resolve(recordset.recordset[0]);
            })
        })
    }

    return {
        getCustSearch,
        getCustOrders,
        getCustInfo
    }
}

module.exports = custModel();