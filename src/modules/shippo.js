const debug = require('debug')('MOM:module:shippo');
const throttle = require('promise-ratelimit')(200);
const { shippoKey } = require('./config');

const shippo = require('shippo')(shippoKey);

const addressFrom = {
	"name": "CPR Savers - Test",
    "street1": "2328 W Campus Dr.",
    "city": "Tempe",
    "state": "AZ",
    "zip": "85282",
    "country": "US",
    "phone": "+1 800 480 1277",
    "email": "shandra@cpr-savers.com"
};

function Shippo() {
    function getRates(dimensions, zip = '03904', insurance = 0, residential = true) {
        return new Promise((resolve, reject) => {
            const { weight, height, width, length } = dimensions;
            let response = [];
            response.rates = [];

            //residential
            response.to = {
                "name": "Test",
                "street1": "11 Hartley Farm Ln",
                "city": "Kittery",
                "state": "ME",
                "zip": zip,
                "country": "US",
                "phone": "+1 800 480 1277",
                "email": "shandra@cpr-savers.com",
                "is_residential": true
            };

            // commercial
            // response.to = {
            //     "name": "Test",
            //     "street1": "326 Route 1",
            //     "city": "Kittery",
            //     "state": "ME",
            //     "zip": zip,
            //     "country": "US",
            //     "phone": "+1 800 480 1277",
            //     "email": "shandra@cpr-savers.com",
            //     "is_residential": false
            // };

            // response.to = {
            //     "name": "Test",
            //     "city": "Kittery",
            //     "state": "ME",
            //     "zip": zip,
            //     "country": "US",
            //     "phone": "+1 800 480 1277",
            //     "email": "shandra@cpr-savers.com",
            //     "is_residential": true
            // };
            
            response.from = addressFrom;
            		
            response.parcel = {
                "length": length,
                "width": width,
                "height": height,
                "weight": weight,
            };
            response.insurance = {
                "amount": insurance,
                "currency": "USD",
                "content": "medical devices"
            };

            throttle().then(() => {
                shippo.shipment.create({
                    "address_from": response.from,
                    "address_to": response.to,
                    "parcel": {
                        "length": length,
                        "width": width,
                        "height": height,
                        "distance_unit": "in",
                        "weight": weight,
                        "mass_unit": "lb"
                    },
                    "async": false,
                    "extra": { "insurance": response.insurance }
                }).then(shipment => {		
                    shipment.rates_list.filter(rate => ['ups_ground','usps_priority','usps_first','ups_second_day_air','ups_next_day_air_saver','fedex_home_delivery'].includes(rate.servicelevel_token)).forEach(rate => {
                        debug(['ups_ground','usps_priority','usps_first'].includes(rate.servicelevel_token));
                        //add residential fee because Shippo is stupid
                        //rate.amount = (Number(rate.amount) + (rate.provider=='UPS' ? 3.35 : 0)).toFixed(2);
                        response.rates.push(rate)
                    })

                    //debug(shipment);

                    resolve(response);
                }).catch(err => {
                    debug(err);
                    reject(err);  
                });
            });
        }).catch(err => {
            return err;
        });
    }

    return {
        getRates
    }
}

module.exports = Shippo();