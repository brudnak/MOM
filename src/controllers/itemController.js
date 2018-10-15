const itemModel = require('../models/itemModel');

function itemController() {
    function displayItem(req, res) {
        let { sku } = req.params;
        sku = sku.toUpperCase();

        Promise.all([itemModel.getItem(sku), itemModel.getItemBins(sku), itemModel.getItemPrices(sku), itemModel.getItemTransactions(sku), itemModel.getBreakout(sku), itemModel.getItemAudits(sku), itemModel.getOpenPOs(sku), itemModel.getItemSales(sku, 30), itemModel.getItemSales(sku, 60), itemModel.getItemSales(sku, 90), itemModel.getItemSales(sku, 160), itemModel.getItemSales(sku, 270), itemModel.getItemSales(sku, 360)])
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
                var lowestShipping, ups2dayShipping;
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