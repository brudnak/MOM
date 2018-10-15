const sql = require('mssql');
require("msnodesqlv8");
const shipstation = require('../modules/shipstation');
const request = require('request');
const mws = require('../modules/amazonmws')();

function itemController() {
    function getShippingRates(dimensions, carrier) {
        return new Promise((resolve, reject) => {
            const { weight, height, width, length } = dimensions;
            request({
                    method: 'POST',
                    url: 'https://ssapi.shipstation.com/shipments/getrates',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Basic ${shipstation}`
                    },
                    body: `{  
                        "carrierCode": '${carrier}',  
                        "serviceCode": null,  
                        "packageCode": null,  
                        "fromPostalCode": "85282",  
                        "toState": "ME",  
                        "toCountry": "US",  
                        "toPostalCode": "03904",  
                        "toCity": "Washington",  
                        "weight": {      
                            "value": ${weight},    
                            "units": "pounds"  
                        },  
                        "dimensions": {    
                            "units": "inches",    
                            "length": ${length},    
                            "width": ${width},   
                            "height": ${height}  
                        },  
                        "confirmation": "delivery",  
                        "residential": true
                    }"`
                }, function (err, response, body) {
                    if(err || body=='Too Many Request') {
                        return reject(err);
                    }
    
                    body = JSON.parse(body);

                    if(Array.isArray(body)) {
                        resolve(body);
                    } else { // cannot ship that carrier
                        resolve([]);
                    }
            });
        })
    }

    function getUpsUspsRates(dimensions) {
        return new Promise((resolve, reject) => {
            let rates = [];
            if(dimensions.height != 0 && dimensions.weight !=0 && dimensions.length != 0 && dimensions.width != 0) {
                Promise.all([getShippingRates(dimensions, 'ups'), getShippingRates(dimensions, 'stamps_com')])
                    .then(([upsRates, uspsRates]) => {
                        rates = [...upsRates, ...uspsRates];
                        resolve({ rates });
                    }).catch(err => {
                        resolve({ rates, err: 'Reached API limit. Please try again in one minute.' });
                    });
            } else {
                resolve({ rates, err: 'Not enough dimensions to pull estimated shipping.' })
            }
        })
    }

    function getItem(sku) {
        return new Promise((resolve, reject) => {
            console.log(`Retrieving Item Info for ${sku}`)
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

                (async () => {
                    try {
                        Promise.all([mws.getLowestPriceByASIN(item.advanced1), getUpsUspsRates({weight: item.unitweight, height: item.bheight, width: item.bwidth, length: item.blength})]).then(([amazonListing, shipRates]) => {
                            if(shipRates.err) {
                                item.shippingError = shipRates.err;
                            }
                            item.rates = shipRates.rates;
                            
                            if(amazonListing && amazonListing.Summary && amazonListing.Summary.TotalOfferCount > 0) {
                                item.listings.push({
                                    marketplace: 'Amazon',
                                    marketplaceId: item.advanced1,
                                    lowestPrices: amazonListing.Summary.LowestPrices.LowestPrice, 
                                    buyBoxPrice: amazonListing.Summary.BuyBoxPrices.BuyBoxPrice.LandedPrice.Amount,
                                    offers: amazonListing.Summary.TotalOfferCount
                                });
                            }

                            // Amazon throwing an error when I try to run concurrent amazon-mws requests, so I have to nest
                            mws.getMyPriceByASIN(item.advanced1).then(response => {
                                item.ourAmazonPrice = response && response.Product && response.Product.Offers && response.Product.Offers.Offer && response.Product.Offers.Offer.BuyingPrice && response.Product.Offers.Offer.BuyingPrice.LandedPrice.Amount ? response.Product.Offers.Offer.BuyingPrice.LandedPrice.Amount : null;
                                resolve(item);
                            }).catch(err => {
                                console.log(err);
                                resolve(item);   
                            });

                            
                        })
                    } catch(e) {
                        console.log(e);
                        item.shippingError = e;
                        resolve(item);
                    } 
                })();
            })
        })
    }

    function getOpenPOs(sku) {
        return new Promise((resolve, reject) => {
            console.log(`Retreiving open POs for ${sku}`);
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
        })
    }

    function getItemBins(sku) {
        return new Promise((resolve, reject) => {
            console.log(`Retrieving Item Bins for ${sku}`)
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
        })
    }

    function getItemPrices(sku) {
        return new Promise((resolve, reject) => {
            console.log(`Retrieving Item Prices for ${sku}`)
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
        })
    }

    function getItemTransactions(sku) {
        return new Promise((resolve, reject) => {
            console.log(`Retrieving Item Transactions for ${sku}`)
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
        })
    }

    function getItemAudits(sku) {
        return new Promise((resolve, reject) => {
            console.log(`Retrieving Order Audits for item ${sku}`);
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
        })
    }

    function getItemSales(sku, days) {
        return new Promise((resolve, reject) => {
            console.log(`Retrieving sales for ${sku} for past ${days} days.`)
            const request = new sql.Request();
            const sqlQuery = `SELECT cms.cl_key, SUM(items.quanto) as sales
            FROM items
            INNER JOIN cms ON items.orderno = cms.orderno
            WHERE item = '${sku}' AND cms.odr_date > DATEADD(DAY, -${days}, GETDATE()) AND item_state <> 'QO'
            GROUP BY cms.cl_key`;

            request.query(sqlQuery, (err, recordset) => {
                if(err) {
                    return reject(err);
                }

                resolve(recordset.recordset);
            })
        })
    }

    function getBreakout(sku) {
        return new Promise((resolve, reject) => {
            console.log(`Retrieving Breakout Items for ${sku}`);
            const request = new sql.Request();
            const sqlQuery = `SELECT breakout.inv, breakout.q, breakout.price, stock.uncost
            FROM breakout
            INNER JOIN stock ON stock.number = breakout.inv
            WHERE prod = '${sku}'`;

            request.query(sqlQuery, (err, recordset) => {
                if(err) {
                    return reject(err);
                }
                resolve(recordset.recordset);
            })
        })
    }

    function displayItem(req, res) {
        let { sku } = req.params;
        sku = sku.toUpperCase();

        Promise.all([getItem(sku), getItemBins(sku), getItemPrices(sku), getItemTransactions(sku), getBreakout(sku), getItemAudits(sku), getOpenPOs(sku), getItemSales(sku, 30), getItemSales(sku, 60), getItemSales(sku, 90), getItemSales(sku, 160), getItemSales(sku, 270), getItemSales(sku, 360)])
        .then(([itemInfo, itemBins, itemPrices, itemTrans, itemBreakout, itemAudits, openPOs, sales30, sales60, sales90, sales180, sales270, sales360]) => {
            if (!itemInfo) {
                res.render(
                    '404',
                    {
                        type: 'item',
                        number: sku
                    }
                )
            } else {
                var lowestShipping, ups2dayShipping, upsNextDay;
                lowestShipping = 999;
                const recommendedPricing = [{marketplace: 'Amazon FBM'}, {marketplace: 'Amazon Prime'}, {marketplace: 'Amazon FBA'}, {marketplace: 'Vendor Central'}, {marketplace: 'Walmart'}, {marketplace: 'Ebay'}];
                    
                var unitCost = itemInfo.uncost;

                if(itemInfo.break_out==1) {
                    itemBreakout.forEach(piece => {
                        unitCost += piece.uncost * piece.q;
                    })
                }

                const itemSales = {
                    '30 day': sales30,
                    '60 day': sales60,
                    '90 day': sales90,
                    '180 day': sales180,
                    '270 day': sales270,
                    '360 day': sales360
                }

                const ratesToDisplay = {
                    'USPS PRIORITY MAIL - PACKAGE': 'USPS PM',
                    'USPS FIRST CLASS MAIL - PACKAGE': 'USPS FC',
                    'UPS® GROUND': 'UPS Ground',
                    'UPS 2ND DAY AIR®': 'UPS 2nd Day',
                    'UPS NEXT DAY AIR SAVER®': 'UPS Next Day Saver'
                }

                itemInfo.rates = itemInfo.rates.filter(rate => ratesToDisplay[rate.serviceName.toUpperCase()])
                    .map(rate => { return {...rate, displayName: ratesToDisplay[rate.serviceName.toUpperCase()]}});
                
                itemInfo.rates.forEach(rate => {
                    lowestShipping = Math.min(lowestShipping, rate.shipmentCost + rate.otherCost)
                    if(rate.serviceName.toUpperCase()=='UPS 2ND DAY AIR®') { ups2dayShipping = rate.shipmentCost + rate.otherCost }
                    if(rate.serviceName.toUpperCase()=='UPS NEXT DAY AIR SAVER®') { upsNextDay = rate.shipmentCost + rate.otherCost }
                })

                if(!itemInfo.shippingError) {
                    recommendedPricing.forEach((marketplace, index) => {
                        let commission = 0;
                        let shipping = 0;
                        let overhead = 1;
                        let fee = 0;
                        let addl = 0;
                        
                        if(marketplace.marketplace=='Amazon FBM' || marketplace.marketplace=='Amazon Prime') {
                            commission = .15;
                        } else if(marketplace.marketplace=='Ebay') {
                            commission = .10;
                        } else if(marketplace.marketplace=='Walmart') {
                            commission = .15;
                        } else if(marketplace.marketplace=='Vendor Central') {
                            commission = .1;
                        } else if(marketplace.marketplace=='Amazon FBA') {
                            commission = .15;

                            const dims = [itemInfo.blength, itemInfo.bwidth, itemInfo.bheight].sort((a,b) => a-b);
                            const length = dims[2];
                            const width = dims[1];
                            const height = dims[0];
                            const unitweight = itemInfo.unitweight
                            const cubicFeet = (length * width * height) / 1728;
                            const now = new Date();
                            const month = now.getMonth();

                            if(unitweight <= .75 && height <= .75 && width <= 12 && length <= 15) {
                                fee = 2.41;
                                fee += month > 8 ? cubicFeet * 2.40 : cubicFeet * .69;
                            } else if(unitweight <= 1 && height <= 8 && width <= 14 && length <= 18) {
                                fee = 3.19;
                                fee += month > 8 ? cubicFeet * 2.40 : cubicFeet * .69;
                            } else if(unitweight <= 2 && height <= 8 && width <= 14 && length <= 18) {
                                fee = 4.71;
                                fee += month > 8 ? cubicFeet * 2.40 : cubicFeet * .69;
                            } else if(unitweight <= 20 && height <= 8 && width <= 14 && length <= 18) {
                                fee = 4.71 + ((unitweight - 2) * .38);
                                fee += month > 8 ? cubicFeet * 2.40 : cubicFeet * .69;
                            } else if(unitweight <= 70 && (height*width+length) <= 108 && width <= 30 && length <= 60) {
                                fee = 8.13 + ((unitweight - 2) * .38);
                                fee += month > 8 ? cubicFeet * 1.20 : cubicFeet * .48;
                            } else if(unitweight <= 150 && (height*width+length) <= 130 && length <= 108) {
                                fee = 9.44 + ((unitweight - 2) * .38);
                                fee += month > 8 ? cubicFeet * 1.20 : cubicFeet * .48;
                            } else if(unitweight <= 150 && (height*width+length) <= 165 && length <= 108) {
                                fee = 73.18 + ((unitweight - 90) * .79);
                                fee += month > 8 ? cubicFeet * 1.20 : cubicFeet * .48;
                            } else {
                                fee = 137.32 + ((unitweight - 90) * .91);
                                fee += month > 8 ? cubicFeet * 1.20 : cubicFeet * .48;
                            }
                        }
    
                        if(marketplace.marketplace=='Amazon Prime') {
                            shipping = ups2dayShipping;
                            overhead = 2;
                        } else if(marketplace.marketplace=='Amazon FBA') {
                            shipping = 0; 
                            addl = .45 * Math.max( itemInfo.blength*itemInfo.bwidth*itemInfo.bheight / 166, itemInfo.unitweight);
                            overhead = .50;
                        } else if(marketplace.marketplace=='Vendor Central') {
                            shipping = 0;
                        } else {
                            shipping = lowestShipping;
                        }
    
                        const minimumProfit = ['Amazon FBA'].includes(marketplace.marketplace) ? .5 : 1;
                        const minimumCommission = ['Amazon FBM', 'Amazon Prime'].includes(marketplace.marketplace) ? 1 : 0;
    
                        const minimumDollar = Math.max(((overhead+minimumProfit+shipping+unitCost+fee+addl)/(1-commission)), (overhead+minimumProfit+minimumCommission+shipping+unitCost+fee+addl));
                        const fivePercent = Math.max(((overhead+shipping+unitCost+fee+addl)/(1-.05-commission)), (overhead+minimumCommission+shipping+unitCost+fee+addl)/(1-.05));
                        
                        recommendedPricing[index].pricing = Math.max(fivePercent, minimumDollar);
                        recommendedPricing[index].commission = Math.max(minimumCommission, recommendedPricing[index].pricing*commission) + fee;
                        recommendedPricing[index].shipping = shipping+addl;
                        recommendedPricing[index].profit = recommendedPricing[index].pricing-recommendedPricing[index].commission-recommendedPricing[index].shipping-unitCost-overhead;
                        
                    }) 
                }

                res.render(
                    'item',
                    {
                        sku,
                        itemInfo,
                        itemBins,
                        itemPrices,
                        itemTrans,
                        itemBreakout,
                        itemAudits,
                        itemSales,
                        recommendedPricing,
                        unitCost,
                        openPOs
                    }
                )
            }
        }).catch(err => {
            res.render(err);
        })
    }

    function searchItems(sku, desc, supplier) {
        return new Promise((resolve, reject) => {
            console.log(`Retrieving item search for: ${sku}, ${desc}, ${supplier}`);
            const request = new sql.Request();
            const sqlQuery = `SELECT stock.number, desc1, desc2, units, uncost, price1
            FROM stock
            ${supplier ? `INNER JOIN buyprice ON stock.number = buyprice.number` : ''}
            WHERE 1=1
            ${sku ? `AND stock.number like '%${sku}%'` : ''}
            ${desc ? `AND (desc1 like '%${desc}%' OR desc2 like '%${desc}%')` : ''}
            ${supplier ? `AND supplier = '${supplier}' GROUP BY stock.number, desc1, desc2, units, uncost, price1` : ''}`;

            request.query(sqlQuery, (err, recordset) => {
                if(err) {
                    return reject(err);
                }
                resolve(recordset.recordset);
            })
        })
    }

    function getItemSuppliers(sku) {
        return new Promise((resolve, reject) => {
            console.log(`Retrieving item suppliers for : ${sku}`);
            const request = new sql.Request();
            const sqlQuery = `SELECT supplier FROM BUYPRICE
            WHERE number = '${sku}'
            GROUP BY supplier
            ORDER BY supplier`;

            request.query(sqlQuery, (err, recordset) => {
                if(err) {
                    return reject(err);
                }
                resolve(recordset.recordset);
            })
        })
    }

    function displayItemSearch(req, res) {
        const { sku, desc, supplier } = req.query;
        searchItems(sku, desc, supplier).then((items) => {
            res.render(
                'itemResults',
                {
                    params: req.query,
                    items
                }
            )
        })
    }

    return {
        displayItem,
        displayItemSearch
    }
}

module.exports = itemController;