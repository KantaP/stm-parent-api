import passport from 'passport';
let LocalStrategy = require('passport-local').Strategy;
import { sequelizeInitial } from './data/connector';
const crypto = require('crypto');

passport.use('local.two', new LocalStrategy(
    async(username, password, done) => {
        if (username == "admin@voovagroup.com" && password == "123456") {
            var result = Object.assign({}, {email: 'admin@voovagroup.com' , id: 999 }, { databases : ['trial'], companiesLogo: '' })
            return done(null, result)
        } else {
            return done(null, null, { message: 'Invalid username or password.' })
        }
    }
));
passport.serializeUser(function(user, done) {
    done(null, user.id);
});