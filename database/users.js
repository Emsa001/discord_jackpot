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
                balance: { type: DataTypes.FLOAT, defaultValue: 0 },
                games: { type: DataTypes.INTEGER, defaultValue: 0 },
                wins: { type: DataTypes.INTEGER, defaultValue: 0 },
                profit: { type: DataTypes.FLOAT, defaultValue: 0 },
                biggest_win: { type: DataTypes.FLOAT, defaultValue: 0 },
            },
            {
                tableName: 'users',
                timestamps: true,
                sequelize,
            }
        );
    }
};
