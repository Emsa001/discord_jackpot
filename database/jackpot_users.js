const { DataTypes, Model } = require('sequelize');

module.exports = class config extends Model {
    static init(sequelize) {
        return super.init(
            {
                configId: {
                    type: DataTypes.INTEGER,
                    autoIncrement: true,
                    primaryKey: true,
                },
                guild_id: { type: DataTypes.STRING },
                user_id: { type: DataTypes.STRING },
                bid: { type: DataTypes.FLOAT, defaultValue: 0 },
                jackpot_id: { type: DataTypes.STRING },
                jackpot_hash: { type: DataTypes.STRING },
            },
            {
                tableName: 'jackpot_users',
                timestamps: true,
                sequelize,
            }
        );
    }
};
