const debug = require('debug')('MOM:module:shipstation');
const btoa = require("btoa");
const limit = require('simple-rate-limiter');
const request = limit(require('request')).to(40).per(60000);

const ssKey = process.env.SS_KEY;
const ssSecret = process.env.SS_SECRET;
const encoded = btoa(`${ssKey}:${ssSecret}`);

function shipStation() {
    function exportOrders(orders) {
        return new Promise((resolve, reject) => {
            debug(`Exporting orders to ShipStation`);
            request({
                method: 'POST',
                url: `https://ssapi.shipstation.com/orders/createorders`,
                headers: {
                    "Content-Type": "application/json",
                    'Authorization': `Basic ${encoded}`
                },
                body: JSON.stringify(orders)
            }, (err, response, body) => {
                try {
                    if(err) {
                        return reject(err);
                    }
    
                    body = JSON.parse(body);
                    resolve(body.results);
                } catch(e) {
                    reject(e);
                }
            });
        }).catch(err => {
          debug(err);  
          return err;
        });
    }

    function getShippingCost(orderID) {
        return new Promise((resolve, reject) => {
            debug(`Retrieving shipping cost for order ${orderID}`);
            request({
                method: 'GET',
                url: `https://ssapi.shipstation.com/shipments?orderNumber=${orderID}`,
                headers: {
                    "Content-Type": "application/json",
                    'Authorization': `Basic ${encoded}`
                },
            }, (err, response, body) => {
                try {
                    debug('SS response'); 
                    if(err || body=='Too Many Request' || !body) {
                        return reject(err);
                    }
        
                    body = JSON.parse(body);
                    if(body.total==0) {
                        return resolve([]);  
                    };
    
        
                    let shipments = body.shipments.filter(shipment => !shipment.voided);
        
                    resolve(shipments);
                } catch(e) {
                    reject(e);
                }
            }).on('error', err => {
                debug('error');
                return reject(err);
            });
        }).catch(err => {
            debug(err);  
            return err;
        });
    }

    function getShippingCosts(startDate, endDate, page = 1) {
        return new Promise((resolve, reject) => {
            let sDate = new Date(startDate.replace(/(\d{2})(\d{2})(\d{2})/,"20$1-$2-$3"));
            let eDate = new Date(endDate.replace(/(\d{2})(\d{2})(\d{2})/,"20$1-$2-$3"));
            eDate.setDate(eDate.getDate() + 1);

            const sDateStr = `${sDate.getFullYear()}-${(sDate.getMonth()+1).toString().padStart(2, '0')}-${(sDate.getDate()).toString().padStart(2, '0')} 00:00:00`;
            const eDateStr = `${eDate.getFullYear()}-${(eDate.getMonth()+1).toString().padStart(2, '0')}-${(eDate.getDate()).toString().padStart(2, '0')} 00:00:00`;
            request({
                method: 'GET',
                url: `https://ssapi.shipstation.com/shipments?createDateStart=${sDateStr}&createDateEnd=${eDateStr}&pageSize=500&page=${page}`,
                headers: {
                    "Content-Type": "application/json",
                    'Authorization': `Basic ${encoded}`
                },
            }, (err, response, body) => {
                if(err) {
                    return reject(err);
                }

                (async () => {
                    try {
                        body = JSON.parse(body);

                        debug(`On page ${body.page} out of ${body.pages}`)

                        let orderShippingCosts = {}
                        
                        body.shipments.forEach(shipment => {
                            if(!shipment.voided) {
                                if(orderShippingCosts[shipment.orderNumber]) {
                                    orderShippingCosts[shipment.orderNumber] += shipment.shipmentCost + shipment.insuranceCost;
                                } else {
                                    orderShippingCosts[shipment.orderNumber] = shipment.shipmentCost + shipment.insuranceCost;
                                }
                            }
                        });

                        if(body.page < body.pages) {
                            await getShippingCosts(startDate, endDate, body.page + 1).then(shippingCosts => {
                                // merge tables
                                for(order in shippingCosts) {
                                    if(orderShippingCosts[order]) {
                                        orderShippingCosts[order] += shippingCosts[order];
                                    } else {
                                        orderShippingCosts[order] = shippingCosts[order];
                                    }
                                }
                            })
                        }

                        debug('sending page '+body.page);

                        resolve(orderShippingCosts);
                    } catch(e) {
                        reject(e);
                    }
                })();   
            }).on('error', err => {
                return reject(err);
            });
        }).catch(err => {
            debug(err);  
            return err;
        });
    }

    function getShippingRates(dimensions, carrier) {
        return new Promise((resolve, reject) => {
            const { weight, height, width, length } = dimensions;
            request({
                    method: 'POST',
                    url: 'https://ssapi.shipstation.com/shipments/getrates',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Basic ${encoded}`
                    },
                    body: `{  
                        "carrierCode": '${carrier}',  
                        "serviceCode": null,  
                        "packageCode": null,  
                        "fromPostalCode": "85282",  
                        "toState": "ME",  
                        "toCountry": "US",  
                        "toPostalCode": "03904",  
                        "toCity": "Kittery",  
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
                        "residential": true
                    }"`
                }, function (err, response, body) {
                    try {
                        if(err || body=='Too Many Request') {
                            return reject(err);
                        }
        
                        body = JSON.parse(body);

                        if(Array.isArray(body)) {
                            resolve(body);
                        } else { // cannot ship that carrier
                            resolve([]);
                        }
                    } catch(e) {
                        reject(e);
                    }  
            }).on('error', err => {
                return reject(err);
            });
        }).catch(err => {
            debug(err);  
            return err;
        });
    }
 
    return {
        getShippingCost,
        getShippingCosts,
        getShippingRates,
        exportOrders
    }

}

module.exports = shipStation();