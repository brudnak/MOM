const debug = require('debug')('MOM:module:amazonmws');
const throttle = require('promise-ratelimit')(100);
const getLowestPriceByASINThrottle = require('promise-ratelimit')(2000);
const amazon = require('amazon-mws')(process.env.MWS_ACCESS_KEY_ID,process.env.MWS_SECRET_ACCESS_KEY);

const sellerID = process.env.MWS_MERCHANT_ID;
const marketplaceID = process.env.MARKETPLACE_ID;

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
                    });
                });
            } else {
                reject('Not an ASIN');
            }
        }).catch(err => {
            return err;
        });
    }

    return {
        getLowestPriceByASIN,
        getMyPriceByASIN,
        getEstAmazonFees
    }
}


module.exports = mws;