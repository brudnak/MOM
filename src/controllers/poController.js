const poModel = require('../models/poModel');

function poController() {
    function displayPO(req, res) {
        const { ponumber } = req.params;
        Promise.all([poModel.getPO(ponumber), poModel.getPOitems(ponumber), poModel.getPOaps(ponumber)]).then(([po, poItems, poAps]) => {
            if(!po) {
                res.render(
                    '404',
                    {
                        type: 'po',
                        number: ponumber
                    }
                )
            } else {
                po.totalExt = 0;
                poItems.forEach(item => {
                    po.totalExt += item.it_unlist * item.quantity;
                })
                res.render(
                    'po',
                    {
                        po,
                        poItems,
                        poAps
                    }
                )
            };
        }).catch(err => {
            res.render('error', {
                err
            });  
        });
    }

    function displayPOsSearch(req, res) {
        const { supplier, pototal, sku } = req.query;
        poModel.searchPOs(supplier, pototal, sku).then((POs) => {
            res.render(
                'poResults',
                {
                    POs,
                    params: req.query
                }
            )
        }).catch(err => {
            res.render('error', {
                err
            });  
        });
    }

    return {
        displayPO,
        displayPOsSearch
    };
}

module.exports = poController;