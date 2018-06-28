/* jshint indent: 2 */
import { DataTypes } from 'sequelize'
import moment from 'moment'

module.exports = function(sequelize, DataTypes) {
    return sequelize.define('tb_journey', {
        j_id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
            primaryKey: true,
            autoIncrement: true
        },
        quote_id: {
            type: DataTypes.INTEGER(11),
            allowNull: false
        },
        date_out: {
            type: DataTypes.DATE,
            allowNull: false,
            // get: function() {
            //     console.log('dateout' , this.getDataValue('date_out'))
            // },
            // set: function() {

            // }
        },
        date_back: {
            type: DataTypes.DATE,
            allowNull: false,
            // get: function() {
            //     console.log('dateback' )
            //     // return moment( this.getDataValue('date_back') , 'YYYY-MM-DD HH:mm:ss').format('YYYY-MM-DD HH:mm:ss');
            // }
        },
        is_return: {
            type: DataTypes.INTEGER(1),
            allowNull: false
        },
        j_price: {
            type: DataTypes.DECIMAL,
            allowNull: false
        },
        vehicle_stay: {
            type: DataTypes.INTEGER(4),
            allowNull: false
        },
        j_order: {
            type: DataTypes.INTEGER(4),
            allowNull: false
        },
        col_address: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        des_address: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        col_latlng: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        des_latlng: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        date_departure: {
            type: DataTypes.DATE,
            allowNull: false
        },
        date_end: {
            type: DataTypes.DATE,
            allowNull: false
        },
        progress: {
            type: DataTypes.INTEGER(6),
            allowNull: false
        }
    }, {
        tableName: 'tb_journey',
        timestamps: false
    });
};