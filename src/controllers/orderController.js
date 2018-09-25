const sql = require('mssql');
require("msnodesqlv8");
const shipstation = require('../modules/shipstation');
const request = require('request');

function orderController() {
    function getShippingCost(orderID) {
        return new Promise((resolve, reject) => {
            request({
                method: 'GET',
                url: `https://ssapi.shipstation.com/shipments?orderNumber=${orderID}`,
                headers: {
                    "Content-Type": "application/json",
                    'Authorization': `Basic ${shipstation}`
                },
            }, (err, response, body) => {
                if(err || body=='Too Many Request') {
                    return reject(err);
                }

                body = JSON.parse(body);
                if(body.total==0) {
                    resolve([]);
                };

                resolve(body.shipments);
            })
        })
    }

    function getOrder(orderID) {
        return new Promise(function(resolve,reject) {
            console.log(`Retrieving Order ${orderID}`);
            const request = new sql.Request();
            const sqlQuery = `SELECT cms.orderno,cl_key,cms.odr_date,tax,shipping+tb_ship as 'shipping',tb_merch,tb_ship,checkamoun as 'paid',ord_total,staxrate,cms.sales_id,order_st2,next_pay,ordertype,ponumber,alt_order,
            billto.custnum AS 'billcustnum',billto.lastname AS 'billlastname',billto.firstname AS 'billfirstname',billto.company AS 'billcompany',billto.addr AS 'billaddr',billto.addr2 AS 'billaddr2',billto.city AS 'billcity',billto.state AS 'billstate',billto.zipcode AS 'billzipcode',
            shipto.custnum,shipto.lastname,shipto.firstname,shipto.company,shipto.addr,shipto.addr2,shipto.city,shipto.state,shipto.zipcode
            FROM cms
            LEFT JOIN cust AS billto ON cms.custnum = billto.custnum
            LEFT JOIN cust AS shipto ON cms.shipnum = shipto.custnum
            WHERE orderno = '${orderID}'`;
            
            request.query(sqlQuery, (err, recordset) => {
                if (err) {
                    return reject(err);
                }

                let order = recordset.recordset[0];

                getShippingCost(order.alt_order.trim().length==19 ? order.alt_order : orderID).then(boxes => {
                    order.boxes = boxes;
                    resolve(order);
                }).catch(err=> {
                    order.boxes = [];
                    console.log(err, 'Cannot obtain shipping cost');
                    order.shipErr = 'Reached API limit. Please try again in one minute.';
                    resolve(order);
                });
            }); 
        });
    }

    function getLineItems(orderID) {
        return new Promise((resolve, reject) => {
            console.log(`Retrieving Line Items for Order ${orderID}`);
            const request = new sql.Request();
            const sqlQuery = `SELECT item, quanto, quantb, quants, it_uncost, it_unlist, dropship, item_state, ponumber FROM items WHERE orderno = '${orderID}'`;

            request.query(sqlQuery, (err, recordset) => {
                if (err) {
                    return reject(err);
                }
                resolve(recordset.recordset);
            });
        });
    }

    function getOrderPOs(orderID) {
        return new Promise((resolve, reject) => {
            console.log(`Retrieving POs for Order ${orderID}`);
            const request = new sql.Request();
            const sqlQuery = `SELECT ponumber, supplier, odr_date, ord_total, shipping FROM purchase WHERE orderno = '${orderID}'`;

            request.query(sqlQuery, (err, recordset) => {
                if (err) {
                    return reject(err);
                }
                resolve(recordset.recordset);
            });
        });
    }

    function getOrderMemo(orderID) {
        return new Promise((resolve, reject) => {
            console.log(`Retrieving Order Memos for Order ${orderID}`);
            const request = new sql.Request();
            const sqlQuery = `SELECT notes FROM ordmemo WHERE orderno = '${orderID}' ORDER BY ordmemo_id DESC`;

            request.query(sqlQuery, (err, recordset) => {
                if (err) {
                    return reject(err);
                }
                resolve(recordset.recordset);
            });
        });
    }

    function getOrderAudits(orderID) {
        return new Promise((resolve, reject) => {
            console.log(`Retreiving Order Audits for Order ${orderID}`);
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
        })
    }

    function getOrderAttachments(orderID) {
        return new Promise((resolve, reject) => {
            console.log(`Retrieving Order Attachments for Order ${orderID}`);
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
        })
    }

    function displayOrder(req, res) {
        const { orderno } = req.params;
        Promise.all([getOrder(orderno), getLineItems(orderno), getOrderMemo(orderno), getOrderAudits(orderno), getOrderAttachments(orderno), getOrderPOs(orderno)]).then(([orderInfo, itemsInfo, orderMemos, orderAudits, orderAttachments, POs]) => {
            if(!orderInfo) {
                res.render(
                    '404',
                    {
                      type: 'order',
                      number: orderno
                    }
                )
            } else {
                console.log(orderInfo.boxes);

                // Calculate total merchandise cost and list
                let totalCost = 0; let totalList = 0;
                itemsInfo.forEach(item => {
                    if(item.item_state != 'SV') {
                        totalCost += item.it_uncost.toFixed(2)*item.quanto;
                    }  
                    totalList += item.it_unlist.toFixed(2)*item.quanto; 
                })

                // Calculate shipping cost
                let shipCost = 0;
                if(orderInfo.boxes) {
                    orderInfo.boxes.forEach(shipment => {
                        shipCost += shipment.shipmentCost;
                    });
                }

                let dropshipShipping = 0;
                POs.forEach(PO => {
                  dropshipShipping += PO.shipping;
                })
                
                // Calculate profitability after shipping costs and fees
                const totalMinusTax = orderInfo.ord_total-orderInfo.tax;
                let commission = 0; 
                if(['AMAZON','WAL','EBAY','EBAYCPR','AMZPRIME','AMZVC'].includes(orderInfo.cl_key.trim())) {
                  if(['EBAY','EBAYCPR'].includes(orderInfo.cl_key.trim())) {
                    commission = Math.min(750, totalMinusTax*.10);
                  } else if(orderInfo.cl_key.trim()=='WAL') {
                    commission = Math.max(1, totalMinusTax*.15);
                  } else if(orderInfo.cl_key.trim()=='AMAZON' || orderInfo.cl_key.trim()=='AMZPRIME') {
                    commission = Math.max(1, totalMinusTax*.15);
                  } else if(orderInfo.cl_key.trim()=='AMZVC') {
                    commission = Math.max(1, totalMinusTax*.02);
                  }
                }

                const totalShipping = dropshipShipping + shipCost;
                const commissionPercent = ['AMAZON','WAL','EBAY','EBAYCPR','AMZPRIME','AMZVC'].includes(orderInfo.cl_key.trim()) ? ((commission / totalMinusTax) * 100).toFixed(0) : 0;
                const shippingPercent = ((totalShipping / totalMinusTax) * 100).toFixed(0);
                const merchPercent = ((totalCost / totalMinusTax) * 100).toFixed(0);
                const profitPercent = (100-commissionPercent-shippingPercent-merchPercent).toFixed(0);

                

                res.render(
                    'order',
                    {
                        orderno,
                        orderInfo,
                        itemsInfo,
                        orderMemos,
                        orderAudits,
                        orderAttachments,
                        POs,
                        totalList,
                        totalCost,
                        shipCost,
                        orderProfit: {
                            commissionPercent,
                            shippingPercent,
                            merchPercent,
                            profitPercent,
                            totalShipping,
                            commission
                        }
                    } 
                )   
            };
        }).catch(err => {
            res.send(err)
        });
    }

    function searchOrders(startdate, enddate, altorderno, clkey, status, salesperson, ordertotal, sku, includefba) {
        return new Promise((resolve, reject) => {
            sku = sku.toUpperCase();
            console.log(`Retreiving order search`);
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
                // (async () => {
                //     let promisearr = []
                //     for(let i=0; i<40 && i<recordset.recordset.length; i++) {
                //         promisearr.push(getShippingCost(recordset.recordset[i].alt_order.trim().length==19 ? recordset.recordset[i].alt_order : recordset.recordset[i].orderno).then(shippingCost=> {
                //             recordset.recordset[i].shippingCost = shippingCost;
                //             console.log(recordset.recordset[i].orderno + ' ' + recordset.recordset[i].shippingCost);
                //         }).catch((err) => {
                //             console.log(err);
                //         }))
                //     }

                //     Promise.all(promisearr).then(([shippingCosts]) => {
                //         resolve(recordset.recordset);
                //     }).catch((err) => {
                //         res.send(err);
                //     }) 
                // })();
                resolve(recordset.recordset);
            })
        })
    }

    function displayOrderSearch(req, res) {
        const { startdate, enddate, altorderno, clkey, status, salesperson, ordertotal, sku, includefba } = req.query;
        searchOrders(startdate, enddate, altorderno, clkey, status, salesperson, ordertotal, sku, includefba).then((orders) => {
            res.render(
                'orderResults',
                { 
                    params: req.query,
                    orders,
                }
            )
        }).catch((err) => {
            res.send(err);
        });
    }

    return {
        displayOrder,
        displayOrderSearch
    };
}


module.exports = orderController;