import {
    makeExecutableSchema,
} from 'graphql-tools';

import resolvers from './resolvers';

export const typeDefs = `

    scalar Date

    type Query {
        parentGlobalSelect(email: String!): ParentGlobal
        parent(email: String!): [ParentBySchool]
        parentPassengers(date: String! , time: String! , timezone: String!): [PassengersBySchool]
        schoolContact: [SchoolContact]
        parentContactOptions: ParentContactOptions
        excPassegners(date: String!): [PassengerExceptions]
    }

    type Mutation {
        parentPasswordUpdate(input: UpdatePasswordInput!) : UpdatePasswordPayload
        parentPushTokenCreate(input: CreateParentPushTokenInput!) : CreateParentPushTokenPayload
        parentPushTokenDelete(input: DeleteParentPushTokenInput!) : DeleteParentPushTokenPayload
        parentUpdateContactOption(input: UpdateParentContactOptionInput!) : UpdateParentContactOptionPayload
        parentCreateExcPassenger(input: CreateParentExcPassenger) : CreateParentExcPassengerPayload
        parentUpdateExcPassenger(input: UpdateParentExcPassenger) : UpdateParentExcPassengerPayload
        parentDeleteExcPassenger(input: DeleteParentExcPassenger) : DeleteParentExcPassengerPayload
        parentCreateExcPassengerFromJourney(input: CreateParentExcPassengerFromJourney) : CreateParentExcPassengerFromJourneyPayload
    }

    input CreateParentExcPassengerFromJourney {
        j_id: Int!
        passenger_id: Int!
        db_index: Int!
    }

    type CreateParentExcPassengerFromJourneyPayload {
        msg: String!
        status: Boolean!
    }

    input CreateParentExcPassenger {
        passenger_id: Int!
        start_date: String!
        end_date: String!
        note: String
        db_index: Int!
    }

    type CreateParentExcPassengerPayload {
        msg: String!
        status: Boolean!
        exception: Exception
    }

    input UpdateParentExcPassenger {
        db_index: Int!
        event_id: Int!
        start_date: String!
        end_date: String!
        note: String
    }

    type UpdateParentExcPassengerPayload {
        msg: String!
        status: Boolean!
    }

    input DeleteParentExcPassenger {
        db_index: Int!
        event_id: Int!
        passenger_id: Int!
    }

    type DeleteParentExcPassengerPayload {
        msg: String!
        status: Boolean!
    }


    input CreateParentPushTokenInput {
        push_token: String!
        uuid: String!
    }
    
    type CreateParentPushTokenPayload {
        msg: String!
        status: Boolean!
    }

    input DeleteParentPushTokenInput {
        push_token: String!
        uuid: String!
    }

    type DeleteParentPushTokenPayload {
        msg: String!
        status: Boolean!
    }
    
    input UpdatePasswordInput {
        email: String!
        password: String!
    }
    
    type UpdatePasswordPayload {
        msg: String!
        status: Boolean!
    }

    input UpdateParentContactOptionInput {
        key: String!
        value: Int!
    }

    type UpdateParentContactOptionPayload {
        msg: String!
        status: Boolean!
    }

    type ParentContactOptions {
        accept_email: Int!
        accept_notification: Int!
    }

    type ParentGlobal {
        email: String
        phone: String
    }

    type ParentBySchool {
        school_name: String!
        parent: Parent!
    }
    

    type Parent {
        parent_id: Int!
        gender: String
        parent_name: String
        phone_m: String
        email: String 
    }

    type PassengersBySchool {
        school_name: String!
        passengers: [Passenger]
    }

    type Passenger {
        uniqueID: String
        passenger_id: Int!
        first_name: String!
        surname: String
        date_of_birth: String
        gender: String
        address: String
        phone_m: String!
        email: String!
        account: Int!
        RFID: String!
        routeToday: [PassengerRoute]
    }

    type PassengerRoute {
        j_id: Int!
        collection_address: PickUpRoute!
        destination_address: DropOffRoute!
        peroid: String!
        date_today: String!
        extra_address: [ExtraRoute]
        tracking: CurrentTracking
    }
    
    type PickUpRoute {
        time_start: String!
        address: String!
        progress: Int! 
        latlng: String!
        passenger_log: [PassengerLog]
    }

    type DropOffRoute {
        time_end: String!
        address: String!
        progress: Int!
        latlng: String!
        passenger_log: [PassengerLog]
    }

    type PassengerLog {
        log_type_code: Int!
        log_type_name: String!
        log_note: String!
        date_time_scan: String
        route_type: Int!
        address: MovementAddress
        movement_order: Int!
    }

    type ExtraRoute {
        movement_order: Int!
        latlng: String!
    }

    type MovementAddress {
        collection: String
        destination: String
    }

    type PassengerInRoute {
        passenger_id: Int!
        pickup: Int!
        passenger: Passenger
    }

    type RouteByQuote {
        movement_id: Int!
        collection: String!
        destination: String!
        pickup: [PassengerInRoute]!
        dropoff: [PassengerInRoute]!
    }

    type CurrentTracking {
        lat: String!
        lng: String!
        timestamp: Date!
        j_id: Int!
    }

    type SchoolContact {
        name: String!
        address: String!
        tracking_phone: String!
        tracking_email: String!
    }

    type PassengerExceptions {
        school_name: String!
        passengers: [PassengerForExc]
    }

    type PassengerForExc {
        passenger_id: Int!
        first_name: String!
        surname: String!
        exceptions: [Exception]
    }

    type Exception {
        event_id: Int!
        start_date: String!
        end_date: String!
        note: String
        passenger_id : Int
    }

    schema {
        query: Query
        mutation: Mutation
    }
`;

const schema = makeExecutableSchema({ typeDefs, resolvers });

export default schema;