const amazon = require('amazon-mws')(process.env.MWS_ACCESS_KEY_ID,process.env.MWS_SECRET_ACCESS_KEY);

const sellerID = process.env.MWS_MERCHANT_ID;
const marketplaceID = process.env.MARKETPLACE_ID;

function mws() {
    function getLowestPriceByASIN(asin) {
        return new Promise((resolve, reject) => { 
            if(asin.trim()) {
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
                    resolve(null);
                });
            } else {
                resolve(null);
            }
        })
    }

    return {
        getLowestPriceByASIN
    }
}


module.exports = mws;