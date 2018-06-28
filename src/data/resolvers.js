import { sequelizeInitial } from './connector';
import { GraphQLScalarType , Kind  } from 'graphql';
import config from '../config';
import moment from 'moment';
import Sequelize , { Op } from 'sequelize';
const momentTz = require('moment-timezone');
import { TIMEZONE } from '../config'
import { NULL } from 'graphql/language/kinds';
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const checkPermission = (userPermissions, permission) => {
    var check = userPermissions.filter((item) => item == permission || item == 'ALL')
    if (check.length > 0) return true
    else return false
}
var globalDB = null
const makeJourney = async(pickUpArr, dropOffArr) => {
    var response = {
        collection_address: {},
        destination_address: {},
        extra_address: []
    }
    var collection_address_data = await findMovementData(pickUpArr['point_id'], ['date_start', 'time_start', 'collection_address', 'progress', 'add_lat', 'add_lng', 'movement_order']) || undefined
    var destination_address_data = await findMovementData(dropOffArr['point_id'], ['date_start', 'time_start', 'destination_address', 'progress', 'des_lat', 'des_lng', 'movement_order']) || undefined
    response = {
        ...response,
        collection_address: Object.assign({}, (collection_address_data) ? collection_address_data.get() : {}, {
            time_end: moment(collection_address_data.get().tb_movement_option.get().date_end).format('HH:mm'),
            address: collection_address_data.get().collection_address,
            latlng: collection_address_data.get().add_lat + ',' + collection_address_data.get().add_lng
        })
    }
    response = {
        ...response,
        destination_address: Object.assign({}, (destination_address_data) ? destination_address_data.get() : {}, {
            time_end: moment(destination_address_data.get().tb_movement_option.get().date_end).format('HH:mm'),
            address: destination_address_data.get().destination_address,
            latlng: destination_address_data.get().des_lat + ',' + destination_address_data.get().des_lng
        })
    }
    var extra_address_data = await findExtraRoute(pickUpArr.quote_id,
        collection_address_data.get().movement_order,
        destination_address_data.get().movement_order)
    response.extra_address = extra_address_data
        .filter((item) => (item.get().movement_order > collection_address_data.get().movement_order))
        .map((extra) => {
            return {
                movement_order: extra.get().movement_order,
                latlng: extra.get().add_lat + ',' + extra.get().add_lng
            }
        })
    return response
}

const findPassengerLog = ({ point_id, passenger_id, quote_id, pickup }) => {
    return new Promise((resolve, reject) => {
        globalDB.JobPassengers.findAll({
                where: {
                    point_id: {
                        $eq: point_id
                    },
                    passenger_id: {
                        $eq: passenger_id
                    },
                    quote_id: {
                        $eq: quote_id
                    },
                    pickup: {
                        $eq: pickup
                    }
                },
                limit: 1
            })
            .then(async(jobPassenger) => {
                // console.log(jobPassenger)
                if (jobPassenger.length > 0) {
                    var type_code = 0
                    var jobPassengerItem = jobPassenger[0].get()
                    if (jobPassengerItem.pickup == 1) {
                        if (jobPassengerItem.point_id != jobPassengerItem.action_point_id && jobPassengerItem.action_point_id != 0 && jobPassengerItem.status == 1) {
                            // wrong pickup
                            type_code = 3
                        } else if (jobPassengerItem.point_id == jobPassengerItem.action_point_id && jobPassengerItem.action_point_id != 0 && jobPassengerItem.status == 1) {
                            //correct pickup
                            type_code = 2
                        } else if (jobPassengerItem.action_point_id == 0 && jobPassengerItem.status < 0) {
                            //failed to board
                            type_code = 6
                        }
                    } else if (jobPassengerItem.pickup == 0) {
                        if (jobPassengerItem.point_id != jobPassengerItem.action_point_id && jobPassengerItem.action_point_id != 0 && jobPassengerItem.status == 1) {
                            // wrong drop off
                            type_code = 5
                        } else if (jobPassengerItem.point_id == jobPassengerItem.action_point_id && jobPassengerItem.action_point_id != 0 && jobPassengerItem.status == 1) {
                            // correct drop off
                            type_code = 4
                        } else if (jobPassengerItem.action_point_id == 0 && jobPassengerItem.status == -1) {
                            // failed to alight
                            type_code = 6
                        }
                    }
                    var scanTime = jobPassenger[0].get().date_time_scan || ""
                    var passengerLog = {
                        log_type_code: type_code,
                        date_time_scan:  (scanTime) ? momentTz(scanTime).utcOffset(TIMEZONE).format('YYYY-MM-DD HH:mm:ss') : null,
                        route_type: jobPassenger[0].get().pickup,
                        address: {}
                    }
                    var options = {
                        where: {
                            quote_id: quote_id
                        },
                        attributes: ['collection_address', 'destination_address']
                    }
                    if (jobPassengerItem.action_point_id == -1) {
                        options.where.movement_order = 1
                    } else if (jobPassengerItem.action_point_id == 0) {
                        options.where.movement_id = point_id
                    } else {
                        options.where.movement_id = jobPassengerItem.action_point_id
                    }

                    var movement = await globalDB.Movement.find(options)
                    var isLast = await IsLastMovement(quote_id, jobPassengerItem.action_point_id)
                        // console.log(movement)
                    passengerLog.address = {
                        collection: (jobPassengerItem.pickup == 0 && isLast) ? movement.get().destination_address : movement.get().collection_address,
                        destination: movement.get().destination_address
                    }
                    jobPassenger[0].dataValues = Object.assign({}, jobPassenger[0].dataValues, passengerLog)
                    if (type_code != 0) {
                        resolve(jobPassenger)
                    } else {
                        resolve([])
                    }
                } else {
                    resolve([])
                }
            })
    })
}

