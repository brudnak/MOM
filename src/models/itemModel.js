const debug = require('debug')('MOM:model:item');
const sql = require('mssql');
require("msnodesqlv8");
const shipstation = require('../modules/shipstation');
const mws = require('../modules/amazonmws')();

function itemModel() {
    function getShippingRates(dimensions) {
        return new Promise((resolve, reject) => {
            let rates = [];
            if(dimensions.height != 0 && dimensions.weight !=0 && dimensions.length != 0 && dimensions.width != 0) {
                Promise.all([shipstation.getShippingRates(dimensions, 'ups'), shipstation.getShippingRates(dimensions, 'stamps_com'), shipstation.getShippingRates(dimensions, 'fedex')])
                    .then(([upsRates, uspsRates, fedExRates]) => {
                        rates = [...upsRates, ...uspsRates, ...fedExRates];
                        resolve({ rates });
                    }).catch(err => {
                        resolve('Reached API limit. Please try again in one minute.');
                    });
            } else {
                resolve('Not enough dimensions to pull estimated shipping.')
            }
        });
    }

    function getItem(sku) {
        return new Promise((resolve, reject) => {
            debug(`Retrieving Item Info for ${sku}`)
            const request = new sql.Request();
            const sqlQuery = `SELECT desc1, desc2, units, fbaunits, low, uncost, price1, bounits, onorder, commited, break_out, notation, 
            nonproduct, serial, discont, upccode, blength, bwidth, bheight, unitweight, min_price, lu_by, lu_on,
            advanced1, advanced2, advanced3, advanced4
            FROM stock
            WHERE number = '${sku}'`;

            request.query(sqlQuery, (err, recordset) => {
                if(err) {
                    return reject(err);
                }
                const item = recordset.recordset[0];

                if(!item) {
                    return reject(err);
                }

                item.rates = [];
                item.listings = [];

                Promise.all([mws.getLowestPriceByASIN(item.advanced1), getShippingRates({weight: item.unitweight, height: item.bheight, width: item.bwidth, length: item.blength})]).then(([amazonListing, shipRates]) => {
                    if(typeof(shipRates)==='string') {
                        item.shippingError = shipRates;
                    } else {
                        item.rates = shipRates.rates;
                    }
                    
                    debug(amazonListing.Summary);

                    if(amazonListing && amazonListing.Summary && amazonListing.Summary.TotalOfferCount > 0) {
                        item.listings.push({
                            marketplace: 'Amazon',
                            marketplaceId: item.advanced1,
                            lowestPrices: amazonListing.Summary.LowestPrices ? Array.isArray(amazonListing.Summary.LowestPrices.LowestPrice) ? amazonListing.Summary.LowestPrices.LowestPrice : [amazonListing.Summary.LowestPrices.LowestPrice]: '--', 
                            buyBoxPrice: amazonListing.Summary.BuyBoxPrices ? Array.isArray(amazonListing.Summary.BuyBoxPrices.BuyBoxPrice) ?  amazonListing.Summary.BuyBoxPrices.BuyBoxPrice : [amazonListing.Summary.BuyBoxPrices.BuyBoxPrice]: '--',
                            offers: amazonListing.Summary.TotalOfferCount
                        });
                    }

                    // Amazon throwing an error when I try to run concurrent amazon-mws requests, so I have to nest
                    mws.getMyPriceByASIN(item.advanced1).then(response => {
                        if(response && response.Product && response.Product.Offers && response.Product.Offers.Offer && Array.isArray(response.Product.Offers.Offer)) {
                            item.ourAmazonPrices = [];
                            response.Product.Offers.Offer.forEach(offer => {
                                item.ourAmazonPrices.push(offer);
                            });
                        }
                        resolve(item);
                    }).catch(err => {
                        debug(err);
                        resolve(item);   
                    });     
                });
            });
        });
    }

    function getOpenPOs(sku) {
        return new Promise((resolve, reject) => {
            debug(`Retreiving open POs for ${sku}`);
            const request = new sql.Request();
            const sqlQuery = `SELECT purchase.ponumber,quantity, delivered,unit_cost,orderno,reference,odr_date FROM puritem
                INNER JOIN purchase ON puritem.ponumber = purchase.ponumber
                WHERE number = '${sku}'
                AND quantity - delivered > 0`;

            request.query(sqlQuery, (err, recordset) => {
                if(err) {
                    return reject(err);
                }

                resolve(recordset.recordset);
            })
        });
    }

    function getItemBins(sku) {
        return new Promise((resolve, reject) => {
            debug(`Retrieving Item Bins for ${sku}`)
            const request = new sql.Request();
            const sqlQuery = `SELECT warehouse, bindesc, units, commited, rcommit, picked, dropship 
            FROM bin
            WHERE number = '${sku}'
            ORDER BY units DESC`;

            request.query(sqlQuery, (err, recordset) => {
                if(err) {
                    return reject(err);
                }
                resolve(recordset.recordset);
            })
        });
    }

    function getItemPrices(sku) {
        return new Promise((resolve, reject) => {
            debug(`Retrieving Item Prices for ${sku}`)
            const request = new sql.Request();
            const sqlQuery = `SELECT supplier, quantity, buydesc, unit_price, dropship, lead_avg
            FROM buyprice
            WHERE number = '${sku}'
            ORDER BY unit_price ASC`;

            request.query(sqlQuery, (err, recordset) => {
                if(err) {
                    return reject(err);
                }
                resolve(recordset.recordset);
            })
        });
    }

    function getItemTransactions(sku) {
        return new Promise((resolve, reject) => {
            debug(`Retrieving Item Transactions for ${sku}`)
            const request = new sql.Request();
            const sqlQuery = `SELECT trans_date, transtype, quantity, unit_cost, userid, notation
            FROM invtrans
            WHERE number = '${sku}' AND transtype <> 'S'
            ORDER BY trans_date DESC`;

            request.query(sqlQuery, (err, recordset) => {
                if(err) {
                    return reject(err);
                }
                resolve(recordset.recordset);
            })
        });
    }

    function getItemAudits(sku) {
        return new Promise((resolve, reject) => {
            debug(`Retrieving Order Audits for item ${sku}`);
            const request = new sql.Request();
            const sqlQuery = `SELECT auditon, userid, auditdate, beforevalue, aftervalue FROM useractivity
            WHERE audittype = 'P' AND auditkey = '${sku}'
            ORDER BY auditdate DESC`;

            request.query(sqlQuery, (err, recordset) => {
                if(err) {
                    return reject(err);
                }
                resolve(recordset.recordset);
            })
        });
    }

    function getItemSales(sku, days) {
        return new Promise((resolve, reject) => {
            debug(`Retrieving sales for ${sku} for past ${days} days.`)
            const request = new sql.Request();
            const sqlQuery = `SELECT cms.cl_key, SUM(items.quanto) as sales
            FROM items
            INNER JOIN cms ON items.orderno = cms.orderno
            WHERE item = '${sku}' AND cms.odr_date > DATEADD(DAY, -${days}, GETDATE()) AND item_state NOT IN ('QO','RT')
            GROUP BY cms.cl_key`;

            request.query(sqlQuery, (err, recordset) => {
                if(err) {
                    return reject(err);
                }

                resolve(recordset.recordset);
            })
        });
    }

    // function weeklyStockCoverage(sku) {
    //     return new Promise((resolve, reject) => {
    //         debug(`Retrieving weekly stock coverage for ${sku}`);
            
    //         Promise.all([getItemSales(sku, 7), getItemSales(sku, 30), getItemSales(sku, 90)]).then(([sales7, sales30, sales90]) => {
    //             const weeklyAvg = ((sales7 * 3) + (sales30 / 3 * 2) + (sales90 / 12))/6;

    //             //get stock

    //             //resolve stock / weeklyAvg

    //         }).catch(err => {
    //             reject(err);
    //         })
    //     });
    // }

    function getBreakout(sku) {
        return new Promise((resolve, reject) => {
            debug(`Retrieving Breakout Items for ${sku}`);
            const request = new sql.Request();
            const sqlQuery = `SELECT breakout.inv, breakout.q, breakout.price, stock.uncost, stock.units, stock.fbaunits, stock.price1
            FROM breakout
            INNER JOIN stock ON stock.number = breakout.inv
            WHERE prod = '${sku}'`;

            request.query(sqlQuery, (err, recordset) => {
                if(err) {
                    return reject(err);
                }
                resolve(recordset.recordset);
            })
        });
    }

    function getParents(sku) {
        return new Promise((resolve, reject) => {
            debug(`Retrieving Parent Breakouts for ${sku}`);
            const request = new sql.Request();
            const sqlQuery = `SELECT breakout.prod, breakout.q, stock.price1
            FROM breakout
            INNER JOIN stock ON stock.number = breakout.prod
            WHERE breakout.inv = '${sku}'`;

            request.query(sqlQuery, (err, recordset) => {
                if(err) {
                    return reject(err);
                }
                resolve(recordset.recordset);
            })
        });
    }

    function searchItems(sku, desc, supplier, page, stp) {
        return new Promise((resolve, reject) => {
            debug(`Retrieving item search for: ${sku}, ${desc}, ${supplier}`);
            const request = new sql.Request();
            let sqlQuery = ``
            if(page) {
                const step = stp || 50;

                sqlQuery = `WITH Data_CTE 
                AS
                (
                    SELECT ROW_NUMBER() OVER (ORDER BY stock.number) AS RowNum, stock.number, desc1, desc2, units, fbaunits, onorder, uncost, price1, blength, bwidth, bheight, unitweight,
                    advanced1, advanced2, advanced3, advanced4, break_out
                    FROM stock
                    ${supplier ? `INNER JOIN buyprice ON stock.number = buyprice.number` : ''}
                    WHERE 1=1
                    ${sku ? `AND stock.number like '%${sku}%'` : ''}
                    ${desc ? `AND (desc1 like '%${desc}%' OR desc2 like '%${desc}%')` : ''}
                    ${supplier ? `AND supplier = '${supplier}' GROUP BY stock.number, desc1, desc2, units, fbaunits, onorder, uncost, price1, blength, bwidth, bheight, unitweight,
                    advanced1, advanced2, advanced3, advanced4, break_out` : ''}
                ), 
                Count_CTE 
                AS 
                (
                    SELECT COUNT(*) AS TotalRows FROM Data_CTE
                )
                SELECT *
                FROM Data_CTE
                CROSS JOIN Count_CTE
                ORDER BY number
                OFFSET (${page} - 1) * ${step} ROWS
                FETCH NEXT ${step} ROWS ONLY;`
            } else {
                sqlQuery = `SELECT stock.number, desc1, desc2, units, fbaunits, onorder, uncost, price1, blength, bwidth, bheight, unitweight,
                advanced1, advanced2, advanced3, advanced4, break_out
                FROM stock
                ${supplier ? `INNER JOIN buyprice ON stock.number = buyprice.number` : ''}
                WHERE 1=1
                ${sku ? `AND stock.number like '%${sku}%'` : ''}
                ${desc ? `AND (desc1 like '%${desc}%' OR desc2 like '%${desc}%')` : ''}
                ${supplier ? `AND supplier = '${supplier}' GROUP BY stock.number, desc1, desc2, units, fbaunits, onorder, uncost, price1, blength, bwidth, bheight, unitweight,
                advanced1, advanced2, advanced3, advanced4, break_out` : ''}
                ORDER BY units-fbaunits DESC`;
            }

            request.query(sqlQuery, (err, recordset) => {
                if(err) {
                    return reject(err);
                }
                resolve(recordset.recordset);
            })
        });
    }

    return {
        getItem,
        getOpenPOs,
        getItemBins,
        getItemPrices,
        getItemTransactions,
        getItemAudits,
        getItemSales,
        getBreakout,
        getParents,
        searchItems
    }
}

module.exports = itemModel();  