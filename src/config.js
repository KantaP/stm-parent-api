import moment from 'moment';

const crypto = require('crypto');
const PARENT_APP_KEY = 'parent_voova_' + moment().utc().format('x')
const PARENT_APP_TOKEN = crypto.createHash('md5').update(PARENT_APP_KEY).digest('hex');
const CLASSIC_DRIVER_ENV = {
    "secret": "ecm",
    "ecmKey": "1amZ00K33p3r",
    "secretKey": "Th3L10nK155aD33R"
}
const TIMEZONE = '+07:00'
module.exports = {
    // JWT_SECRET: 'keyboardgodzilla',
    PARENT_APP_TOKEN,
    CLASSIC_DRIVER_ENV,
    TIMEZONE
};
