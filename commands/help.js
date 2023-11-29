const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { footer } = require("../components/embed.js");
const config = require("../config.json");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("help")
        .setDescription("Help command")
        .setDMPermission(false),
    async execute(interaction) {
        const returnMessage = new EmbedBuilder()
            .setColor(0x0099ff)
            .setDescription(
                `Hi! I am Jackpot Bot create in **discord.js**\n\nLet me show you all available commands:`
            )
            .setAuthor({
                name: "Jackpot Bot (Click To invite)",
                iconURL: config.icon_url,
                url: config.icon_url,
            })
            .addFields(
                { name: "/balance", value: "Check your's balance" },
                { name: "/jackpot <bid:value>", value: "Play jackpot" },
                {
                    name: "/jackpot <info:game hash>",
                    value: "Get details about chosen game",
                    inline: true,
                },
                { name: "\u200B", value: "\u200B", inline: false },
                {
                    name: "How to earn money?",
                    value: "For now, the only way to earn is being active on public voice channel (1$ per minute), however every administrator have access to modify players balance.",
                }
            )
            .setThumbnail(`${config.icon_url}`)
            .setTimestamp()
            .setFooter(footer);

        return await interaction.reply({
            embeds: [returnMessage],
            ephemeral: true,
        });
    },
};