const IsLastMovement = (quote_id, movement_id) => {
    return new Promise((resolve, reject) => {
        globalDB.Movement.find({
                attributes: ['movement_id'],
                where: {
                    quote_id: {
                        $eq: quote_id
                    }
                },
                order: [
                    ['movement_order', 'DESC']
                ],
            })
            .then((movement) => {
                if (movement != null) {
                    if (movement.get().movement_id == movement_id) {
                        // globalDB = null
                        resolve(true)
                    } else {
                        // globalDB = null
                        resolve(false)
                    }
                }
            })
    })
}

const findExtraRoute = (quote_id, movement_start, movement_end) => {
    return new Promise((resolve, reject) => {
        globalDB.Movement.findAll({
                attributes: ['movement_order', 'add_lat', 'add_lng'],
                where: {
                    quote_id: {
                        $eq: quote_id
                    },
                    movement_order: {
                        $between: [movement_start, movement_end]
                    }
                }
            })
            .then((movements) => {
                // globalDB = null
                resolve(movements)
            })
    })
}

const findMovementData = (movement_id, attributes) => {
    return new Promise((resolve, reject) => {
        // console.log(movement_id)
        globalDB.Movement.find({
                attributes: attributes,
                include: [{
                    model: globalDB.MovementOptions,
                    as: 'tb_movement_option',
                    attributes: ['date_end'],
                    required: true
                }],
                where: {
                    movement_id: {
                        $eq: movement_id
                    }
                }
            })
            .then((movement) => {
                // console.log('movement:' + movement_id, movement)
                resolve(movement)
            })
            .catch((err) => console.log(err.message))
    })
}

const createPassengerException = (findJob , passenger_id , note) => {
    return new Promise(async (resolve , reject)=>{
        let groupByQuote = []
        if(findJob.length > 0) {
            let i = 0
            for(let job of findJob) {
                const { quote_id } = job.get({plain:true})
                const findJobPassengers = await globalDB.JobPassengers.findAll({
                    attributes: ['point_id' , 'pickup' , 'j_id'],
                    where: {
                        quote_id : {
                            $eq: quote_id
                        },
                        passenger_id: {
                            $eq: passenger_id
                        }
                    }
                })
                if(findJobPassengers.length > 0) {
                    let cancelSetData = {}
                    for(let find of findJobPassengers) {
                        if(find.pickup == 1) {
                            cancelSetData['pickup'] = find.point_id
                            cancelSetData['quote_id'] = quote_id
                            cancelSetData['j_id'] = find.j_id
                            cancelSetData['passenger_id'] = passenger_id
                            cancelSetData['datetime_cancel'] = moment().format('YYYY-MM-DD HH:mm:ss')
                            cancelSetData['status_approve'] = 1
                            cancelSetData['driver_id'] = 0
                        }else {
                            cancelSetData['dropoff'] = find.point_id
                        }
                    }
                    groupByQuote[i] = cancelSetData
                    i++
                }
            }
            for(let group of groupByQuote) {
                try{
                    const cancelCreated = await globalDB.PassengerCancelJourney.create(group)
                    const { cancel_id } = cancelCreated.get({plain:true})
                    const waitingCreated = await globalDB.WaitingApprove.create({
                        refer_id: cancel_id,
                        user_approve: 0,
                        subject: "Force remove from parent",
                        message: note,
                        status_read: 1,
                        status_approve: 1,
                        date_approve: moment().format('YYYY-MM-DD HH:mm:ss'),
                        sent_date: moment().format('YYYY-MM-DD HH:mm:ss'),
                        type_code : 0 ,
                        sent_from : 1,
                        action_data: null
                    })
                }catch(err) {
                    throw err
                }
            }
        }
        resolve()
    })
}

