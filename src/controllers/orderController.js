const orderModel = require('../models/orderModel');
const mws = require('../modules/amazonmws')();
const debug = require('debug')('MOM:controller:order');

function orderController() {
    function displayOrder(req, res) {
        const { orderno } = req.params;
        Promise.all([orderModel.getOrder(orderno), orderModel.getLineItems(orderno), orderModel.getOrderMemo(orderno), orderModel.getOrderAudits(orderno), orderModel.getOrderAttachments(orderno), orderModel.getOrderPOs(orderno)]).then(([orderInfo, itemsInfo, orderMemos, orderAudits, orderAttachments, POs]) => {
            if(!orderInfo) {
                res.render(
                    '404',
                    {
                      type: 'order',
                      number: orderno
                    }
                )
            } else {
                // Calculate total merchandise cost and list
                let totalCost = 0; let totalList = 0;
                itemsInfo.forEach(item => {
                    if(item.item_state != 'SV') {
                        totalCost += item.it_uncost.toFixed(2)*item.quanto;
                    }  
                    totalList += item.it_unlist.toFixed(2)*item.quanto; 
                })

                // Calculate shipping cost
                let shipCost = 0;
                if(orderInfo.boxes) {
                    orderInfo.boxes.forEach(shipment => {
                        shipCost += shipment.shipmentCost + shipment.insuranceCost;
                    });
                }

                let dropshipShipping = 0;
                POs.forEach(PO => {
                  dropshipShipping += PO.shipping;
                })
                
                // Calculate profitability after shipping costs and fees
                const totalMinusTax = orderInfo.ord_total-orderInfo.tax;
                let commission = 0; 
                if(['AMAZON','WAL','EBAY','EBAYCPR','AMZPRIME','AMZVC'].includes(orderInfo.cl_key.trim())) {
                  if(['EBAY','EBAYCPR'].includes(orderInfo.cl_key.trim())) {
                    commission = Math.min(750, totalMinusTax*.10);
                  } else if(orderInfo.cl_key.trim()=='WAL') {
                    commission = Math.max(1, totalMinusTax*.15);
                  } else if(orderInfo.cl_key.trim()=='AMAZON' || orderInfo.cl_key.trim()=='AMZPRIME') {
                    commission = Math.max(1, totalMinusTax*.15);
                  } else if(orderInfo.cl_key.trim()=='AMZVC') {
                    commission = Math.max(1, totalMinusTax*.1);
                  }
                } else {
                    commission = totalMinusTax*0.028;
                }

                const totalShipping = dropshipShipping + shipCost;
                const commissionPercent = commission > 0 ? ((commission / totalMinusTax) * 100).toFixed(0) : 0;
                const shippingPercent = ((totalShipping / totalMinusTax) * 100).toFixed(0);
                const merchPercent = ((totalCost / totalMinusTax) * 100).toFixed(0);
                const profitPercent = (100-commissionPercent-shippingPercent-merchPercent).toFixed(0);

                res.render(
                    'order',
                    {
                        orderno,
                        orderInfo,
                        itemsInfo,
                        orderMemos,
                        orderAudits,
                        orderAttachments,
                        POs,
                        totalList,
                        totalCost,
                        shipCost,
                        orderProfit: {
                            commissionPercent,
                            shippingPercent,
                            merchPercent,
                            profitPercent,
                            totalShipping,
                            commission
                        }
                    } 
                )   
            };
        }).catch(err => {
            res.render('error', {
                err
            });  
        });
    }

    function displayOrderSearch(req, res) {
        const { startdate, enddate, altorderno, clkey, status, salesperson, ordertotal, sku, includefba } = req.query;
        orderModel.searchOrders(startdate, enddate, altorderno, clkey, status, salesperson, ordertotal, sku, includefba).then((orders) => {
            res.render(
                'orderResults',
                { 
                    params: req.query,
                    orders,
                }
            )
        }).catch(err => {
            res.render('error', {
                err
            });  
        });
    }

    function displayPrime(req, res) {
        mws.getUnshippedPrimeOrders().then(orders => {
            console.log(orders);
            res.render(
                'ordersPrime',
                {
                    orders
                }
            )
        }).catch(err => {
            res.render('error', {
                err
            });  
        });
    }

    return {
        displayOrder,
        displayOrderSearch,
        displayPrime
    };
}


module.exports = orderController;