/* jshint indent: 2 */

module.exports = function(sequelize, DataTypes) {
  return sequelize.define('tb_passenger_cancel_journey', {
    cancel_id: {
      type: DataTypes.INTEGER(11),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    quote_id: {
      type: DataTypes.INTEGER(11),
      allowNull: false
    },
    pickup: {
      type: DataTypes.INTEGER(11),
      allowNull: false
    },
    dropoff: {
      type: DataTypes.INTEGER(11),
      allowNull: false
    },
    j_id: {
      type: DataTypes.INTEGER(11),
      allowNull: false
    },
    passenger_id: {
      type: DataTypes.INTEGER(11),
      allowNull: false
    },
    datetime_cancel: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: sequelize.literal('CURRENT_TIMESTAMP')
    },
    driver_id: {
      type: DataTypes.INTEGER(11),
      allowNull: true
    },
    status_approve: {
      type: DataTypes.INTEGER(1),
      allowNull: true,
      defaultValue: '0'
    }
  }, {
    tableName: 'tb_passenger_cancel_journey',
    timestamps: false
  });
};
