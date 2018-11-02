const debug = require('debug')('MOM:model:order');
const sql = require('mssql');
require("msnodesqlv8");
const shipstation = require('../modules/shipstation');

function orderModel() {
    function getOrder(orderID) {
        return new Promise(function(resolve,reject) {
            debug(`Retrieving Order ${orderID}`);
            const request = new sql.Request();
            const sqlQuery = `SELECT cms.orderno,cl_key,cms.odr_date,tax,shipping+tb_ship as 'shipping',tb_merch,tb_ship,checkamoun as 'paid',ord_total,staxrate,cms.sales_id,order_st2,next_pay,ordertype,ponumber,alt_order,
            billto.custnum AS 'billcustnum',billto.lastname AS 'billlastname',billto.firstname AS 'billfirstname',billto.company AS 'billcompany',billto.addr AS 'billaddr',billto.addr2 AS 'billaddr2',billto.city AS 'billcity',billto.state AS 'billstate',billto.zipcode AS 'billzipcode',
            shipto.custnum,shipto.lastname,shipto.firstname,shipto.company,shipto.addr,shipto.addr2,shipto.city,shipto.state,shipto.zipcode,
            cms.tpshiptype, cms.tpshipacct
            FROM cms
            LEFT JOIN cust AS billto ON cms.custnum = billto.custnum
            LEFT JOIN cust AS shipto ON cms.shipnum = shipto.custnum
            WHERE cms.orderno = '${orderID}'`;
              
            request.query(sqlQuery, (err, recordset) => {
                if (err) {
                    return reject(err);
                }

                let order = recordset.recordset[0];

                shipstation.getShippingCost(order.alt_order.trim().length==19 ? order.alt_order : orderID).then(boxes => {
                    order.boxes = boxes;
                    resolve(order);
                }).catch(err=> {
                    order.boxes = [];
                    debug(err, 'Cannot obtain shipping cost');
                    order.shipErr = 'Reached API limit. Please try again in one minute.';
                    resolve(order);
                });
            }); 
        }).catch(err => {
            debug(err);
        });
    }

    function getLineItems(orderID) {
        return new Promise((resolve, reject) => {
            debug(`Retrieving Line Items for Order ${orderID}`);
            const request = new sql.Request();
            const sqlQuery = `SELECT item, quanto, quantb, quants, it_uncost, it_unlist, dropship, item_state, ponumber FROM items WHERE orderno = '${orderID}'`;

            request.query(sqlQuery, (err, recordset) => {
                if (err) {
                    return reject(err);
                }
                resolve(recordset.recordset);
            });
        }).catch(err => {
            debug(err);
        });
    }

    function getOrderPOs(orderID) {
        return new Promise((resolve, reject) => {
            debug(`Retrieving POs for Order ${orderID}`);
            const request = new sql.Request();
            const sqlQuery = `SELECT ponumber, supplier, odr_date, ord_total, shipping FROM purchase WHERE orderno = '${orderID}'`;

            request.query(sqlQuery, (err, recordset) => {
                if (err) {
                    return reject(err);
                }
                resolve(recordset.recordset);
            });
        }).catch(err => {
            debug(err);
        });
    }

    function getOrderMemo(orderID) {
        return new Promise((resolve, reject) => {
            debug(`Retrieving Order Memos for Order ${orderID}`);
            const request = new sql.Request();
            const sqlQuery = `SELECT notes,fulfill,desc1,desc2,desc3,desc4,desc5,desc6 FROM ordmemo WHERE orderno = '${orderID}' ORDER BY ordmemo_id DESC`;

            request.query(sqlQuery, (err, recordset) => {
                if (err) {
                    return reject(err);
                }
                resolve(recordset.recordset);
            });
        }).catch(err => {
            debug(err);
        });
    }

    function getOrderAudits(orderID) {
        return new Promise((resolve, reject) => {
            debug(`Retreiving Order Audits for Order ${orderID}`);
            const request = new sql.Request();
            const sqlQuery = `SELECT auditon, userid, auditdate, beforevalue, aftervalue FROM useractivity
            WHERE audittype = 'O' AND auditkey = '${orderID}'
            ORDER BY auditdate DESC`;

            request.query(sqlQuery, (err, recordset) => {
                if(err) {
                    return reject(err);
                }
                resolve(recordset.recordset);
            })
        }).catch(err => {
            debug(err);
        });
    }

    function getOrderAttachments(orderID) {
        return new Promise((resolve, reject) => {
            debug(`Retrieving Order Attachments for Order ${orderID}`);
            const request = new sql.Request();
            const sqlQuery = `SELECT filedesc, filepath, filetype, entrydate, userid
            FROM fileattach
            WHERE keytype = 'O' AND keyid = ${orderID}
            ORDER BY entrydate ASC`;

            request.query(sqlQuery, (err, recordset) => {
                if(err) {
                    return reject(err);
                }
                resolve(recordset.recordset);
            })
        }).catch(err => {
            debug(err);
        });
    }

    function searchOrders(startdate, enddate, altorderno, clkey, status, salesperson, ordertotal, sku, includefba) {
        return new Promise((resolve, reject) => {
            sku = sku.toUpperCase();
            debug(`Retreiving order search`);
            const request = new sql.Request();
            const sqlQuery = `SELECT cms.orderno,cms.cl_key,cms.odr_date,cms.checkamoun,cms.ord_total,cms.sales_id,cms.order_st2,cms.next_pay,cms.ordertype,cms.alt_order
            FROM cms
            ${sku ? `INNER JOIN items ON items.orderno = cms.orderno` : ''}
            WHERE cms.odr_date BETWEEN '${startdate}' AND '${enddate}'
            ${altorderno ? `AND cms.alt_order = '${altorderno}'` : ''}
            ${clkey ? `AND cms.cl_key = '${clkey}'` : ''}
            ${status ? `AND cms.order_st2 = '${status}'` : ''}
            ${salesperson ? `AND cms.sales_id = '${salesperson}'` : ''}
            ${ordertotal ? `AND cms.ord_total = ${ordertotal}` : ''}
            ${includefba=='false' ? `AND cms.ordertype <> 'FBA'` : ''}
            ${sku ? `AND item = '${sku}' GROUP BY cms.orderno,cms.cl_key,cms.odr_date,cms.checkamoun,cms.ord_total,cms.sales_id,cms.order_st2,cms.next_pay,cms.ordertype,cms.alt_order` : ''}
            ORDER BY cms.odr_date DESC`;

            request.query(sqlQuery, (err, recordset) => {
                if(err) {
                    return reject(err);
                }
                resolve(recordset.recordset);
            })
        }).catch(err => {
            debug(err);
        });
    }

    return {
        getOrder,
        getLineItems,
        getOrderPOs,
        getOrderMemo,
        getOrderAudits,
        getOrderAttachments,
        searchOrders
    }
}

module.exports = orderModel();