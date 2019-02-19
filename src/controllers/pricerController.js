const debug = require('debug')('MOM:controller:pricer');
const itemModel = require('../models/itemModel');
const mws = require('../modules/amazonmws')();
const amazonFees = require('../modules/marketplacefees');
const shippo = require('../modules/shippo');

function pricerController() {
    function displayAmazonPricer(req, res) {
        const { sku, supplier, fba, page } = req.query;
        const step = 50;
        
        itemModel.searchItems(sku, '', supplier, page, step).then(items => {
            //filter out items that don't have advanced1, bheight, bwidth, blength, and unitweight
            items = items.filter(item => item.bheight && item.bwidth && item.blength && item.unitweight);
            noDimensions = items.filter(item => !item.bheight || !item.bwidth || !item.blength || !item.unitweight);

            Promise.all(items.map(item=>getCompetitivePrice(item,fba))).then(results => {
                const allItems = [...results, ...noDimensions];
                const resultsNum = results[0].TotalRows;
                console.log('Done getting all items!');
                res.render(
                    'pricerAmazon',
                    {
                        allItems,
                        resultsNum,
                        resultsStep: step,
                        query: req.query
                    }
                )
            }).catch(err => {
                res.send(err);   
            });          
        });
    }

    function getCompetitivePrice(item, fba) {
        return new Promise((resolve, reject) => {
            const dimensions = {
                length: item.blength, 
                width: item.bwidth, 
                height: item.bheight, 
                weight: item.unitweight
            }

            Promise.all([mws.getLowestPriceByASIN(item.advanced1), shippo.getRates(dimensions)]).then(([lowestPrices, rates]) => {
                (async () => {
                    try {
                        if(lowestPrices.Summary && lowestPrices.Summary.BuyBoxPrices && Array.isArray(lowestPrices.Summary.BuyBoxPrices.BuyBoxPrice)) {
                            lowestPrices.Summary.BuyBoxPrices.BuyBoxPrice = lowestPrices.Summary.BuyBoxPrices.BuyBoxPrice.filter((item) => item.condition = 'New');
                        }
                        const buyBoxPrice = lowestPrices.Summary && lowestPrices.Summary.BuyBoxPrices ? lowestPrices.Summary.BuyBoxPrices.BuyBoxPrice.LandedPrice ? lowestPrices.Summary.BuyBoxPrices.BuyBoxPrice.LandedPrice.Amount : lowestPrices.Summary.BuyBoxPrices.BuyBoxPrice[0] ? lowestPrices.Summary.BuyBoxPrices.BuyBoxPrice[0].LandedPrice.Amount : '--' : '--';
                        const marketplace = fba==='true' ? 'Amazon FBA' : 'Amazon FBM';
                        let ourAmazonPrices = [];

                        const priceResponse = await mws.getMyPriceByASIN(item.advanced1);

                        if (priceResponse && priceResponse.Product && priceResponse.Product.Offers && priceResponse.Product.Offers.Offer) {
                            if(Array.isArray(priceResponse.Product.Offers.Offer)) {
                                priceResponse.Product.Offers.Offer.forEach(offer => {                                
                                    if((marketplace === 'Amazon FBA' && offer.FulfillmentChannel==='AMAZON') || (marketplace === 'Amazon FBM' && offer.FulfillmentChannel==='MERCHANT')) {
                                        ourAmazonPrices.push(offer);
                                    }
                                });
                            } else {
                                if((marketplace === 'Amazon FBA' && priceResponse.Product.Offers.Offer.FulfillmentChannel==='AMAZON') || (marketplace === 'Amazon FBM' && priceResponse.Product.Offers.Offer.FulfillmentChannel==='MERCHANT')) {
                                    ourAmazonPrices.push(priceResponse.Product.Offers.Offer);
                                }
                            }
                        } 

                        const recommendedPricing = await amazonFees.estimateFees(item, rates.rates, marketplace);

                        const results = {
                            ...item,
                            buyBoxPrice,
                            recommendedPricing,
                            ourAmazonPrices
                        }
        
                        resolve(results);
                    } catch(err) {
                        console.log(err);
                    }
                })();
            }).catch(err => {
                console.log(err);
                reject(err);
            }); 
        }).catch(err => {
            console.log(err);
            return(err);
        });
    }

    return {
        displayAmazonPricer
    }
}

module.exports = pricerController;