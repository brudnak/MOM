const sql = require('mssql');
require("msnodesqlv8");
const shipstation = require('../modules/shipstation');
const debug = require('debug')('MOM:controller:ship');

function shipController() {
    function getOrders() {
        return new Promise((resolve, reject) => {
            debug('Retrieving orders to export to ShipStation');
            const request = new sql.Request();
            const sqlQuery = `SELECT cms.orderno, cms.odr_date, cms.sales_id, tpshiptype, tpshipwhat, tpshipacct, tpshipcc, tpshipexp, cms.custnum, shipnum, cms.cl_key, cms.shiplist,
            billto.lastname as 'billLastName', billto.firstname AS 'billFirstName', billto.company AS 'billCompany', billto.addr AS 'billAddress1', billto.addr2 AS 'billAddress2', billto.city AS 'billCity', 
            billto.state AS 'billState', billto.zipcode AS 'billZipcode', billcountry.ISO2 AS 'billCountry', billto.email AS 'billEmail', billto.phone AS 'billPhone',
            shipto.lastname as 'shipLastName', shipto.firstname AS 'shipFirstName', shipto.company AS 'shipCompany', shipto.addr AS 'shipAddress1', shipto.addr2 AS 'shipAddress2', shipto.city AS 'shipCity', 
            shipto.state AS 'shipState', shipto.zipcode AS 'shipZipcode', shipcountry.ISO2 AS 'shipCountry', shipto.email AS 'shipEmail', shipto.phone AS 'shipPhone', 
            notes.fulfill, notes.desc1, notes.desc2, notes.desc3, notes.desc4, notes.desc5, notes.desc6
            FROM cms
            LEFT JOIN cust AS billto ON cms.custnum = billto.custnum
            LEFT JOIN cust AS shipto ON cms.shipnum = shipto.custnum
            LEFT JOIN country AS billcountry ON billto.country = billcountry.COUNTRY_ID
            LEFT JOIN country AS shipcountry ON shipto.country = shipcountry.COUNTRY_ID
            LEFT JOIN ordmemo AS notes ON cms.orderno = notes.orderno
            WHERE cms.order_st2='IN' AND cl_key NOT IN ('AMAZON','AMZPRIME') AND cms.shiplist <> 'PUP'`;

            request.query(sqlQuery, (err, recordset) => {
                if(err) {
                    return reject(err);
                };

                let orderArray = []

                // ups_ground, ups_3_day_select, ups_2nd_day_air, ups_next_day_air_saver, ups_next_day_air, fedex_ground
                const tpcodes = {
                    'STU': 'ups_ground',
                    'STN': 'ups_next_day_air_saver',
                    'STF': 'fedex_ground',
                    'FEG': 'fedex_ground',
                    'FEH': 'fedex_ground',
                    'FEP': 'fedex_ground',
                    'FES': 'fedex_ground',
                    'F2D': 'fedex_2nd_day',
                    'UP2': 'ups_2nd_day_air',
                    'UP3': 'ups_3_day_select',
                    'UPA': 'ups_ground',
                    'UPC': 'ups_ground',
                    'UPN': 'ups_next_day_air_saver',
                    'UPS': 'ups_ground'
                }
	
                //for each line, add order to orderArray
                for (let i = 0; i < recordset.recordset.length; i++) {
                    const order = recordset.recordset[i]
                    
                    let processedOrder = {
                        orderNumber: order.orderno,
                        orderDate: order['odr_date'],
                        paymentDate: order['odr_date'],
                        orderStatus: 'awaiting_shipment',
                        customerUsername: order.billFirstName.trim() + ' ' + order.billLastName.trim(),
                        customerEmail: order.billEmail.trim(),
                        billTo: {
                            name: order.billFirstName.trim() + ' ' + order.billLastName.trim(),
                            company: order.billCompany.trim(),
                            street1: order.billAddress1.trim(),
                            street2: order.billAddress2.trim(),
                            city: order.billCity.trim(),
                            state: order.billState.trim(),
                            postalCode: order.billZipcode.trim(),
                            country: order.billCountry ? order.billCountry.trim() : '',
                            phone: order.billPhone.trim()
                        },
                        //want to also add default weigh, dimensions, and insurance, but this could cause an issue when dealing with multiple items
                        //causing null error
                        //internalNotes: order.desc1.trim() + ' ' + order.desc2.trim() + ' ' + order.desc3.trim() + ' ' + order.desc4.trim() + ' ' + order.desc5.trim() + ' ' + order.desc6.trim(),
                        requestedShippingService: order.fulfill ? order.fulfill.trim() : '',
                        advancedOptions: {
                            customField1: order.desc1 + ' ' + order.desc2,
                            customField2: order.desc3 + ' ' + order.desc4,
                            customField3: order.desc5 + ' ' + order.desc6,
                            source: order['cl_key'].trim()
                        }	
                    }	
                    
                    if(order.shipnum=='') {
                        processedOrder.shipTo = {
                            name: order.billFirstName.trim() + ' ' + order.billLastName.trim(),
                            company: order.billCompany.trim(),
                            street1: order.billAddress1.trim(),
                            street2: order.billAddress2.trim(),
                            city: order.billCity.trim(),
                            state: order.billState.trim(),
                            postalCode: order.billZipcode.trim(),
                            country: order.billCountry ? order.billCountry.trim() : '',
                            phone: order.billPhone.trim()
                        }
                    } else {
                        processedOrder.shipTo = {
                            name: order.shipFirstName.trim() + ' ' + order.shipLastName.trim(),
                            company: order.shipCompany.trim(),
                            street1: order.shipAddress1.trim(),
                            street2: order.shipAddress2.trim(),
                            city: order.shipCity.trim(),
                            state: order.shipState.trim(),
                            postalCode: order.shipZipcode.trim(),
                            country: order.shipCountry ? order.shipCountry.trim() : '',
                            phone: order.shipPhone.trim()
                        }
                    }
                    
                    if(order.tpshiptype==2) {
                        processedOrder.carriercode = ['FEG','FEH','FEP','FES','STF','F2D','F3D'].includes(order.shiplist) ? 'fedex' : 'ups';
                        processedOrder.servicecode = tpcodes[order.shiplist] ? tpcodes[order.shiplist] : null; 
                        processedOrder.advancedOptions.billToParty = 'third_party';
                        processedOrder.advancedOptions.billToAccount = order.tpshipacct;
                        processedOrder.advancedOptions.billToPostalCode = order.billZipcode.trim()
                        processedOrder.advancedOptions.billToCountryCode = order.billCountry.trim()
                    }
                    
                    orderArray.push(processedOrder)
                }

                resolve(orderArray);
            })
        });
    }

    function displayOrders(req, res) {
        getOrders().then(orders => {
            res.render(
                'shippingOrders',
                {
                    orders
                }
            )
        }).catch(err => {
            res.render('error', {
                err
            });  
        });
    }

    function displayExportOrders(req, res) {
        getOrders().then(orders => {
            shipstation.exportOrders(orders).then(results => {
                res.render(
                    'shippingExport',
                    {
                        results
                    }
                )
            })
        }).catch(err => {
            res.render('error', {
                err
            });  
        });
    }

    return {
        displayOrders,
        displayExportOrders
    }
}

module.exports = shipController;