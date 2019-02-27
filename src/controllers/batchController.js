const batchModel = require('../models/batchModel');

function batchController() {
    function displayStage1(req, res) {
        batchModel.getStage1().then(orders => {
            res.render(
                'batchReadyToPick',
                {
                    orders
                }
            )
        })
    }

    function displayStage89(req, res) {
        batchModel.getStage89().then(orders => {
            res.render(
                'batchCreatePO', 
                {
                    orders 
                }
            );
        });
    }

    function displayStageAll(req, res) {
        Promise.all([batchModel.getStage1(),batchModel.getStage2(),batchModel.getStage89()]).then(([stage1orders, stage2orders, stage89orders]) => {
            res.render(
                'batchHome',
                {
                    stage1orders,
                    stage2orders,
                    stage89orders
                }
            )
        }).catch(err => {
            res.render('error', {
                err
            });  
        });
    }

    return {
        displayStage1,
        displayStage89,
        displayStageAll
    }
};

module.exports = batchController;