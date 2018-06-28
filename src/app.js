// import express from 'express';
import { GraphQLServer } from 'graphql-yoga'
import bodyParser from 'body-parser';
import schema , { typeDefs } from './data/schema';
import cors from 'cors';
import request from 'request';
import passport from 'passport';
import config from './config';
import { sequelizeInitial } from './data/connector';
// import depthLimit from 'graphql-depth-limit'
import resolvers from './data/resolvers';
import moment from 'moment'
// const { makeRemoteExecutableSchema, introspectSchema } = require('graphql-tools')
// const { createHttpLink } = require('apollo-link-http')
// const fetch = require('node-fetch')

// const { maskErrors } = require('graphql-errors');
// const graphqlHTTP = require('express-graphql');
const path = require('path')
const jwt = require('jsonwebtoken');
const session = require('express-session');
const flash = require('connect-flash');
const crypto = require('crypto');
const axios = require('axios');
const querystring = require('querystring');
var cache = require('memory-cache');
var fs = require('fs');
// const privateJWT = crypto.createHash('md5').update(config.PARENT_APP_TOKEN).digest('hex')
require('./auth.js');
require('./auth-admin.js')
const admin = require("firebase-admin");
const serviceAccount = require("./driverapp-1470129684507-firebase-adminsdk-qd3ut-0b2e7204c7.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

async function run() {
    // const makeDatabaseServiceLink = () => createHttpLink({
    //     uri: `https://api.graph.cool/simple/v1/cj5kr2w2g6cvc013457p0g6k8`,
    //     fetch
    //   })
    
    // const databaseServiceSchemaDefinition = await introspectSchema(makeDatabaseServiceLink())
    
    // const databaseServiceExecutableSchema = makeRemoteExecutableSchema({
    //     schema: databaseServiceSchemaDefinition,
    //     link: makeDatabaseServiceLink()
    // })

    const graphQLServer = new GraphQLServer({
        typeDefs: typeDefs,
        resolvers: resolvers,
        // schema: databaseServiceExecutableSchema,
        context: req => ({
            ...req.request
        }),
    })


const BearerStrategy = require('passport-http-bearer').Strategy;
passport.use(new BearerStrategy(
    function(token, cb) {
        try {
            if (token == null) {
                return cb(null, null)
            }
            // console.log(token)
            let user = jwt.verify(token, config.PARENT_APP_TOKEN);
            // console.log(user)
            if (user && user != null) {
                return cb(null, user)
            } else {
                return cb(null, null)
            }
        } catch (err) {
            return cb(err.message)
        }
    }));
const GRAPHQL_PORT = 3001;

// const graphQLServer = express();


graphQLServer.express.set("view engine", "pug");
graphQLServer.express.set("views", path.join(__dirname, "views"));
graphQLServer.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: true }
}))
graphQLServer.use(flash())
graphQLServer.use(passport.initialize());
graphQLServer.use(passport.session());


const corsOptions = {
    origin(origin, callback) {
        callback(null, true);
    },
    credentials: true
};
graphQLServer.use(cors(corsOptions));
var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
}
graphQLServer.use(allowCrossDomain)

// maskErrors(schema);
graphQLServer.use('/graphql', (req ,res , next) => {
    var token = req.headers['authorization'] || req.headers['referer'] || ''
    token = token.replace('Bearer ', '')
    if(token.includes('?key=')) {
        token = token.split('?key=')[1]
    }
    var filepath = path.join(__dirname, "logs/log_" + moment().format('YYYYMMDD') + '.txt');
    var encoding = "utf8";
    var content = `time: ${moment().format('HH:mm')} \n from ip ${req.ip} \n token: ${token} \n body: ${JSON.stringify(req.body)} \n`
    fs.appendFile(filepath , content, encoding, (err) => {
        if (err) throw err;
        // console.log("log saved!");
    });
    // console.log('request body ' , req.body)
    req.user = null
    if(token) {
        try {
            let user = jwt.verify(token, config.PARENT_APP_TOKEN);
            req.user = user
            fs.appendFile(filepath , `user: ${JSON.stringify(user)} \n`, encoding, (err) => {
                if (err) throw err;
                // console.log("log saved!");
            });
            next()
        }catch(err) {
            // req.user = null
            var errorContent = `time: ${moment().format('HH:mm')} \n from ip ${req.ip} \n token: ${token} \n error message: ${err.message} \n`
            fs.appendFile(filepath , errorContent, encoding, (err) => {
                if (err) throw err;
                console.log("error log saved!");
            });
            res.status(401).send({message:err.message})
        }
        
    }else {
        res.status(401).send({message:'Please login before request data'})
    }
});

