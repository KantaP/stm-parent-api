import moment from 'moment'
import { DataTypes } from 'sequelize'
import util from 'sequelize/lib/util'
function DATETIMETYPE(length) {
    const options = typeof length === 'object' && length || {length} 
    if (!(this instanceof DATETIMETYPE)) return new DATETIMETYPE(options) 
    DataTypes.DATE.call(this, options);
}
util.inherits(DATETIMETYPE, DataTypes.DATE) 

DATETIMETYPE.prototype.key = DATETIMETYPE.key = 'DATETIME' 
DATETIMETYPE.prototype.toSql = function toSql() {
    return 'DATETIME' 
} 

DataTypes.DATETIME = DATETIMETYPE

export { DataTypes }