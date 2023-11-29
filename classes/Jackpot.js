const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
const { getAccount } = require("./User");
const fs = require("fs");

const Probability = require("probability-node");
const crypto = require("crypto");

const jackpotDB = require("../database/jackpot");
const jackpotUsers = require("../database/jackpot_users");

const { createCanvas, loadImage, registerFont } = require("canvas");
registerFont("./fonts/Sans.ttf", { family: "Sans" });
registerFont("./fonts/Lato.ttf", { family: "Lato" });
const canvas = createCanvas(600, 300);
const ctx = canvas.getContext("2d");

const { footer } = require("../components/embed.js");
const config = require("../config.json");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

var startedGames = [];

class JackpotGame {
    constructor(interaction) {
        this.interaction = interaction;
        this.user = new getAccount(
            interaction.user.id,
            interaction.guild.id
        ).checkAccount();
    }

    //Find Game
    async findGame() {
        const hash = this.interaction.options.getString("info");

        var game = await jackpotDB.findOne({
            where: { hash: hash, guild_id: this.interaction.guild.id },
        });

        var messageEmbed;

        if (!game) {
            messageEmbed = new EmbedBuilder()
                .setColor("#d9534f")
                .setTitle("Game not found ❌")
                .setDescription(
                    `There is no game with given hash:\n**${hash}**`
                )
                .setThumbnail(
                    "https://cdn-icons-png.flaticon.com/512/6134/6134065.png"
                )
                .setTimestamp()
                .setFooter(footer);
        } else {
            const winner = this.interaction.client.users.cache.find(
                (user) => user.id === `${game.winner}`
            );

            var allUsers = await jackpotUsers.findAll({
                where: {
                    guild_id: this.interaction.guild.id,
                    jackpot_hash: hash,
                },
            });

            var usersPercentage = "";

            allUsers.forEach((item, index) => {
                var probability = ((item.bid / game.pool) * 100).toFixed(2);
                if (item.user_id == game.winner) {
                    usersPercentage += `${index + 1}. **<@${item.user_id}> : ${
                        item.bid
                    } ${config.currency} (${probability}%) - 👑 WINNER 👑**\n`;
                } else {
                    usersPercentage += `${index + 1}. <@${item.user_id}> : ${
                        item.bid
                    } ${config.currency} (${probability}%)\n`;
                }
            });

            const padL = (nr, len = 2, chr = `0`) => `${nr}`.padStart(2, chr);
            const date = `${padL(game.createdAt.getMonth() + 1)}/${padL(
                game.createdAt.getDate()
            )}/${game.createdAt.getFullYear()} ${padL(
                game.createdAt.getHours()
            )}:${padL(game.createdAt.getMinutes())}:${padL(
                game.createdAt.getSeconds()
            )}`;

            messageEmbed = new EmbedBuilder()
                .setColor("#5bc0de")
                .setTitle("Your game info 🔎")
                .setThumbnail(
                    `https://cdn.discordapp.com/avatars/${game.winner || ""}/${
                        winner?.avatar || ""
                    }.png`
                )
                .addFields(
                    {
                        name: "Pool",
                        value: `${game.pool} ${config.currency}`,
                        inline: true,
                    },
                    {
                        name: "Date:",
                        value: `${date}`,
                        inline: true,
                    },

                    {
                        name: "All Users:",
                        value: usersPercentage || "NONE",
                        inline: false,
                    },
                    { name: "\u200B", value: "\u200B" },
                    { name: "hash:", value: hash, inline: false }
                )
                .setTimestamp()
                .setFooter(footer);
        }

        return this.interaction.editReply({
            embeds: [messageEmbed],
            ephemeral: true,
        });
    }

