const dotenv = require('dotenv');
dotenv.config();
module.exports = {
    webemail: process.env['EMAIL_USER'],
    webpassword: process.env['EMAIL_PASSWORD'],
    server: process.env['SERVER'],
    port: process.env['PORT'],
    shippoKey: process.env['SHIPPO_KEY'],
    mwsID: process.env['MWS_ACCESS_KEY_ID'], 
    mwsSecret: process.env['MWS_SECRET_ACCESS_KEY'], 
    sellerID: process.env['MWS_MERCHANT_ID'], 
    marketplaceID: process.env['MWS_MARKETPLACE_ID'],
    ssKey: process.env['SHIPSTATION_KEY'],
    ssSecret: process.env['SHIPSTATION_SECRET']
};