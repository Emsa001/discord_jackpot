const { EmbedBuilder, Attachment } = require('discord.js');
const GIFEncoder = require('gifencoder');
const fs = require('fs');
const { AttachmentBuilder } = require('discord.js');

const { JackpotGame } = require('./Jackpot');
const { getAccount } = require('./User');

const jackpotDB = require('../database/jackpot');
const jackpotUsers = require('../database/jackpot_users');

const width = 600;
const height = 300;

const { createCanvas, loadImage, registerFont } = require('canvas');
registerFont('./fonts/Sans.ttf', { family: 'Sans' });
registerFont('./fonts/Lato.ttf', { family: 'Lato' });
const canvas = createCanvas(width, height);
const ctx = canvas.getContext('2d');

class Gif {
    constructor(interaction) {
        this.interaction = interaction;
    }
    async jackpot(db_winner) {
        var jackpot = await jackpotDB.findOne({
            where: {
                guild_id: this.interaction.guild.id,
                closed: false,
            },
        });

        const encoder = new GIFEncoder(width, height);
        encoder.createReadStream().pipe(fs.createWriteStream(`./gifs/gif${jackpot.hash}.gif`));
        encoder.start();
        encoder.setDelay(1);

        var allUsers = await jackpotUsers.findAll({
            where: {
                guild_id: this.interaction.guild.id,
                jackpot_hash: jackpot.hash,
            },
        });

        var availableUsers = [];
        allUsers.forEach((the_user) => {
            var guild_user = this.interaction.client.users.cache.find(
                (user) => user.id === the_user.user_id
            );
            availableUsers.push({
                id: the_user.user_id,
                username: guild_user.username,
                avatar: `https://cdn.discordapp.com/avatars/${the_user.user_id}/${guild_user.avatar}.png`,
            });
        });

        for (var i = 0; i < 20; i++) {
            const background = await loadImage(`./assets/background.png`);
            ctx.drawImage(background, 0, 0, 600, 300);

            var user = availableUsers[Math.floor(Math.random() * availableUsers.length)];

            var userAvatar = await loadImage(user.avatar);

            ctx.drawImage(userAvatar, 197, 50, 200, 200);

            ctx.beginPath();
            ctx.rect(105, 230, 390, 60);

            ctx.fillStyle = '#a9630a';
            ctx.fill();

            ctx.strokeStyle = '#4e2700';
            ctx.stroke();

            ctx.font = `30px Sans`;
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.fillText(`${user.username}`, 300, 270);

            if (i == 49) {
                for (var x = 0; x < 30; x++) {
                    var winner = this.interaction.client.users.cache.find(
                        (user) => user.id === db_winner.user_id
                    );
                    var avatar = `https://cdn.discordapp.com/avatars/${winner.id}/${winner.avatar}.png`;

                    userAvatar = await loadImage(avatar);

                    ctx.globalAlpha = 1;
                    const background = await loadImage(`./assets/background.png`);
                    ctx.drawImage(background, 0, 0, 600, 300);

                    ctx.drawImage(userAvatar, 197, 50, 200, 200);

                    ctx.beginPath();
                    ctx.rect(105, 230, 390, 60);

                    ctx.fillStyle = '#a9630a';
                    ctx.fill();

                    ctx.strokeStyle = '#4e2700';
                    ctx.stroke();

                    ctx.font = `30px Sans`;
                    ctx.fillStyle = '#fff';
                    ctx.textAlign = 'center';
                    ctx.fillText(`${winner.username}`, 300, 270);

                    const image = await loadImage('./assets/crown.png');
                    ctx.drawImage(image, 235, 10, 125, 75);

                    encoder.addFrame(ctx);

                    ctx.font = `130px Sans`;

                    ctx.globalAlpha = 0.7;

                    ctx.beginPath();
                    ctx.roundRect(40, 90, 530, 130, 10);
                    ctx.fillStyle = '#a9630a';
                    ctx.fill();

                    ctx.globalAlpha = 1;
                    ctx.fillStyle = 'gold';
                    ctx.textAlign = 'center';
                    ctx.fillText(`WINNER`, 300, 205);

                    encoder.addFrame(ctx);
                    encoder.addFrame(ctx);
                    encoder.addFrame(ctx);
                }
            }

            encoder.addFrame(ctx);
        }
        setTimeout(async () => {
            encoder.finish();

            const returnMessage = new EmbedBuilder()
                .setColor(0x0099ff)
                .setTitle(`${winner.username} won ${jackpot.pool}`);

            return this.interaction.channel.send({
                embeds: [returnMessage],
                files: [{ attachment: `./gifs/gif${jackpot.hash}.gif` }],
            });
        }, 1000);
    }
}

module.exports = { Gif };
