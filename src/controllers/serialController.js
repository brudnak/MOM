const serialModel = require('../models/serialModel');

function serialController() {
    function displaySerialSearch(req, res) {
        serialModel.searchSerials(req.query).then(serialResults => {
            res.render(
                'serialResults',
                {
                    serialResults,
                    params: req.query
                }
            )
        });
    }

    return {
        displaySerialSearch
    }
}

module.exports = serialController;