    //Creating game
    async createGame() {
        var jackpot = await jackpotDB.findOne({
            where: {
                guild_id: this.interaction.guild.id,
                closed: false,
            },
        });

        if (!jackpot) {
            var hash = crypto.randomBytes(20).toString("hex");
            jackpot = await jackpotDB.create({
                guild_id: this.interaction.guild.id,
                hash: hash,
            });
            startedGames.push(jackpot.hash);

            var i = 0;
            setTimeout(() => {
                var myTimer = setInterval(async () => {
                    await new JackpotGame(this.interaction).updateMessage(
                        "update",
                        hash,
                        i
                    );
                    i++;
                    if (i >= 60) {
                        clearInterval(myTimer);
                    }
                }, 1000);

                wait(63 * 1000).then(async () => {
                    await new JackpotGame(this.interaction).startGame(jackpot);
                });
            }, 1000);
        }

        if (!startedGames.includes(jackpot.hash)) {
            startedGames.push(jackpot.hash);
            wait(63 * 1000).then(async () => {
                await new JackpotGame(this.interaction).startGame(jackpot);
            });
        }

        return await jackpot;
    }
    async startGame(jackpot) {
        var allUsers = await jackpotUsers.findAll({
            where: {
                guild_id: this.interaction.guild.id,
                jackpot_hash: jackpot.hash,
            },
        });

        // Too few players to start
        if (allUsers.length <= 1) {
            await jackpot.update({ closed: true }).then(async () => {
                await new JackpotGame(this.interaction).updateMessage(
                    "cancel",
                    jackpot.hash
                );
            });

            // Give money back
            allUsers.forEach(async (user) => {
                let db_user = await new getAccount(
                    user.user_id,
                    this.interaction.guild.id
                ).checkAccount();

                await db_user.increment("balance", {
                    by: user.bid,
                });
            });

            setTimeout(async () => {
                await jackpot.destroy({
                    where: { hash: jackpot.hash },
                });
            }, 60000);

            return false;
        }

        return await new JackpotGame(this.interaction).chooseWinner();
    }
    // choosing a winner
    async chooseWinner() {
        var jackpot = await jackpotDB.findOne({
            where: {
                guild_id: this.interaction.guild.id,
                closed: false,
            },
        });

        var allUsers = await jackpotUsers.findAll({
            where: {
                guild_id: this.interaction.guild.id,
                jackpot_hash: jackpot.hash,
            },
        });

        var usersProbability = [];
        var winner = [];
        var description = "";

        var maxPercent = 100;
        allUsers.forEach((item) => {
            var probability = ((item.bid / jackpot.pool) * 100).toFixed(2);
            if (probability > maxPercent) {
                probability = maxPercent;
            }
            maxPercent -= probability;
            usersProbability.push({
                p: `${probability}%`,
                f: function () {
                    winner.push(item);
                },
            });

            description += `<@${item.user_id}> : ${item.bid} ${
                config.currency
            } (${parseFloat(probability).toFixed(2)}%)\n`;
        });

        // Choosing the winner by percentage
        var probabilitilized = new Probability(usersProbability);
        probabilitilized();

        // Getting account of winner
        let db_winner = await new getAccount(
            winner[0].user_id,
            this.interaction.guild.id
        ).checkAccount();

        // Adding to balance
        await db_winner.increment("balance", {
            by: jackpot.pool,
        });

        setTimeout(async () => {
            await new JackpotGame(this.interaction).updateMessage(
                "finish",
                jackpot.hash,
                winner
            );
        }, 500);
        await jackpot.update({ closed: true, winner: winner[0].user_id });

        setTimeout(() => {
            try {
                fs.unlinkSync(`./images/winner_${jackpot.hash}.png`);
            } catch (err) {
                console.error(err);
            }
        }, 60000);
    }
    async findUser() {
        const jackpot = await new JackpotGame(this.interaction).createGame();

        var user = await jackpotUsers.findOne({
            where: {
                user_id: this.interaction.user.id,
                guild_id: this.interaction.guild.id,
                jackpot_hash: jackpot.hash,
            },
        });

        if (!user) {
            user = await jackpotUsers.create({
                guild_id: this.interaction.guild.id,
                user_id: this.interaction.user.id,
                jackpot_id: jackpot.configId,
                jackpot_hash: jackpot.hash,
            });
        }

        return await user;
    }

