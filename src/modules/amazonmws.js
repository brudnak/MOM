const debug = require('debug')('MOM:module:amazonmws');
const throttle = require('promise-ratelimit')(100);
const getLowestPriceByASINThrottle = require('promise-ratelimit')(2000);

const { mwsID, mwsSecret, sellerID, marketplaceID } = require('./config');

const amazon = require('amazon-mws')(mwsID,mwsSecret);

const asinPattern = /^B........./;

function mws() {
    function getLowestPriceByASIN(asin) {
        return new Promise((resolve, reject) => { 
            asin = typeof(asin)=='string' ? asin.trim() : null;
            if(asinPattern.test(asin)) {
                getLowestPriceByASINThrottle().then(() => {
                    amazon.products.searchFor({
                        'Version': '2011-10-01',
                        'Action': 'GetLowestPricedOffersForASIN',
                        'SellerId': sellerID,
                        'MarketplaceId': marketplaceID,
                        'ASIN': asin,
                        'ItemCondition': 'New'
                    }).then(response => {
                        resolve(response);
                    }).catch(err => {
                        reject('ASIN not found'); 
                    });
                });
            } else {
                reject('Not an ASIN');
            }
        }).catch(err => {
            return err;
        });
    }

    function getMyPriceByASIN(asin) {
        return new Promise((resolve, reject) => {
            asin = typeof(asin)=='string' ? asin.trim() : null;
            if(asinPattern.test(asin)) {
                throttle().then(() => {
                    amazon.products.searchFor({
                        'Version': '2011-10-01',
                        'Action': 'GetMyPriceForASIN',
                        'SellerId': sellerID,
                        'MarketplaceId': marketplaceID,
                        'ASINList.ASIN.1': asin,
                    }, (err, response) => {
                        if(err) {
                            return reject('ASIN not found');
                        }
                        resolve(response);
                    }).catch(err => {
                        return reject('Amazon MWS unresponsive.')  
                    });
                });
            } else {
                reject('Not an ASIN');
            }
        }).catch(err => {
            return err;
        });
    }

    function getEstAmazonFees(item, fba) {
        return new Promise((resolve, reject) => {
            let { asin, cost } = item;

            asin = typeof(asin)=='string' ? asin.trim() : null;
            if(asinPattern.test(asin)) {
                throttle().then(() => {
                    amazon.products.searchFor({
                        'Version': '2011-10-01',
                        'Action': 'GetMyFeesEstimate',
                        'SellerId': sellerID,
                        'FeesEstimateRequestList.FeesEstimateRequest.1.MarketplaceId': marketplaceID,
                        'FeesEstimateRequestList.FeesEstimateRequest.1.IdType': asin,
                        'FeesEstimateRequestList.FeesEstimateRequest.1.IdValue': asin,
                        'FeesEstimateRequestList.FeesEstimateRequest.1.IsAmazonFulfilled': fba,
                        'FeesEstimateRequestList.FeesEstimateRequest.1.Identifier': 'Hello',
                        'FeesEstimateRequestList.FeesEstimateRequest.1.PriceToEstimateFees.ListingPrice.CurrencyCode': 'USD',
                        'FeesEstimateRequestList.FeesEstimateRequest.1.PriceToEstimateFees.ListingPrice.Amount': cost * 2 || 100,
                        'FeesEstimateRequestList.FeesEstimateRequest.1.PriceToEstimateFees.Shipping.CurrencyCode': 'USD',
                        'FeesEstimateRequestList.FeesEstimateRequest.1.PriceToEstimateFees.Shipping.Amount': '0',
                        'FeesEstimateRequestList.FeesEstimateRequest.1.PriceToEstimateFees.Points.PointsNumber': '0'
                    }, (err, response) => {
                        if(err) {
                            return reject('ASIN not found');
                        }
                        resolve(response);
                    }).catch(err => {
                        return reject('Amazon MWS unresponsive.')  
                    });
                });
            } else {
                reject('Not an ASIN');
            }
        }).catch(err => {
            return err;
        });
    }

    function getUnshippedPrimeOrders() {
        return new Promise((resolve, reject) => {
            throttle().then(() => {
                amazon.orders.search({
                    'Version': '2013-09-01',
                    'Action': 'ListOrders',
                    'SellerId': sellerID,
                    'MarketplaceId.Id.1': marketplaceID,
                    'LastUpdatedAfter': new Date(2018,1,1),
                    'OrderStatus.Status.1': 'Unshipped',
                    'OrderStatus.Status.2': 'PartiallyShipped',
                    'FulfillmentChannel.Channel.1': 'MFN',
                }, (err, response) => {
                    if(err) {
                        return reject(err);
                    }

                    primeOrders = response.Orders.Order.filter(order => order.FulfillmentChannel == 'MFN' && order.IsPrime == 'true');

                    Promise.all(primeOrders.map(getOrderItems)).then(results => {
                        //console.log(results);
                    });
                    resolve(primeOrders);
                }).catch(err => {
                    return reject('Amazon MWS unresponsive.')  
                });
            });
        }).catch(err => {
            return err;
        });
    }

    function getOrderItems(order) {
        return new Promise((resolve, reject) => {
            const orderno = typeof(order)=='object' ? order.AmazonOrderId : order;
            throttle().then(() => {
                amazon.orders.search({
                    'Version': '2013-09-01',
                    'Action': 'ListOrderItems',
                    'SellerId': sellerID,
                    'AmazonOrderId': orderno
                }, (err, response) => {
                    if(err) {
                        return reject(err);
                    }

                    if(typeof(order)=='object') {
                        resolve({...order, items: response.OrderItems});
                        return;
                    }
                    resolve(response);
                }).catch(err => {
                    return reject('Amazon MWS unresponsive.')  
                });
            });
        }).catch(err => {
            return err;
        });
    }

    return {
        getLowestPriceByASIN,
        getMyPriceByASIN,
        getEstAmazonFees,
        getUnshippedPrimeOrders
    }
}


module.exports = mws;