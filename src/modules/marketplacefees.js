const debug = require('debug')('MOM:module:marketplacefees');

function marketplaceFees() {

    function estimateFees(item, shippingRates, marketplace) {
        // if item.break_out, need to use break out cost 
        let itemCost = item.break_out==1 && item.breakoutCost ? item.breakoutCost : item.uncost;

        let lowestShipping = 9999;
        let lowest2dayShipping = 9999;

        if(shippingRates.lowestShipping) {
            ({ lowestShipping, lowest2dayShipping } = shippingRates);
        } else {
            shippingRates.forEach(rate => {
                if(Number(rate.amount) < lowestShipping) { lowestShipping = Number(rate.amount) }
                if(rate.servicelevel_token=='ups_second_day_air' || rate.servicelevel_token=='fedex_2day') { 
                    lowest2dayShipping = min(lowest2dayShipping, Number(rate.amount));
                }
            })
        }  

        let commission = 0;
        let shipping = 0;
        let overhead = 1;
        let fee = 0;
        let addl = 0;
        
        if(marketplace=='Amazon FBM' || marketplace=='Amazon Prime') {
            commission = .15;
        } else if(marketplace=='Ebay') {
            commission = .10;
        } else if(marketplace=='Walmart') {
            commission = .15;
        } else if(marketplace=='Vendor Central') {
            commission = .1;
        } else if(marketplace=='Amazon FBA') {
            commission = .15;

            const dims = [item.blength, item.bwidth, item.bheight].sort((a,b) => a-b);
            const length = dims[2];
            const width = dims[1];
            const height = dims[0];
            const unitweight = item.unitweight
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

        if(marketplace=='Amazon Prime') {
            shipping = lowest2dayShipping;
            overhead = 2;
        } else if(marketplace=='Amazon FBA') {
            shipping = 0; 
            addl = .45 * Math.max( item.blength*item.bwidth*item.bheight / 166, item.unitweight);
            overhead = .50;
        } else if(marketplace=='Vendor Central') {
            shipping = 0;
        } else {
            shipping = lowestShipping;
        }

        const minimumProfit = ['Amazon FBA'].includes(marketplace) ? 1 : 2;
        const minimumCommission = ['Amazon FBM', 'Amazon Prime'].includes(marketplace) ? 1 : 0;
        const minimumPercent = 0.07;

        const minimumDollar = Math.max(((overhead+minimumProfit+shipping+itemCost+fee+addl)/(1-commission)), (overhead+minimumProfit+minimumCommission+shipping+itemCost+fee+addl));
        const minimumMargin = Math.max(((overhead+shipping+itemCost+fee+addl)/(1-minimumPercent-commission)), (overhead+minimumCommission+shipping+itemCost+fee+addl)/(1-minimumPercent));
         
        recommendedPricing = [];

        recommendedPricing.marketplace = marketplace;
        recommendedPricing.pricing = Math.max(minimumMargin, minimumDollar);
        recommendedPricing.commission = Math.max(minimumCommission, recommendedPricing.pricing*commission) + fee;
        recommendedPricing.shipping = shipping+addl;
        recommendedPricing.profit = recommendedPricing.pricing-recommendedPricing.commission-recommendedPricing.shipping-itemCost-overhead;

        return recommendedPricing;
    }

    return {
        estimateFees
    }
}


module.exports = marketplaceFees();