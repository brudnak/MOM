const amazon = require('amazon-mws')(process.env.MWS_ACCESS_KEY_ID,process.env.MWS_SECRET_ACCESS_KEY);

const sellerID = process.env.MWS_MERCHANT_ID;
const marketplaceID = process.env.MARKETPLACE_ID;

const asinPattern = /^B........./;

function mws() {
    function getLowestPriceByASIN(asin) {
        return new Promise((resolve, reject) => { 
            asin = typeof(asin)=='string' ? asin.trim() : null;
            if(asinPattern.test(asin)) {
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
                    reject(err);
                });
            } else {
                reject('Not an ASIN');
            }
        }).catch(err => {
            console.log(err);
            return err;
        })
    }

    function getMyPriceByASIN(asin) {
        return new Promise((resolve, reject) => {
            asin = typeof(asin)=='string' ? asin.trim() : null;
            if(asinPattern.test(asin)) {
                console.log('sending ' + asin)
                amazon.products.searchFor({
                    'Version': '2011-10-01',
                    'Action': 'GetMyPriceForASIN',
                    'SellerId': sellerID,
                    'MarketplaceId': marketplaceID,
                    'ASINList.ASIN.1': asin,
                }, (err, response) => {
                    if(err) {
                        console.log(err);
                        return resolve(null);
                    }
                    return resolve(response);
                });
            } else {
                resolve(null);
            }
        });
    }

    return {
        getLowestPriceByASIN,
        getMyPriceByASIN
    }
}


module.exports = mws;