const debug = require('debug')('MOM:controller:warehouse');
const poModel = require('../models/poModel');
const sendMail = require('../modules/nodemailer');

function warehouseController() {
    function sendWarehouseLog(req, res) {
        let { date, orders, pos, packages, recipients } = req.query;

        packages = JSON.parse(packages);
        orders = JSON.parse(orders);
        pos = pos ? pos.replace(' ','').split(',') : [];
        let poInfo = [];
        let poPromises = [];

        pos.forEach(po => {
            poPromises.push(poModel.getPO(po));          
        })
        
        Promise.all(poPromises).then(poResponse => {
            poInfo = poResponse.map(po => {
                return {'ponumber': po.ponumber, 'Supplier': po.supplier, 'Order Date': po.odr_date.toString().substr(4,11), 'Reference': po.reference, 'Fully Received': po.completed == 1 ? 'Yes' : 'No'};
            });

            if(recipients && recipients !== '') {
                sendMail({ orders: orders, pos: poInfo, packages: packages}, recipients, 'Warehouse Log', { date }).then(response => {
                    global.io.emit('emailSuccess', { recipients });
                }).catch(err => {
                    global.io.emit('emailFailure', { recipients });  
                });
            };

            res.render('warehouseLogConfirm', {
                orders,
                poInfo,
                packages,
                date
            });
        });        
    }

    return {
        sendWarehouseLog
    }
}

module.exports = warehouseController;