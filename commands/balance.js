const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { UserActions } = require('../classes/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription("Check your's balance 💵")
        .addUserOption((option) =>
            option.setName('user').setDescription('Select User').setRequired(false)
        )
        .addNumberOption((option) =>
            option.setName('add').setDescription("Add to user's balance").setRequired(false)
        )
        .addNumberOption((option) =>
            option
                .setName('remove')
                .setDescription("Remove from users's balance")
                .setRequired(false)
        )
        .addNumberOption((option) =>
            option.setName('set').setDescription("Set users's balance").setRequired(false)
        )
        .setDMPermission(false),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const target = interaction.options.getUser('user');

        if (!target) {
            return await new UserActions(interaction).getBalance();
        }

        if (!interaction.memberPermissions.has([PermissionsBitField.Flags.Administrator])) {
            return await new UserActions(interaction).notEnoughPermissions();
        }
        return await new UserActions(interaction).editBalance();
    },
};
