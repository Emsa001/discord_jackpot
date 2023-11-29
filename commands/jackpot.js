const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    GatewayIntentBits,
} = require('discord.js');

const { UserActions, getAccount } = require('../classes/User');
const { JackpotGame } = require('../classes/Jackpot');
const { footer } = require('../components/embed.js');

const config = require('../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('jackpot')
        .setDescription('Play jackpot')
        .setDMPermission(false)
        .addNumberOption((option) =>
            option.setName('bid').setDescription('Place your bid').setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName('info')
                .setDescription("Check info about specific jackpot game by it's hash")
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        if (interaction.options.getNumber('bid')) {
            if (interaction.options.getNumber('bid') < 1) {
                return interaction.reply({
                    content: `Minimum value to join is **1 ${config.currency}**`,
                    ephemeral: true,
                });
            }

            const user = await new getAccount(
                interaction.user.id,
                interaction.guild.id
            ).checkAccount();

            // Checking balance
            if (user.balance < interaction.options.getNumber('bid')) {
                return interaction.editReply({
                    content: 'insufficient balance :(',
                    ephemeral: true,
                });
            }

            return await new JackpotGame(interaction).join();
        }

        if (interaction.options.getString('info')) {
            return await new JackpotGame(interaction).findGame(interaction);
        }

        const helpEmbed = new EmbedBuilder()
            .setColor('#0275d8')
            .setTitle('Help Message')
            .setAuthor({
                name: 'Jackpot Bot',
                iconURL: config.icon_url,
                url: config.icon_url,
            })
            .addFields(
                { name: '/balance', value: "Check your's balance" },
                { name: '/jackpot <bid:value>', value: 'Play jackpot' },
                {
                    name: '/jackpot <info:game hash>',
                    value: 'Get details about chosen game',
                    inline: true,
                }
            )
            .setTimestamp()
            .setFooter(footer);

        return interaction.editReply({ embeds: [helpEmbed], ephemeral: true });
    },
};
