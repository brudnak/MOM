const sql = require('mssql');
require('msnodesqlv8');

function batchController() {
    function getStage1() {

    }

    function displayStage1(req, res) {

    }

    function getStage89() {
        return new Promise((resolve, reject) => {
            console.log('Getting Stage 8-9');
            const request = new sql.Request();
            const sqlQuery = `SELECT items.orderno, item, quantb, it_uncost*quantb as 'totalEstCost', ship_from, cms.sales_id FROM items
                INNER JOIN cms on cms.orderno = items.orderno
                WHERE items.dropship = 1 AND items.ordered = 0 AND items.item_state = 'ND' AND cms.sys_hold = 0 AND cms.perm_hold = 0 AND ccheck <> 'D'
                ORDER BY items.orderno`

            request.query(sqlQuery, (err, recordset) => {
                if(err) {
                    return reject(err);
                }
                resolve(recordset.recordset);
            });
        })
        
    }

    function displayStage89(req, res) {
        getStage89().then(orders => {
            res.render(
                'batchCreatePO', 
                {
                    orders
                }
            );
        });
    }

    return {
        displayStage1,
        displayStage89
    }
};

module.exports = batchController;