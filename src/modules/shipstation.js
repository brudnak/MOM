const btoa = require("btoa");
const request = require('request');

const ssKey = process.env.SS_KEY;
const ssSecret = process.env.SS_SECRET;
const encoded = btoa(`${ssKey}:${ssSecret}`);

function shipStation() {
    function getShippingCost(orderID) {
        return new Promise((resolve, reject) => {
            request({
                method: 'GET',
                url: `https://ssapi.shipstation.com/shipments?orderNumber=${orderID}`,
                headers: {
                    "Content-Type": "application/json",
                    'Authorization': `Basic ${encoded}`
                },
            }, (err, response, body) => {
                if(err || body=='Too Many Request') {
                    return reject(err);
                }
    
                body = JSON.parse(body);
                if(body.total==0) {
                    resolve([]);
                };
    
                let shipments = body.shipments.filter(shipment => !shipment.voided);
    
                resolve(shipments);
            })
        })
    }

    function getShippingCosts(startDate, endDate, page = 1) {
        return new Promise((resolve, reject) => {
            const sDate = `20${startDate.substring(0,2)}-${startDate.substring(2,4)}-${startDate.substring(4,6)} 00:00:00`;
            const eDate = `20${endDate.substring(0,2)}-${endDate.substring(2,4)}-${endDate.substring(4,6)} 00:00:00`;
            request({
                method: 'GET',
                url: `https://ssapi.shipstation.com/shipments?createDateStart=${sDate}&createDateEnd=${eDate}&pageSize=500&page=${page}`,
                headers: {
                    "Content-Type": "application/json",
                    'Authorization': `Basic ${encoded}`
                },
            }, (err, response, body) => {
                if(err) {
                    return reject(err);
                }

                (async () => {
                    body = JSON.parse(body);

                    console.log(`On page ${body.page} out of ${body.pages}`)

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

                    console.log('sending page '+body.page);

                    resolve(orderShippingCosts);
                })();   
            })
        })
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

    return {
        getShippingCost,
        getShippingCosts,
        getShippingRates
    }

}

module.exports = shipStation();