const { EmbedBuilder } = require('discord.js');
const { request } = require('undici');

const { createCanvas, loadImage, registerFont } = require('canvas');
registerFont('./fonts/Sans.ttf', { family: 'Sans' });
registerFont('./fonts/Lato.ttf', { family: 'Lato' });
const canvas = createCanvas(280, 187);
const ctx = canvas.getContext('2d');

const config = require('../config.json');

const usersDB = require('../database/users');

class getAccount {
    constructor(user_id, guild_id) {
        this.user_id = user_id;
        this.guild_id = guild_id;
    }
    async checkAccount() {
        var user = await usersDB.findOne({
            where: {
                user_id: this.user_id,
                guild_id: this.guild_id,
            },
        });

        if (!user) {
            user = await usersDB.create({
                guild_id: this.guild_id,
                user_id: this.user_id,
                balance: 100,
            });
        }

        return await user;
    }
    async addBalance(value) {
        var user = await new getAccount(this.user_id, this.guild_id).checkAccount();
        await user.increment('balance', {
            by: value,
        });

        user.save();
        return await user;
    }
}

class UserActions {
    constructor(interaction) {
        this.interaction = interaction;
        this.user = new getAccount(interaction.user.id, interaction.guild.id).checkAccount();
    }
    async getBalance() {
        var user = await Promise.resolve(this.user);

        const cardImage = await loadImage('./assets/card.png');

        const avatar = await loadImage(
            this.interaction.user.displayAvatarURL({
                extension: 'png',
            })
        );

        ctx.drawImage(cardImage, 0, 0, canvas.width, canvas.height);
        ctx.drawImage(avatar, 176, 86, 80, 80);

        ctx.font = '20px "Lato"';
        ctx.fillStyle = '#fff';
        ctx.fillText(`${this.interaction.user.username}`, 10, 60);

        ctx.font = '10px "Lato"';
        ctx.fillStyle = '#000';
        ctx.fillText(`${this.interaction.user.id}`, 27, 161);

        ctx.font = '30px "Lato"';
        ctx.fillStyle = '#fff';
        var distance = ctx.measureText(`${user.balance}`);

        if (distance.width > 180) {
            ctx.font = '15px "Lato"';
        } else if (distance.width > 130) {
            ctx.font = '20px "Lato"';
        } else if (distance.width > 110) {
            ctx.font = '25px "Lato"';
        }

        ctx.fillText(`${user.balance}`, 20, 130);
        var distance2 = ctx.measureText(`${user.balance}`);

        var margin = 23;
        ctx.font = '15px "Lato"';
        if (distance.width > 180) {
            ctx.font = '11px "Lato"';
        } else if (distance.width > 130) {
            ctx.font = '13px "Lato"';
        } else if (distance.width > 110) {
            ctx.font = '15px "Lato"';
        }

        ctx.fillText(`${config.currency}`, distance2.width + margin, 130);

        const attachment = canvas.toBuffer();

        return await this.interaction.editReply({
            ephemeral: true,
            files: [{ attachment: attachment }],
        });
    }
    async editBalance() {
        const user = await Promise.resolve(this.user);
        const target = this.interaction.options.getUser('user');
        const value =
            this.interaction.options.getNumber('add') ??
            -1 * this.interaction.options.getNumber('remove') ??
            0;

        const setValue = this.interaction.options.getNumber('set');

        let targetAccount = await new getAccount(
            target.id,
            this.interaction.guild.id
        ).checkAccount();
        if (setValue) {
            console.log(setValue);
            await targetAccount.update({
                balance: setValue,
            });
        } else {
            await targetAccount.increment('balance', {
                by: value,
            });
        }

        targetAccount = await new getAccount(target.id, this.interaction.guild.id).checkAccount();

        const returnMessage = new EmbedBuilder()
            .setColor(0x0099ff)
            .setDescription(
                `New ${target}'s balance: **${targetAccount.balance} ${config.currency}**`
            )
            .setAuthor({
                name: `Executed by ${this.interaction.user.username}`,
                iconURL: `${this.interaction.user.displayAvatarURL({
                    extension: 'png',
                })}`,
                url: `${this.interaction.user.displayAvatarURL({
                    extension: 'png',
                })}`,
            })
            .setThumbnail(
                `${target.displayAvatarURL({
                    extension: 'png',
                })}`
            )
            .setTimestamp();

        return await this.interaction.editReply({
            ephemeral: true,
            embeds: [returnMessage],
        });
    }
    async notEnoughPermissions() {
        const returnMessage = new EmbedBuilder()
            .setColor('#ff6961')
            .setTitle('❌ Not enough permissions')
            .setAuthor({
                name: `Executed by ${this.interaction.user.username}`,
                iconURL: `${this.interaction.user.displayAvatarURL({
                    extension: 'png',
                })}`,
                url: `${this.interaction.user.displayAvatarURL({
                    extension: 'png',
                })}`,
            })
            .setTimestamp();

        return await this.interaction.editReply({
            ephemeral: true,
            embeds: [returnMessage],
        });
    }
}

module.exports = { UserActions, getAccount };