    async join() {
        var jackpot = await new JackpotGame(this.interaction).createGame();

        var createdAt = new Date(jackpot.createdAt);
        var dateNow = Date.now();

        if (dateNow - createdAt > 50000) {
            return this.interaction.editReply({
                content: `❌ You can't bid now, wait for another game to start.`,
                ephemeral: true,
            });
        }

        const bidValue = this.interaction.options.getNumber("bid").toFixed(2);
        const user = await Promise.resolve(this.user);

        // Decreacing money by bid
        await user.decrement("balance", {
            by: bidValue,
        });

        // Increacing bidValue
        var jackpot_user = await new JackpotGame(this.interaction).findUser();
        jackpot_user = await jackpot_user.increment("bid", {
            by: bidValue,
        });

        // Increacing pool
        await jackpot.increment("pool", { by: bidValue });

        //Returning message update
        this.interaction.editReply({
            content: `✅ Successfully bidded ${bidValue} ${config.currency}`,
            ephemeral: true,
        });

        setTimeout(async () => {
            //return await new JackpotGame(this.interaction).updateMessage('update', jackpot.hash);
        }, 1000);
    }
    async info() {
        var jackpot = await new JackpotGame(this.interaction).createGame();

        var allUsers = await jackpotUsers.findAll({
            where: {
                guild_id: this.interaction.guild.id,
                jackpot_hash: jackpot.hash,
            },
        });

        let description = "";
        allUsers.forEach((user) => {
            description += `<@${user.user_id}> : ${user.bid} ${
                config.currency
            } (${(user.bid / jackpot.pool).toFixed(2) * 100}%)\n`;
        });

        const responseMessage = new EmbedBuilder()
            .setColor(0x0099ff)
            .setAuthor({
                name: `Pool: ${jackpot.pool} ${config.currency}`,
                iconURL: `https://cdn-icons-png.flaticon.com/512/536/536050.png`,
                url: `https://jackpot-api.com/${jackpot.hash}/`,
            })
            .setThumbnail(
                this.interaction.user.displayAvatarURL({
                    extension: "png",
                })
            )
            .setDescription(description)
            .setTimestamp()
            .setFooter({
                text: `hash: ${jackpot.hash}`,
                iconURL: config.icon_url,
            });

        return await this.interaction.editReply({ embeds: [responseMessage] });
    }
    async updateMessage(action, hash, winner) {
        var jackpot = await jackpotDB.findOne({
            where: {
                hash: hash,
            },
        });

        var allUsers = await jackpotUsers.findAll({
            where: {
                guild_id: this.interaction.guild.id,
                jackpot_hash: hash,
            },
        });

        var messageData;

        switch (action) {
            case "update":
                var description = "";
                allUsers.forEach((item) => {
                    var probability = ((item.bid / jackpot.pool) * 100).toFixed(
                        2
                    );
                    description += `<@${item.user_id}> : ${item.bid} ${config.currency} (${probability}%)\n`;
                });

                var i = winner;
                if (!i) {
                    try {
                        await this.interaction.client.channels.cache
                            .get(jackpot?.channel_id)
                            .messages.fetch(jackpot?.message_id)
                            .then((message) => {
                                i =
                                    parseInt(
                                        message?.embeds[0]?.data?.title
                                            .replace(
                                                "💰 Jackpot results in ",
                                                ""
                                            )
                                            .replace("s 💰", "")
                                    ) || 60;
                            })
                            .catch((err) => {
                                i = 0;
                            });
                    } catch (err) {
                        console.log(
                            `Creating a new jackpot Message for ${jackpot.guild_id}`
                        );
                    }
                }

                const loading_emoji = this.interaction.client.emojis.cache.get(
                    "1043302551413596210"
                );

                var responseMessage = new EmbedBuilder()
                    .setColor(0x0099ff)
                    .setAuthor({
                        name: `Pool: ${jackpot.pool} ${config.currency} - ${
                            60 - i < 10 ? "Bids closed 🛑" : "Bids open ✅"
                        }`,
                        iconURL: config.icon_url,
                        url: `https://jackpot-api.com/${jackpot.hash}/`,
                    })
                    .setTitle(`💰 Jackpot results in ${60 - i}s 💰`)
                    .addFields(
                        { name: "\u200B", value: "\u200B", inline: false },
                        {
                            name: "Users:",
                            value: `${description ?? "None"}`,
                            inline: true,
                        },
                        {
                            name: "Winner",
                            value: `${loading_emoji}`,
                            inline: true,
                        }
                    )
                    .setTimestamp()
                    .setFooter({
                        text: `hash: ${jackpot.hash}`,
                        iconURL: config.icon_url,
                    });

                messageData = { embeds: [responseMessage] };
                break;
            case "finish":
                // Getting discord account of winner
                var winner_dc = this.interaction.client.users.cache.find(
                    (user) => user.id === `${winner[0].user_id}`
                );

                // Getting winner's avatar
                var avatar = `https://cdn.discordapp.com/avatars/${
                    winner_dc?.id || ""
                }/${winner_dc?.avatar || ""}.png`;
                var userAvatar = await loadImage(avatar);

                // IMAGE
                const background = await loadImage(`./assets/background.png`);
                ctx.drawImage(background, 0, 0, 600, 300);

                ctx.drawImage(userAvatar, 197, 50, 200, 200);

                ctx.beginPath();
                ctx.rect(105, 230, 390, 60);

                ctx.fillStyle = "#a9630a";
                ctx.fill();

                ctx.strokeStyle = "#4e2700";
                ctx.stroke();

                ctx.font = `30px Sans`;
                ctx.fillStyle = "#fff";
                ctx.textAlign = "center";
                ctx.fillText(`${jackpot.pool} ${config.currency}`, 300, 270);

                const image = await loadImage("./assets/crown.png");
                ctx.drawImage(image, 235, 10, 125, 75);

                const buffer = canvas.toBuffer("image/png");
                fs.writeFileSync(`./images/winner_${jackpot.hash}.png`, buffer);

                const attachment = new AttachmentBuilder(
                    `./images/winner_${jackpot.hash}.png`
                );

                var description = "";
                allUsers.forEach((item) => {
                    var probability = ((item.bid / jackpot.pool) * 100).toFixed(
                        2
                    );
                    description += `<@${item.user_id}> : ${item.bid} ${config.currency} (${probability}%)\n`;
                });

                const returnMessage = new EmbedBuilder()
                    .setColor(0x0099ff)
                    .setAuthor({
                        name: `Pool: ${jackpot.pool} ${config.currency}`,
                        iconURL: config.icon_url,
                        url: `https://jackpot-api.com/${jackpot.hash}/`,
                    })
                    .setTitle(`💰 Jackpot results 💰`)
                    .setImage(`attachment://winner_${jackpot.hash}.png`)
                    .addFields(
                        { name: "\u200B", value: "\u200B", inline: false },
                        {
                            name: "All Users:",
                            value: `${description ?? "None"}`,
                            inline: true,
                        },
                        {
                            name: "Winner",
                            value: `<@${winner[0].user_id}>`,
                            inline: true,
                        }
                    )
                    .setTimestamp()
                    .setFooter({
                        text: `hash: ${jackpot.hash}`,
                        iconURL: config.icon_url,
                    });

                messageData = {
                    embeds: [returnMessage],
                    files: [attachment],
                };

                break;
            case "cancel":
                var responseMessage = new EmbedBuilder()
                    .setColor(" #d9534f ")
                    .setTitle(`Jackpot #${jackpot.configId} - CANCELED`)
                    .setAuthor({
                        name: `Pool: ${jackpot.pool} ${config.currency}`,
                        iconURL: config.icon_url,
                        url: `https://jackpot-api.com/${jackpot.hash}/`,
                    })
                    .setDescription("Not Enough players to start the game")
                    .setTimestamp()
                    .setFooter({
                        text: `hash: ${jackpot.hash}`,
                        iconURL: config.icon_url,
                    });

                messageData = { embeds: [responseMessage] };
                break;
        }

        if (!jackpot.message_id) {
            try {
                return this.interaction.channel
                    .send(messageData)
                    .then(async (message) => {
                        await jackpot.update({
                            message_id: message.id,
                            channel_id: message.channelId,
                        });
                    });
            } catch (err) {
                console.error(err);
            }
        }

        try {
            return this.interaction.client.channels.cache
                .get(jackpot?.channel_id)
                .messages.fetch(jackpot.message_id)
                .then((msg) => {
                    msg.edit(messageData);
                    if (action == "cancel") {
                        setTimeout(() => {
                            try {
                                msg.delete();
                            } catch (err) {
                                console.error(err);
                            }
                        }, 3000);
                    }
                });
        } catch (err) {
            console.error(err);
        }
    }
}

module.exports = { JackpotGame };