const updateStartPassenger = (moment_date,moment_input_date,passenger_id ,note) => {
    return new Promise(async (resolve , reject)=>{
        console.log('start date change')
        let days = 0
        let loopStartDate = null
        let loopEndDate = null
        let mode = ""
        if(moment_date.isAfter(moment_input_date,'day')) {
            days = moment_date.diff(moment_input_date,'day')
            loopStartDate = moment_input_date
            loopEndDate = moment_input_date.add(days-1,'day')
            mode = "create"
        }else if(moment_input_date.isAfter(moment_date,'day')){
            days = moment_input_date.diff(moment_date,'day')
            loopStartDate = moment_date
            loopEndDate = moment_input_date
            mode = "update"
        }
        console.log('mode' , mode)
        const findDuplicateEvent = await globalDB.PassengerCalendar.findAll({
            attributes: ['event_id'],
            where: {
                passenger_id : passenger_id,
                $or : {
                    start_date : {
                        $and : (mode == 'create') 
                        ? {
                            $gte: loopStartDate.format('YYYY-MM-DD'),
                            $lte: loopEndDate.format('YYYY-MM-DD'),
                        } 
                        : {
                            $gte: loopEndDate.format('YYYY-MM-DD'),
                            $lte: loopEndDate.format('YYYY-MM-DD'),
                        }
                    },
                    end_date :  {
                        $and : (mode == 'create') 
                        ? {
                            $gte: loopStartDate.format('YYYY-MM-DD'),
                            $lte: loopEndDate.format('YYYY-MM-DD'),
                        } 
                        : {
                            $gte: loopEndDate.format('YYYY-MM-DD'),
                            $lte: loopEndDate.format('YYYY-MM-DD'),
                        }
                    }
                }
                
            }
        })
        if(findDuplicateEvent.length == 0)
        {
            for(let i = 0; i <= days; i++) {
                const addDate = loopStartDate.add(i , 'day')
                const findJobForAction = await globalDB.Quote.findAll({
                    attributes: ['quote_id'],
                    include: [
                        {
                            model: globalDB.JobPassengers,
                            attributes: [],
                            required: true,
                            where: {
                                passenger_id : {
                                    $eq: passenger_id
                                }
                            }
                        },
                    ],
                    where: {
                        date_out : {
                            $and: {
                                $gte: addDate.format('YYYY-MM-DD') + ' 00:00:00',
                                $lte: addDate.format('YYYY-MM-DD') + ' 23:59:59'
                            }
                        },
                        account : {
                            $gt : 0
                        }
                    },
                    group: [['quote_id','ASC']]
                })
                const checkIfJobExistInCancel = await globalDB.PassengerCancelJourney.findAll({
                    attributes: ['quote_id'],
                    where: {
                        quote_id: {
                            $in: findJobForAction.map((item)=>item.get({plain:true}).quote_id)
                        },
                        passenger_id : passenger_id
                    },
                    group: [['quote_id','ASC']]
                }).map((item)=>item.get({plain:true}).quote_id)
                console.log('list of jobs already exist in cancel' , checkIfJobExistInCancel)
                if(findJobForAction.length > 0) {
                    if(mode == 'update' ) {
                        if(i == 0) {
                            console.log('remove in update mode')
                            for(let job of findJobForAction) {
                                const { quote_id } = job.get({plain:true})
                                const cancelItem = await globalDB.PassengerCancelJourney.find({
                                    where: {
                                        quote_id: {
                                            $eq: quote_id
                                        },
                                        passenger_id: {
                                            $eq: passenger_id
                                        }
                                    }
                                })
                                console.log('remove waiting refer id' , cancelItem.get({plain:true}).cancel_id)
                                const removeWaiting = await globalDB.WaitingApprove.destroy({
                                    where: {
                                        refer_id: cancelItem.get({plain:true}).cancel_id
                                    }
                                })
                                console.log('remove cancel id' , cancelItem.get({plain:true}).cancel_id)
                                const removeCancel = await globalDB.PassengerCancelJourney.destroy({
                                    where: {
                                        cancel_id: cancelItem.get({plain:true}).cancel_id
                                    }
                                })
                            }
                        }else{
                            const filterJob = findJobForAction.filter((item)=>{
                                return !checkIfJobExistInCancel.includes(item.get({plain:true}).quote_id)
                            })
                            console.log('create passenger' , filterJob , passenger_id , note)
                            await createPassengerException(filterJob , passenger_id , note)
                        }
                        
                    }
                    if(mode === 'create') {
                        if( i == days) continue;
                        else {
                            const filterJob = findJobForAction.filter((item)=>{
                                return !checkIfJobExistInCancel.includes(item.get({plain:true}).quote_id)
                            })
                            console.log('create passenger' , filterJob , passenger_id , note)
                            await createPassengerException(filterJob , passenger_id , note)
                        }
                    }
                }
            }
        }
        resolve()
    })
}

const updateEndPassenger = (moment_date,moment_input_date,passenger_id , note) => {
    return new Promise(async (resolve , reject)=>{
        console.log('end date change')
        let days = 0
        let loopStartDate = null
        let loopEndDate = null
        let mode = ""
        if(moment_input_date.isAfter(moment_date,'day')) {
            days = moment_input_date.diff(moment_input_date,'day')
            loopStartDate = moment_date
            loopStartDate = loopStartDate.add(1 , 'day')
            loopEndDate = moment_input_date
            mode = "create"
        }else if(moment_date.isAfter(moment_input_date,'day')){
            days = moment_date.diff(moment_input_date,'day')
            loopStartDate = moment_input_date
            loopEndDate = moment_date
            mode = "update"
        }
        console.log('mode' , mode)
        const findDuplicateEvent = await globalDB.PassengerCalendar.findAll({
            where: {
                passenger_id : passenger_id,
                $or : {
                    start_date : {
                        $and : (mode == 'create') 
                        ? {
                            $gte: loopStartDate.format('YYYY-MM-DD'),
                            $lte: loopEndDate.format('YYYY-MM-DD'),
                        }
                        : {
                            $gte: loopEndDate.format('YYYY-MM-DD'),
                            $lte: loopEndDate.format('YYYY-MM-DD'),
                        }
                    },
                    end_date :  {
                        $and : (mode == 'create') 
                        ? {
                            $gte: loopStartDate.format('YYYY-MM-DD'),
                            $lte: loopEndDate.format('YYYY-MM-DD'),
                        }
                        : {
                            $gte: loopEndDate.format('YYYY-MM-DD'),
                            $lte: loopEndDate.format('YYYY-MM-DD'),
                        }
                    }
                }
               
            }
        })
        
        if(findDuplicateEvent.length == 0)
        {
            for(let i = 0; i < days; i++) {
                const addDate = loopStartDate.add(i , 'day')
                const findJobForAction = await globalDB.Quote.findAll({
                    attributes: ['quote_id'],
                    include: [
                        {
                            model: globalDB.JobPassengers,
                            attributes: [],
                            required: true,
                            where: {
                                passenger_id : {
                                    $eq: passenger_id
                                }
                            }
                        }
                    ],
                    where: {
                        date_out : {
                            $and: {
                                $gte: addDate.format('YYYY-MM-DD') + ' 00:00:00',
                                $lte: addDate.format('YYYY-MM-DD') + ' 23:59:59'
                            }
                        },
                        account : {
                            $gt : 0
                        }
                    },
                    group: [['quote_id','ASC']]
                })
                const checkIfJobExistInCancel = await globalDB.PassengerCancelJourney.findAll({
                    attributes: ['quote_id'],
                    where: {
                        quote_id: {
                            $in: findJobForAction.map((item)=>item.get({plain:true}).quote_id)
                        },
                        passenger_id : passenger_id
                    },
                    group: [['quote_id','ASC']]
                }).map((item)=>item.get({plain:true}).quote_id)
                console.log('list of jobs already exist in cancel' , checkIfJobExistInCancel)
                if(findJobForAction.length > 0) {
                    if(mode == 'update') {
                        if(i > 0) {
                            for(let job of findJobForAction) {
                                const { quote_id } = job.get({plain:true})
                                const cancelItem = await globalDB.PassengerCancelJourney.find({
                                    where: {
                                        quote_id: {
                                            $eq: quote_id
                                        },
                                        passenger_id: {
                                            $eq: passenger_id
                                        }
                                    }
                                })
                                console.log('remove waiting refer id ' , cancelItem.get({plain:true}).cancel_id)
                                const removeWaiting = await globalDB.WaitingApprove.destroy({
                                    where: {
                                        refer_id: cancelItem.get({plain:true}).cancel_id
                                    }
                                })
                                console.log('remove cancel id ' , cancelItem.get({plain:true}).cancel_id)
                                await globalDB.PassengerCancelJourney.destroy({
                                    where: {
                                        cancel_id : cancelItem.get({plain:true}).cancel_id
                                    }
                                })
                            }
                        }else {
                            const filterJob = findJobForAction.filter((item)=>{
                                return !checkIfJobExistInCancel.includes(item.get({plain:true}).quote_id)
                            })
                            console.log('create passenger' , filterJob , passenger_id , note)
                            await createPassengerException(filterJob , passenger_id , note)
                        }
                        
                    }else if(mode == 'create'){ 
                        const filterJob = findJobForAction.filter((item)=>{
                            return !checkIfJobExistInCancel.includes(item.get({plain:true}).quote_id)
                        })
                        console.log('create passenger' , filterJob , passenger_id , note)
                        await createPassengerException(filterJob , passenger_id , note)
                    }  
                }
            }
        }
        resolve()
    })
}

