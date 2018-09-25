const sql = require('mssql');
require("msnodesqlv8");

function custController() {
    function getCustSearch(firstname, lastname, company, zipcode, phone, email) {
        return new Promise((resolve, reject) => {
            console.log(`Searching cust`)
            const request = new sql.Request();
            const sqlQuery = `SELECT custnum, firstname, lastname, company, city, state, zipcode, phone, email
            FROM cust
            WHERE 1=1
            ${firstname ? `AND firstname like '%${firstname}%'` : ``}
            ${lastname ? `AND lastname like '%${lastname}%'` : ``}
            ${company ? `AND company like '%${company}%'` : ``}
            ${zipcode ? `AND zipcode = '${zipcode}'` : ``}
            ${phone ? `AND phone = '${phone}'` : ``}
            ${email ? `AND email like '%${email}%'` : ``}
            ORDER BY lastname, firstname`;

            request.query(sqlQuery, (err, recordset) => {
                if(err) {
                    return reject(err);
                }
                resolve(recordset.recordset);
            })
        })
    }

    function getCustOrders(custnum) {
        return new Promise((resolve, reject) => {
            console.log(`Getting orders for cust ${custnum}`)
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
            console.log(`Getting cust ${custnum}`);
            const request = new sql.Request();
            const sqlQuery = `SELECT lastname, firstname, company, addr, addr2, city, county, state, zipcode, country, phone, phone2, ar_balance, comment, net, gross, email, 
            tax_id 
            FROM cust
            WHERE custnum = ${custnum}`;

            request.query(sqlQuery, (err, recordset) => {
                if(err) {
                    return reject(err);
                }
                resolve(recordset.recordset[0]);
            })
        })
    }

    function displayCust(req, res) {
        const { custnum } = req.params;

        Promise.all([getCustInfo(custnum), getCustOrders(custnum)]).then(([custInfo, custOrders]) => {
            res.render(
                'cust',
                {
                    custnum,
                    custInfo,
                    custOrders
                }
            )
        });
    }

    function displayCustSearch(req, res) {
        const { firstname, lastname, company, zipcode, phone, email } = req.query;

        getCustSearch(firstname, lastname, company, zipcode, phone, email).then(customers => {
            res.render(
                'custResults',
                {
                    params: req.query,
                    customers
                }
            )
        })
    }

    return {
        displayCust,
        displayCustSearch,
    }
}

module.exports = custController;