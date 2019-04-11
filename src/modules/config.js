const dotenv = require('dotenv');
dotenv.config();
module.exports = {
    webemail: process.env['EMAIL_USER'],
    webpassword: process.env['EMAIL_PASSWORD'],
    server: process.env['SERVER']
};