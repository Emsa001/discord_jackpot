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
                closed: { type: DataTypes.BOOLEAN, defaultValue: false },
                pool: { type: DataTypes.FLOAT, defaultValue: 0 },
                winner: { type: DataTypes.STRING },
                hash: { type: DataTypes.STRING },
                channel_id: { type: DataTypes.STRING },
                message_id: { type: DataTypes.STRING },
            },
            {
                tableName: 'jackpot',
                timestamps: true,
                sequelize,
            }
        );
    }
};
