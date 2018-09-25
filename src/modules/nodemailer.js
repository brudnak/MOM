const nodemailer = require('nodemailer');
const EventEmitter = require('events').EventEmitter;
const emitter = new EventEmitter();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.WEB_EMAIL,
        pass: process.env.WEB_PASSWORD
    }
});

function sendMail(content, recipients, title = 'Automated Report', query = {}) {
    return new Promise((resolve, reject) => {
        let html = '';

        //fill query information
        for(k in query) {
            if(k=='startDate' || k =='endDate') {
                query[k] = query[k].substring(2,4) + '/' + query[k].substring(4,6) + '/' + query[k].substring(0,2);
            }

            html += `<b>${k}</b>: `;
            html += query[k];
            html += '<br>'
        }

        html += '<hr>'

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
                html += (k == 'order' || k == 'orderno') ? `<a href="http://cprs-d0051-0218:1111/orders/${item[k]}" target="_blank">${item[k]}</a>` :  
                    (k == 'purchase' || k == 'ponumber') ? `<a href="http://cprs-d0051-0218:1111/pos/${item[k]}" target="_blank">${item[k]}</a>` : 
                    (k == 'item' || k == 'number' || k == 'sku') ? `<a href="http://cprs-d0051-0218:1111/items/${item[k]}" target="_blank">${item[k]}</a>` : item[k] || '--';
                html += '</td>';
            }
            html += '</tr>';
        })

        html += '</tbody>';
        html += '</table>'

        const mailOptions = {
            from: process.env.WEB_EMAIL,
            to: recipients,
            subject: title,
            html: html
        };

        transporter.sendMail(mailOptions).then(response => {
            console.log('Email sent successfully');
            emitter.emit("emailSuccess");
            return resolve(response);
        }).catch(err => {
            console.log(err);
            return reject(err);
        });
    })  
}

module.exports = sendMail;