graphQLServer.use('/playground', (req, res, next)=>{
    var token = req.query.key
    try {
        let user = jwt.verify(token, config.PARENT_APP_TOKEN);
        cache.put('token_ip_' + req.ip , token);
        next()
    }catch(err) {
        console.log(err.message)
        // req.user = null
        // res.redirect('/')
        res.redirect('/parent')
    }
})



// graphQLServer.use('/graphql', passport.authenticate('bearer', { session: false }), graphqlHTTP(request => {
//     const startTime = Date.now();
//     var { user } = request
//     return {
//         schema: schema,
//         validationRules: [depthLimit(10)],
//         graphiql: true,
//         context: { user },
//         extensions({ document, variables, operationName, result }) {
//             return { runTime: Date.now() - startTime };
//         }
//     };
// }));


graphQLServer.use(bodyParser.json()); // support json encoded bodies
graphQLServer.use(bodyParser.urlencoded({ extended: true }));

graphQLServer.get('/' , (req, res) => {
    res.render("homepage");
})

graphQLServer.post('/sendSMS', passport.authenticate('bearer', { session: false }), (req, res) => {
    if (req.user == null) {
        res.status(401).send({ message: 'Unauthorize' })
    } else {
        var body = {
            to: req.body.to.split(','),
            text: req.body.text
        }
        var options = {
            url: 'https://api.clickatell.com/rest/message',
            headers: {
                'Authorization': "bearer 0WfPOyBctycsSud4NFQzSlq1hpEYfrLJb0pyqG.UrQyW24RJUchUx.J_n08vjw1U",
                'X-Version': '1',
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: body,
            json: true
        };
        request.post(options, (error, response, body) => {
            if (!error && response.statusCode == 202) {
                res.send(body.data)
            } else {
                res.send(error)
            }
        })
    }

})

graphQLServer.post('/login', passport.authenticate('local.one', { session: false, failureFlash: true }), (req, res) => {
    var token = jwt.sign({
        id: req.user.id,
        auth: true,
        mutate: ['ALL'],
        query: ['ALL'],
        databases: req.user.databases,
        email: req.user.email
    }, config.PARENT_APP_TOKEN, { expiresIn: "1d" })
    var { id, email, phone, companiesLogo } = req.user
    res.send({
        token: token,
        user: { id, email, phone, companiesLogo }
    })
});

graphQLServer.post('/login-admin' , passport.authenticate('local.one', { session: false, failureFlash: true }) , (req, res)=>{
    var token = jwt.sign({
        id: req.user.id,
        auth: true,
        mutate: ['ALL'],
        query: ['ALL'],
        databases: req.user.databases,
        email: req.user.email
    }, config.PARENT_APP_TOKEN, { expiresIn: "1d" })
    var { id, email , companiesLogo } = req.user
    res.send({
        token: token,
        user: { id, email, companiesLogo }
    })
}) 


graphQLServer.post('/prepareEmailVerify', async(req, res) => {
    var shareDB = sequelizeInitial('ecm_share')
    var parent = await shareDB.ParentGlobal.find({
        where: {
            email: req.body.email
        }
    })
    if (parent != null) {
        var token = jwt.sign({ id: parent.get().id, auth: false, mutate: ['UPDATE_PASSWORD'], query: ['SELECT_PARENT_GLOBAL'] }, config.PARENT_APP_TOKEN, { expiresIn: 3600 })
        res.send({
            token: token
        })
    } else {
        res.send({
            token: ""
        })
    }
})

graphQLServer.get('/testPush/:token', (req, res) => {

    // var registrationToken = "f0flvIMd2mc:APA91bEjaAmX-GRxu3W1WSyLrjkwLYoD34OD4Pzt4LnWWBCnh1ODvMEdc1fHcxiBKrO5cW-SnIs9vBnrAyUrg0ToMskUs4RrMb7T4Vu9DYVFL5MUmeOWQvu4X7YhSfM6WJPq_VxeQ1nz"
    var registrationToken = req.params.token
    var payload = {
        data: {
            title: "AUX Scrum",
            message: "Scrum: Daily touchbase @ 10am Please be on time so we can cover everything on the agenda.",
            actions: JSON.stringify([
                { icon: "emailGuests", title: "EMAIL GUESTS", callback: "emailGuests", foreground: false, inline: true, replyLabel: "Enter your reply here" },
                { icon: "snooze", title: "SNOOZE", callback: "snooze", foreground: false }
            ]),
        }
    };
    admin.messaging().sendToDevice(
            registrationToken,
            payload, {
                contentAvailable: true,
                priority: "normal",
                restrictedPackageName: "com.ecoachmanager.parentapp"
            })
        .then(function(response) {
            // See the MessagingDevicesResponse reference documentation for
            // the contents of response.
            console.log("Successfully sent message:", response);
            res.send(response)
        })
        .catch(function(error) {
            console.log("Error sending message:", error);
            res.send(error)
        });
})

graphQLServer.get('/companycode/:app_code', async(req, res) => {
    let api_url = "http://journeybug.local.ppcnseo.com/"
    let query_string = "lib/api/?company=1"
    let companyCode = req.params.app_code

    let companyData = await axios.post(api_url + query_string, querystring.stringify({ code: companyCode }))
    console.log(companyData)


})

graphQLServer.post('/passOnDevices', async(req, res) => {
    var shareDB = sequelizeInitial('ecm_share')
    var parent = await shareDB.ParentGlobal.find({
        include: [{
            model: shareDB.ParentToken,
            attributes: ['push_token'],
            required: true
        }],
        where: {
            email: req.body.email
        }
    })
    if (parent != null) {
        var tokens = parent.get().tb_parent_tokens.map((item) => item.push_token)
        var payload = {
            data: Object.assign({}, req.body.data)
        }
        console.log(tokens)
        console.log(payload)
        admin.messaging().sendToDevice(
                tokens,
                payload, {
                    contentAvailable: true,
                    priority: "normal",
                })
            .then(function(response) {
                // See the MessagingDevicesResponse reference documentation for
                // the contents of response.
                console.log("Successfully sent message:", response);
                res.send(response)
            })
            .catch(function(error) {
                console.log("Error sending message:", error);
                res.send(error)
            });
    } else {
        res.send({ email: req.body.email, status: false, msg: 'Not found token for this parent' })
    }

})


// graphQLServer.get('/refreshJWT', passport.authenticate('bearer', { session: false }), (req, res) => {
//     Parent.find({
//             attributes: ['token', 'parent_id'],
//             where: {
//                 token: {
//                     $eq: req.user
//                 }
//             }
//         })
//         .then((parent) => {
//             if (parent != null) {
//                 var token = jwt.sign({ id: parent.parent_id, }, config.JWT_SECRET, { expiresIn: 3600 })
//                 Parent.update({ token: token }, { where: { parent_id: parent.parent_id } })
//                     .then(() => {
//                         res.send({
//                             token: token
//                         })
//                     })
//             } else {
//                 res.send({ message: 'Not found this token in system' })
//             }
//         })
// })
const options = {
    port: GRAPHQL_PORT,
    endpoint: '/graphql',
    subscriptions: '/subscriptions',
    playground: '/playground',
  }
  graphQLServer.start(options, ()=> console.log('Server is running on http://localhost:'+ GRAPHQL_PORT))
// graphQLServer.listen(GRAPHQL_PORT, () => console.log(
//     `GraphiQL is now running on http://localhost:${GRAPHQL_PORT}/graphiql`
// ));
}

run()