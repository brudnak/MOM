const apModel = require('../models/apModel');

function apController() {
    function displayApsSearch(req, res) {
        const { invoicenumber, ponumber, supplier, payment } = req.query;
        apModel.searchAps(invoicenumber, ponumber, supplier, payment).then((APs) => {
            res.render(
                'apResults',
                {
                    APs,
                    params: req.query
                }
            )
        })
    }

    return {
        displayApsSearch
    }
}

module.exports = apController;