const custModel = require('../models/custModel');

function custController() {
    function displayCust(req, res) {
        const { custnum } = req.params;

        Promise.all([custModel.getCustInfo(custnum), custModel.getCustOrders(custnum)]).then(([custInfo, custOrders]) => {
            res.render(
                'cust',
                {
                    custnum,
                    custInfo,
                    custOrders
                }
            )
        }).catch(err => {
            res.render('error', {
                err
            });  
        });
    }

    function displayCustSearch(req, res) {
        const { firstname, lastname, company, zipcode, phone, email } = req.query;

        custModel.getCustSearch(firstname, lastname, company, zipcode, phone, email).then(customers => {
            res.render(
                'custResults',
                {
                    params: req.query,
                    customers
                }
            )
        }).catch(err => {
            res.render('error', {
                err
            });  
        });
    }

    return {
        displayCust,
        displayCustSearch,
    }
}

module.exports = custController;