const resolvers = {
    Query: {
        parentGlobalSelect(_, args, request) {
            if (!checkPermission(request.user.query, 'SELECT_PARENT_GLOBAL')) {
                return null
            }
            var database = sequelizeInitial('ecm_share')
            return database.ParentGlobal.find({
                where: args
            })
        },
        async parent(_, args, request) {
            if (!checkPermission(request.user.query, 'SELECT_PARENT')) {
                return null
            }
            try {
                var result = []
                for (let i = 0; i < request.user.databases.length; i++) {
                    var schoolDB = sequelizeInitial(request.user.databases[i])
                    var parentData = await schoolDB.Parent.find({
                        where: {
                            email: args.email
                        }
                    })
                    var accountData = await schoolDB.Account.find({
                        where: {
                            account_id: parentData.get().account
                        }
                    })
                    result.push({
                        school_name: accountData.get().name,
                        parent: parentData.get()
                    })
                    schoolDB = null
                }
                return result
            }catch(err){
                console.log(err.message)
                return null
            }
                // return Parent.find({ where: args })
        },
        async parentPassengers(_, args, request) {
            if (!checkPermission(request.user.query, 'SELECT_PARENT_PASSENGERS')) {
                return null
            }
            try {
                var result = []
                for (let i = 0; i < request.user.databases.length; i++) {
                    var schoolDB = sequelizeInitial(request.user.databases[i])
                    var parentData = await schoolDB.Parent.find({
                        attributes: ['parent_id', 'account'],
                        where: {
                            email: request.user.email
                        }
                    })
                    if (parentData == null) {
                        console.log('parent data null')
                        return null
                    }
                    var passengerData = await schoolDB.Passengers.findAll({
                        include: [{
                            model: schoolDB.ParentPassenger,
                            where: {
                                parent_id: parentData.get().parent_id
                            },
                            order: [
                                ['first_name', 'ASC']
                            ]
                        }]
                    })
                    var accountData = await schoolDB.Account.find({
                        where: {
                            account_id: parentData.get().account
                        }
                    })
                    for (let i = 0; i < passengerData.length; i++) {
                        passengerData[i].routeToday = []

                        

                        // previous journey
                        var journeys = []
                        // console.log('origin' , args.date , args.time , args.timezone)
                        const dateCondition = moment(`${args.date}T${args.time}${args.timezone}`)
                        const subtractTime = moment(`${args.date}T${args.time}${args.timezone}`).subtract(2, 'hours')
                        const addTime = moment(`${args.date}T${args.time}${args.timezone}`).add(2, 'hours')
                        // console.log('addtime' , addTime)
                        // console.log('subtractTime' , subtractTime)
                        const passengerCancel = await schoolDB.PassengerCancelJourney.findAll({
                            where: {
                                passenger_id: passengerData[i].passenger_id
                            },
                            group: [['j_id','ASC']]
                        }).map((item)=>item.get({plain:true}).j_id)

                        var previousJourney = await schoolDB.Journey.findAll({
                            attributes: ['j_id', 'date_back' , 'date_out'],
                            include: [
                                {
                                    attributes: [],
                                    model: schoolDB.JobPassengers,
                                    duplicating: false,
                                    where: {
                                        passenger_id: {
                                            $eq: passengerData[i].passenger_id
                                        }
                                    },
                                    order: [],
                                },
                                {
                                    attributes: [],
                                    model: schoolDB.Quote,
                                    duplicating: false,
                                    where: {
                                        account: {
                                            $eq: accountData.get().account_id
                                        },
                                        status_re: {
                                            $eq: 'B'
                                        }
                                    },
                                    order: [],
                                }
                            ],
                            where: {
                                date_back: {
                                    $lt: subtractTime
                                }
                            },  
                            group: [['j_id','ASC']],
                            order: [[ 'date_back', 'DESC']],
                            limit : 1,
                            // logging: console.log 
                        })
                        if(previousJourney.length > 0) {
                            journeys = journeys.concat(previousJourney)
                        }
                        var currentJourneys = await schoolDB.Journey.findAll({
                            attributes: ['j_id', 'date_back' , 'date_out'],
                            include: [
                                {
                                    attributes: [],
                                    model: schoolDB.JobPassengers,
                                    duplicating: false,
                                    where: {
                                        passenger_id: {
                                            $eq: passengerData[i].passenger_id
                                        }
                                    },
                                    order: [],
                                },
                                {
                                    attributes: [],
                                    model: schoolDB.Quote,
                                    duplicating: false,
                                    where: {
                                        account: {
                                            $eq: accountData.get().account_id
                                        },
                                        status_re: {
                                            $eq: 'B'
                                        }
                                    },
                                    order: [],
                                }
                            ],
                            where: {
                                $or: 
                                [ 
                                    {
                                        date_out: {
                                            $and: [
                                                {
                                                    $gte: subtractTime
                                                },
                                                {
                                                    $lte: addTime
                                                }
                                            ]
                                        }
                                    },
                                    {
                                        date_back: {
                                            $and: [
                                                {
                                                    $gte: subtractTime
                                                },
                                                {
                                                    $lte: addTime
                                                }
                                            ]
                                        }
                                    }
                                ]
                                
                            },  
                            group: [['j_id','ASC']],
                            order: [[ 'date_out', 'ASC']],
                            limit : 2 ,
                            // logging: console.log
                        })
                        if(currentJourneys.length > 0) {
                            journeys = journeys.concat(currentJourneys)
                        }
                        if(journeys.length < 3) {
                            var nextJourneys = await schoolDB.Journey.findAll({
                                attributes: ['j_id' , 'date_back' , 'date_out'],
                                include: [
                                    {
                                        attributes: [],
                                        model: schoolDB.JobPassengers,
                                        duplicating: false,
                                        where: {
                                            passenger_id: {
                                                $eq: passengerData[i].passenger_id
                                            }
                                        },
                                        order: [],
                                    },
                                    {
                                        attributes: [],
                                        model: schoolDB.Quote,
                                        duplicating: false,
                                        where: {
                                            account: {
                                                $eq: accountData.get().account_id
                                            },
                                            status_re: {
                                                $eq: 'B'
                                            }
                                        },
                                        order: [],
                                    }
                                ],
                                where: {
                                    date_out: {
                                        $gt: addTime.format('YYYY-MM-DD HH:mm')
                                    }
                                },  
                                group: [['j_id','ASC']],
                                order: [[ 'date_out', 'ASC']],
                                limit : (journeys.length == 1) ? 2 : 1
                            })
                            if(nextJourneys.length > 0) {
                                journeys = journeys.concat(nextJourneys)
                            }
                        }   
                        // console.log(journeys.map((item)=>item.get({plain:true})))
                        // console.log(previousJourney)
                        journeys = journeys.filter((item)=>{
                            let { j_id } = item.get({plain: true})
                            return !passengerCancel.includes(j_id)
                        })
                        var jobs = await schoolDB.JobPassengers.findAll({
                                attributes: ['quote_id', 'point_id', 'pickup', 'passenger_id', 'j_id'],
                                where: {
                                    j_id: {
                                        $in: journeys.map((item)=>item.get({plain:true}).j_id)
                                    },
                                    passenger_id: passengerData[i].passenger_id
                                }
                            })
                            // console.log(jobs)
                        if (jobs == null) {
                            console.log('jobs data null')
                            continue
                        }
                        globalDB = schoolDB
                        var jobData = jobs.map((job) => job.get())
                        var jobDataPickUp = jobData.filter((job) => job.pickup == 1)
                        var jobDataDropOff = jobData.filter((job) => job.pickup == 0)
                    
                            // console.log(passengerData[i].passenger_id)
                        if (jobDataPickUp.length > 0 && jobDataDropOff.length > 0) {
                            var journeyData = {}
                            for (let j = 0; j < jobDataPickUp.length; j++) {
                                journeyData = {}
                                journeyData = await makeJourney(jobDataPickUp[j], jobDataDropOff[j])
                                let col_passenger_log = await findPassengerLog(jobDataPickUp[j])
                                let des_passenger_log = await findPassengerLog(jobDataDropOff[j])
                                    // console.log('col_passenger', col_passenger_log)
                                    // console.log('des_passenger', des_passenger_log)
                                journeyData.collection_address.passenger_log = (col_passenger_log.length > 0) ? col_passenger_log.map((item) => item.get()) : []
                                journeyData.destination_address.passenger_log = (des_passenger_log) ? des_passenger_log.map((item) => item.get()) : []
                                journeyData.collection_address.time_start = moment(journeyData.collection_address.time_start, 'HH:mm:ss').format('HH:mm')
                                let datetime_start = moment(`${journeyData.collection_address.date_start}T${journeyData.collection_address.time_start}${args.timezone}`)
                                let datetime_end = moment(`${journeyData.destination_address.date_start}T${journeyData.destination_address.time_end}${args.timezone}`)
                                // console.log('start' ,datetime_start)
                                // console.log('end' ,datetime_end)
                                // console.log('add' ,addTime)
                                // console.log('subtract' , subtractTime)
                                if ((datetime_start.isSameOrAfter(subtractTime) && datetime_start.isSameOrBefore(addTime)) || 
                                    (datetime_end.isSameOrAfter(subtractTime) && datetime_end.isSameOrBefore(addTime))){
                                    journeyData.peroid = 'current'
                                } else if (datetime_start.isAfter(addTime)) {
                                    journeyData.peroid = 'next'
                                } else if (datetime_end.isBefore(subtractTime)) {
                                    journeyData.peroid = 'previous'
                                } else {
                                    console.log('fail condition')
                                    journeyData.peroid = ''
                                }
                                // console.log(journeyData.peroid)
                                journeyData.j_id = jobDataPickUp[j].j_id
                                journeyData.date_today = moment(journeyData.collection_address.date_start).format('DD/MM/YYYY')
                                journeyData.tracking = await schoolDB.Tracking.find({
                                        order: [
                                            ['track_id', 'DESC']
                                        ],
                                        attributes: ['lat', 'lng', 'timestamp', 'j_id'],
                                        where: {
                                            j_id: {
                                                $eq: jobDataPickUp[j].j_id
                                            }
                                        }
                                    })
                                    // console.log(journeyData)
                                passengerData[i].routeToday.push(journeyData)
                            }
                        }
                        passengerData[i].routeToday = passengerData[i].routeToday.sort((a,b)=>{
                            return new Date(moment(`${a.collection_address.date_start}T${a.collection_address.time_start}${args.timezone}`)) - new Date(moment(`${b.collection_address.date_start}T${b.collection_address.time_start}${args.timezone}`))
                        })
                    }
                    result.push({
                        school_name: accountData.get().name,
                        passengers: passengerData
                    })
                    schoolDB = null
                }

                return result
            } catch (err) {
                console.log(err)
                return null
            }

        },
        async schoolContact(_, args, request) {
            if (!checkPermission(request.user.query, 'SELECT_SCHOOL_CONTACT')) {
                return null
            }
            var result = []
            for (let i = 0; i < request.user.databases.length; i++) {
                var schoolDB = sequelizeInitial(request.user.databases[i])
                var parentData = await schoolDB.Parent.find({
                    attributes: ['account'],
                    where: {
                        email: request.user.email
                    }
                })
                var accountData = await schoolDB.Account.find({
                    where: {
                        account_id: parentData.get().account
                    }
                })
                result.push(accountData.get())
                schoolDB = null
            }
            return result
        },
        async parentContactOptions(_, args, request) {
            if (!checkPermission(request.user.query, 'SELECT_CONTACT_OPTIONS')) {
                return null
            }
            var database = sequelizeInitial('ecm_share')
            return database.ParentGlobal.find({
                attributes: ['accept_email', 'accept_notification'],
                where: {
                    email: request.user.email
                }
            })
        },
        async excPassegners(_, args, request) {
            if (!checkPermission(request.user.query, 'SELECT_PASSENGER_EXCEPTIONS')) {
                return null
            }
            var results = []
            for (let i = 0; i < request.user.databases.length; i++) {
                var schoolDB = sequelizeInitial(request.user.databases[i])
                var parentData = await schoolDB.Parent.find({
                    attributes: ['parent_id', 'account'],
                    where: {
                        email: request.user.email
                    }
                })
                if (parentData == null) {
                    console.log('parent data null')
                    return null
                }
                // console.log(parentData.get())
                var passengerData = await schoolDB.Passengers.findAll({
                    attributes: ['passenger_id' , 'first_name','surname'],
                    include: [{
                        attributes: [],
                        model: schoolDB.ParentPassenger,
                        where: {
                            parent_id: parentData.get().parent_id
                        },
                        order: [
                            ['first_name', 'ASC']
                        ]
                    }]
                })
                var accountData = await schoolDB.Account.find({
                    where: {
                        account_id: parentData.get().account
                    }
                })
                // console.log(passengerData)
                var passengers = passengerData.map((passenger)=>passenger.get())
                // console.log(results)
                var today = moment(args['date'],'YYYY-MM-DD')
                passengers = passengers.map(async (item)=>{
                    var exceptions = await schoolDB.PassengerCalendar.findAll({
                        where:{
                            passenger_id: item.passenger_id,
                            $or: {
                                start_date: {
                                    $gte: today.format('YYYY-MM-DD')
                                },
                                end_date: {
                                    $gte: today.format('YYYY-MM-DD')
                                }
                            }
                        }
                    })
                    item.exceptions = exceptions.map((ex)=>ex.get())
                    return item
                })
                results.push({
                    school_name: accountData.get().name,
                    passengers: passengers
                })
                schoolDB = null
            }
            return results
        }
    },
    Mutation: {
        async parentPasswordUpdate(_, args, request) {
            if (!checkPermission(request.user.mutate, 'UPDATE_PASSWORD')) {
                return {
                    msg: "Your token is operation not permit",
                    status: false
                }
            }
            args.input['password'] = crypto.createHash('md5').update(args.input['password']).digest('hex');
            var shareDB = sequelizeInitial('ecm_share')
            try {
                var parentUpdate = await shareDB.ParentGlobal.update({ password: args.input['password'] }, { where: { email: args.input['email'], id: request.user.id } })
                return {
                    msg: "Password has been updated",
                    status: true
                }
            } catch (err) {
                return {
                    msg: err.message,
                    status: false
                }
            }
        },
        async parentPushTokenCreate(_, args, request) {
            if (!checkPermission(request.user.mutate, 'CREATE_PUSH_TOKEN')) {
                return {
                    msg: "Your token is operation not permit",
                    status: false
                }
            }
            var shareDB = sequelizeInitial('ecm_share')
            try {
                const tokenItem = await shareDB.ParentToken.find({
                    where : {
                        parent_id: request.user.id,
                        device_id:  args.input['uuid']
                    }
                })
                if(tokenItem != null) {
                    const tokenUpdate = await shareDB.ParentToken.update({
                        push_token: args.input['push_token'],
                    },{
                        where: {
                            parent_id: request.user.id,
                            device_id:  args.input['uuid']
                        }
                    })
                }else {
                    var parentTokenCreate = await shareDB.ParentToken.create({
                        push_token: args.input['push_token'],
                        parent_id: request.user.id,
                        device_id:  args.input['uuid']
                    })
                }
                shareDB = null
                return { msg: 'New token has been added', status: true }
            } catch (err) {
                shareDB = null
                return { msg: err.message, status: false }
            }
        },
        async parentPushTokenDelete(_, args, request) {
            if (!checkPermission(request.user.mutate, 'DELETE_PUSH_TOKEN')) {
                return {
                    msg: "Your token is operation not permit",
                    status: false
                }
            }
            var shareDB = sequelizeInitial('ecm_share')
            try {
                var parentTokenDelete = await shareDB.ParentToken.destroy({
                    where: {
                        push_token: args.input['push_token'],
                        parent_id: request.user.id,
                        device_id: args.input['uuid']
                    }
                })
                return { msg: 'token has been deleted', status: true }
            } catch (err) {
                return { msg: err.message, status: false }
            }
        },
        async parentUpdateContactOption(_, args, request) {
            if (!checkPermission(request.user.mutate, 'UPDATE_CONTACT_OPTION')) {
                return {
                    msg: "Your token is operation not permit",
                    status: false
                }
            }
            var shareDB = sequelizeInitial('ecm_share')
            try {
                var updateItem = {}
                updateItem[args.input['key']] = args.input['value']
                var parentContactOptionsUpdate = await shareDB.ParentGlobal.update(updateItem, { where: { id: request.user.id } })
                return { msg: args.input['key'] + ' has been updated', status: true }
            } catch (err) {
                return { msg: err.message, status: false }
            }
        },
        async parentCreateExcPassenger(_ , args, request) {
            if (!checkPermission(request.user.mutate, 'CREATE_EXC_PASSENGER')) {
                return {
                    msg: "Your token is operation not permit",
                    status: false,
                    exception: null
                }
            }
            globalDB = sequelizeInitial(request.user.databases[args.input['db_index']])
            var schoolDB = sequelizeInitial(request.user.databases[args.input['db_index']])
            try {   
                const findEvent = await schoolDB.PassengerCalendar.findAll({
                    where: {
                        passenger_id: args.input['passenger_id'],
                        start_date : {
                            $and : {
                                $gte: moment(args.input['start_date']).format('YYYY-MM-DD'),
                                $lte: moment(args.input['end_date']).format('YYYY-MM-DD'),
                            }
                        },
                        end_date :  {
                            $and : {
                                $gte: moment(args.input['start_date']).format('YYYY-MM-DD'),
                                $lte: moment(args.input['end_date']).format('YYYY-MM-DD'),
                            }
                        }
                    }
                })
                if(findEvent.length > 0) throw new Error('Duplicate date.')
                const findJob = await schoolDB.Quote.findAll({
                    attributes: ['quote_id'],
                    include: [
                        {
                            model: schoolDB.JobPassengers,
                            attributes: [],
                            required: true,
                            where: {
                                passenger_id : {
                                    $eq: args.input['passenger_id']
                                }
                            }
                        }
                    ],
                    where: {
                        date_out : {
                            $and: {
                                $gte: moment(args.input['start_date']).format('YYYY-MM-DD') + ' 00:00:00',
                                $lte: moment(args.input['end_date']).format('YYYY-MM-DD') + ' 23:59:59'
                            }
                        },
                        account : {
                            $gt : 0
                        }
                    },
                    group: [['quote_id','ASC']]
                })
                await createPassengerException(findJob ,args.input['passenger_id'],args.input['note'])
                const create = await schoolDB.PassengerCalendar.create({
                    start_date : moment(args.input['start_date']).format('YYYY-MM-DD'),
                    end_date: moment(args.input['end_date']).format('YYYY-MM-DD'),
                    note: args.input['note'],
                    passenger_id: args.input['passenger_id']
                })
                schoolDB = null
                globalDB = null
                return { msg: 'Exception created' , status: true , exception: create.get({plain:true})}
            }catch(err) {
                schoolDB = null
                globalDB = null
                return { msg: err.message, status: false , exception: null}
            }
        },
        async parentUpdateExcPassenger(_, args, request) {
            if (!checkPermission(request.user.mutate, 'UPDATE_EXC_PASSENGER')) {
                return {
                    msg: "Your token is operation not permit",
                    status: false
                }
            }
            globalDB = sequelizeInitial(request.user.databases[args.input['db_index']])
            let schoolDB = sequelizeInitial(request.user.databases[args.input['db_index']])
            try{
                const findEvent = await schoolDB.PassengerCalendar.find({
                    where: {
                        event_id: {
                            $eq: args.input['event_id']
                        }
                    }
                })
                if(findEvent == null) throw new Error('Not found event')
                const { start_date , end_date , passenger_id } = findEvent.get({plain: true})
                let moment_start = moment(start_date,'YYYY-MM-DD')
                let moment_input_start = moment(args.input['start_date'],'YYYY-MM-DD')
                let moment_end = moment(end_date,'YYYY-MM-DD')
                let moment_input_end = moment(args.input['end_date'],'YYYY-MM-DD')
                if(
                    (!moment_start.isSame(moment_input_start,'day')) ||
                    (!moment_start.isSame(moment_input_start,'month')) ||
                    (!moment_start.isSame(moment_input_start,'year')) 
                ) {
                    await updateStartPassenger(moment_start , moment_input_start , passenger_id,args.input['note'])
                } 
                else if(
                    (!moment_end.isSame(moment_input_end,'day')) ||
                    (!moment_end.isSame(moment_input_end,'month')) ||
                    (!moment_end.isSame(moment_input_end,'year')) 
                ) {
                    await updateEndPassenger(moment_end , moment_input_end , passenger_id , args.input['note'])
                }
                const update = await schoolDB.PassengerCalendar.update({
                    start_date : args.input['start_date'],
                    end_date: args.input['end_date'],
                    note: args.input['note']
                },{
                    where: {
                        event_id: {
                            $eq: args.input['event_id']
                        }
                    }
                })
                schoolDB = null
                globalDB = null
                return { msg: 'Exception updated' , status: true}
            }catch (err){
                schoolDB = null
                globalDB = null
                return { msg: err.message, status: false }
            }
        },
        async parentDeleteExcPassenger(_ , args ,request) {
            if (!checkPermission(request.user.mutate, 'DELETE_EXC_PASSENGER')) {
                return {
                    msg: "Your token is operation not permit",
                    status: false
                }
            }
            var schoolDB = sequelizeInitial(request.user.databases[args.input['db_index']])
            try{
                const destroy_exc = await schoolDB.PassengerCalendar.find({
                    where: {
                        event_id: {
                            $eq: args.input['event_id']
                        },
                        passenger_id : {
                            $eq : args.input['passenger_id']
                        }
                    }
                })
                const destroy_cancel = await schoolDB.PassengerCancelJourney.findAll({
                    attributes: ['cancel_id','quote_id','passenger_id'],
                    include: [
                         {
                            model: schoolDB.Quote,
                            required: true,
                            attributes: [],
                            include: [
                                {
                                    model: schoolDB.JobPassengers,
                                    attributes: [],
                                    required: true,
                                    where: {
                                        passenger_id : {
                                            $eq: destroy_exc.get({plain:true}).passenger_id
                                        }
                                    }
                                }
                            ],
                            where: {
                                date_out : {
                                    $and: {
                                        $gte: moment(destroy_exc.get({plain:true}).start_date).format('YYYY-MM-DD') + ' 00:00:00',
                                        $lte: moment(destroy_exc.get({plain:true}).end_date).format('YYYY-MM-DD') + ' 23:59:59'
                                    }
                                },
                                account : {
                                    $gt : 0
                                }
                            },
                         }
                    ], 
                    group: [['quote_id','ASC']]
                })
                // console.log(destroy_cancel.map((cancel)=>cancel.get({plain:'true'}).cancel_id))
                const destroy_waiting = await schoolDB.WaitingApprove.destroy({
                    where: {
                        refer_id: {
                            $in : destroy_cancel.map((cancel)=>cancel.get({plain:'true'}).cancel_id)
                        }
                    }
                })
                await schoolDB.PassengerCancelJourney.destroy({
                    where: {
                        cancel_id : {
                            $in : destroy_cancel.map((cancel)=>cancel.get({plain:'true'}).cancel_id)
                        }
                    }
                })
                await schoolDB.PassengerCalendar.destroy({
                    where: {
                        event_id: {
                            $eq: args.input['event_id']
                        },
                        passenger_id : {
                            $eq : args.input['passenger_id']
                        }
                    }
                })
                schoolDB = null
                return { msg: 'Exception deleted' , status: true}
            }catch (err){
                schoolDB = null
                return { msg: err.message, status: false }
            }
        },
        async parentCreateExcPassengerFromJourney(_, args, request) {
            if (!checkPermission(request.user.mutate, 'CREATE_EXC_PASSENGER')) {
                return {
                    msg: "Your token is operation not permit",
                    status: false
                }
            }
            globalDB = sequelizeInitial(request.user.databases[args.input['db_index']])
            var schoolDB = sequelizeInitial(request.user.databases[args.input['db_index']])
            try{
                //maybe don't need to check cancel exist
                const routePassengerInJourney = await schoolDB.JobPassengers.findAll({
                    where: {
                        passenger_id : args.input['passenger_id'],
                        j_id : args.input['j_id']
                    }
                })
                if(routePassengerInJourney.length > 0) {
                    let cancelSetData = {}
                    for(let find of routePassengerInJourney) {
                        if(find.pickup == 1) {
                            cancelSetData['pickup'] = find.point_id
                            cancelSetData['quote_id'] = find.quote_id
                            cancelSetData['j_id'] = args.input['j_id']
                            cancelSetData['passenger_id'] = args.input['passenger_id']
                            cancelSetData['datetime_cancel'] = moment().format('YYYY-MM-DD HH:mm:ss')
                            cancelSetData['status_approve'] = 1
                            cancelSetData['driver_id'] = 0
                        }else {
                            cancelSetData['dropoff'] = find.point_id
                        }
                    }
                    const cancelCreated = await globalDB.PassengerCancelJourney.create(cancelSetData)
                    const { cancel_id } = cancelCreated.get({plain:true})
                    const waitingCreated = await globalDB.WaitingApprove.create({
                        refer_id: cancel_id,
                        user_approve: 0,
                        subject: "Remove next journey from parent",
                        message: JSON.stringify(cancelSetData),
                        status_read: 1,
                        status_approve: 1,
                        date_approve: moment().format('YYYY-MM-DD HH:mm:ss'),
                        sent_date: moment().format('YYYY-MM-DD HH:mm:ss'),
                        type_code : 0 ,
                        sent_from : 1,
                        action_data: null
                    })
                }
                globalDB = null
                schoolDB = null
                return { msg: 'Remove sucess' , status: true }
            }catch(err) {
                globalDB = null
                schoolDB = null
                return { msg: err.message, status: false}
            }
        }
    },
    Date: new GraphQLScalarType({
        name: 'Date',
        description: 'Date custom scalar type',
        parseValue(value) {
            // console.log('parse' , value)
            // console.log('return' , moment(value))
            return moment(value) // value from the client
        },
        serialize(value) {
            // console.log('seria' , value)
            return moment(value) // value sent to the client
        },
        parseLiteral(ast) {
            if (ast.kind === Kind.STRING) {
                // console.log('lite', ast.value)
                return moment(ast.value) // value from the client query
            }
            return null;
        },
    })
}

export default resolvers