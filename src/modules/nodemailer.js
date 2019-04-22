const debug = require('debug')('MOM:module:nodemailer');
const nodemailer = require('nodemailer');
const EventEmitter = require('events').EventEmitter;
const emitter = new EventEmitter();

const { webemail, webpassword, server } = require('./config');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: webemail,
        pass: webpassword
    }
});

function arrayToTable(content) {
    let html = '';

    html += '<table style="width: 100%; text-align: left;">';
    html += '<thead>';
    html += '<tr>';

    // fill header
    for(k in content[0]) {
        html += '<th style="padding: 5px">' + (k || '--') + '</th>';
    }

    html += '</thead>';
    html += '</tr>';
    html += '<tbody>';

    //fill content
    content.forEach(item => {
        html += '<tr>';
        for(k in item) {
            html += !isNaN(item[k]) && item[k] < 0 ? '<td style="padding: 5px; color: #ff0000; border-top: 1px solid #eee;">' : '<td style="padding: 5px; border-top: 1px solid #eee;">';
            html += (k == 'order' || k == 'orderno') ? `<a href="${server}:${port}/orders/${item[k]}" target="_blank">${item[k]}</a>` :  
                (k == 'purchase' || k == 'ponumber') ? `<a href="${server}:${port}/pos/${item[k]}" target="_blank">${item[k]}</a>` : 
                (k == 'item' || k == 'number' || k == 'sku') ? `<a href="${server}:${port}/items/${item[k]}" target="_blank">${item[k]}</a>` : item[k] || '--';
            html += '</td>';
        }
        html += '</tr>';
    })

    html += '</tbody>';
    html += '</table>';

    return html;
}

function objectToTable(content) {
    let html = '';

    html += '<table style="text-align: left;">';
    html += '<tbody>';

    Object.keys(content).forEach(key => {
        html += `<tr> <td><b>${key}</b></td> <td>${content[key]}</td> </tr>`;
    })

    html += '</tbody>';
    html += '</table>';

    return html;
}

function sendMail(content, recipients, title = 'Automated Report', query = {}) {
    return new Promise((resolve, reject) => {
        let html = '';

        //fill query information
        for(k in query) {
            if(k=='startDate' || k =='endDate' || k =='date') {
                query[k] = query[k].substring(2,4) + '/' + query[k].substring(4,6) + '/' + query[k].substring(0,2);
            }

            html += `<b>${k}</b>: `;
            html += query[k];
            html += '<br>'
        }

        if(Array.isArray(content)) {
            html += '<hr>';
            html += arrayToTable(content);
        } else {
            Object.keys(content).forEach(table => {
                html += '<hr>';
                html += `<h2 style="text-transform: uppercase; margin-bottom: 0px;">${table}</h2>`;
                debug(content[table]);
                if(Array.isArray(content[table])) {
                    html += arrayToTable(content[table]);
                } else {
                    html += objectToTable(content[table]);
                }
            })
        }

        const mailOptions = {
            from: process.env.WEB_EMAIL,
            to: recipients,
            subject: title,
            html: html
        };

        transporter.sendMail(mailOptions).then(response => {
            debug('Email sent successfully');
            emitter.emit("emailSuccess");
            return resolve(response);
        }).catch(err => {
            debug(err);
            return reject(err);
        });
    })  
}

module.exports = sendMail;