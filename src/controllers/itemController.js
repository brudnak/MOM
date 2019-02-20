const itemModel = require('../models/itemModel');
const marketplaceFees = require('../modules/marketplacefees');

function itemController() {
    function displayItem(req, res) {
        let { sku } = req.params;
        sku = sku.toUpperCase();

        Promise.all([itemModel.getItem(sku), itemModel.getItemBins(sku), itemModel.getItemPrices(sku), itemModel.getItemTransactions(sku), itemModel.getBreakout(sku), itemModel.getParents(sku), itemModel.getItemAudits(sku), itemModel.getOpenPOs(sku), itemModel.getItemSales(sku, 30), itemModel.getItemSales(sku, 60), itemModel.getItemSales(sku, 90), itemModel.getItemSales(sku, 160), itemModel.getItemSales(sku, 270), itemModel.getItemSales(sku, 360)])
        .then(([itemInfo, itemBins, itemPrices, itemTrans, itemBreakout, itemParents, itemAudits, openPOs, sales30, sales60, sales90, sales180, sales270, sales360]) => {
            if (!itemInfo) {
                res.render(
                    '404',
                    {
                        type: 'item',
                        number: sku
                    }
                )
            } else {
                let lowestShipping, ups2dayShipping;
                lowestShipping = 999;
                const recommendedPricing = [{name: 'Amazon FBM'}, {name: 'Amazon Prime'}, {name: 'Amazon FBA'}, {name: 'Vendor Central'}, {name: 'Walmart'}, {name: 'Ebay'}];
                    
                itemInfo.breakoutCost = 0;

                if(itemInfo.break_out==1) {
                    itemBreakout.forEach(piece => {
                        itemInfo.breakoutCost += piece.uncost * piece.q;
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
                })

                if(!itemInfo.shippingError) {                   
                    recommendedPricing.forEach((marketplace, index) => {
                        recommendedPricing[index] = marketplaceFees.estimateFees(itemInfo, {lowestShipping: lowestShipping, ups2dayShipping: ups2dayShipping}, marketplace.name);
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
                        itemParents,
                        itemAudits,
                        itemSales,
                        recommendedPricing,
                        openPOs
                    }
                )
            }
        }).catch(err => {
            res.render(err);
        })
    }

    function displayItemSearch(req, res) {
        const { sku, desc, supplier } = req.query;
        itemModel.searchItems(sku, desc, supplier).then((items) => {
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