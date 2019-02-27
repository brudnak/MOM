const liModel = require('../models/liModel');

function liController() {
    function displayLineItems(req, res) {
        const itemStatus = eval(req.params.itemStatus);
        const SKUs = eval(req.params.SKUs);

        liModel.getLineItems(itemStatus, SKUs).then((lineItems) => {
            res.render(
                'lineitemsResults',
                {
                    itemStatus,
                    SKUs,
                    lineItems
                }
            )
        }).catch(err => {
            res.render('error', {
                err
            });  
        });
    }

    return {
        displayLineItems
    }
}

module.exports = liController;