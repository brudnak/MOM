const apModel = require('../models/apModel');

function apController() {
    function displayApsSearch(req, res) {
        apModel.searchAps(req.query).then((APs) => {
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