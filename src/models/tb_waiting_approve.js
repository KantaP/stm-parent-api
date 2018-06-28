/* jshint indent: 2 */

module.exports = function(sequelize, DataTypes) {
  return sequelize.define('tb_waiting_approve', {
    approve_id: {
      type: DataTypes.INTEGER(11),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    refer_id: {
      type: DataTypes.INTEGER(11),
      allowNull: false
    },
    user_approve: {
      type: DataTypes.INTEGER(11),
      allowNull: false
    },
    subject: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    message: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    status_read: {
      type: DataTypes.INTEGER(11),
      allowNull: false
    },
    status_approve: {
      type: DataTypes.INTEGER(11),
      allowNull: false
    },
    date_approve: {
      type: DataTypes.DATE,
      allowNull: true
    },
    sent_date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: sequelize.literal('CURRENT_TIMESTAMP')
    },
    type_code: {
      type: DataTypes.INTEGER(11),
      allowNull: false
    },
    sent_from: {
      type: DataTypes.INTEGER(11),
      allowNull: false
    },
    action_data: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'tb_waiting_approve',
    timestamps: false
  });
};
