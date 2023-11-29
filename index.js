const dotenv = require("dotenv");
dotenv.config();

const fs = require("node:fs");
const path = require("node:path");
const { Client, Events, Collection, GatewayIntentBits } = require("discord.js");
const { loadCommands } = require("./deploy-commands");

// Database
const db = require("./database/database");
const usersDB = require("./database/users");
const jackpotDB = require("./database/jackpot");
const jackpot_users = require("./database/jackpot_users");

const { getAccount } = require("./classes/User");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
    ],
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    // Set a new item in the Collection with the key as the command name and the value as the exported module
    if ("data" in command && "execute" in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.log(
            `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
        );
    }
}

client.once(Events.ClientReady, async (c) => {
    await loadCommands();
    await db
        .authenticate()
        .then(() => {
            console.log("Logged in to DB!");
            usersDB.init(db);
            usersDB.sync();

            jackpotDB.init(db);
            jackpotDB.sync();

            jackpot_users.init(db);
            jackpot_users.sync();
        })
        .catch((err) => console.log(err));

    console.log(
        `Ready! Logged in as ${c.user.tag} In ${client.guilds.cache.size} guilds.`
    );
    client.user.setPresence({ activities: [{ name: "UPDATE v1.02 /help" }] });
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
        console.error(
            `No command matching ${interaction.commandName} was found.`
        );
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await interaction.reply({
            content: "There was an error while executing this command!",
            ephemeral: true,
        });
    }
});

client.on("guildCreate", (guild) => {
    // Log the guild name to the console
    console.log(
        `Total guilds: ${client.guilds.cache.size} ||| Added to guild: ${guild.name}`
    );

    const date = new Date();
    const dateString =
        date.toLocaleTimeString("en-US", { hour12: false }) +
        " " +
        date.toLocaleDateString();

    fs.appendFile(
        "logs.txt",
        `[ ${dateString} ] + Added to guild: ${guild.name}\n`,
        (err) => {
            if (err) throw err;
        }
    );
});

client.on("guildDelete", (guild) => {
    // Log a message to the console
    console.log(
        `Kicked from guild: ${guild.name} ||| Total guilds: ${client.guilds.cache.size}`
    );

    const date = new Date();
    const dateString =
        date.toLocaleTimeString("en-US", { hour12: false }) +
        " " +
        date.toLocaleDateString();
    fs.appendFile(
        "logs.txt",
        `[ ${dateString} ] - Kicked from guild: ${guild.name}`,
        (err) => {
            if (err) throw err;
        }
    );
});

client.on("error", console.error);

setInterval(() => {
    client.guilds.cache.forEach((guild) => {
        guild.voiceStates.cache.forEach(async (voiceState) => {
            if (voiceState.channel) {
                await new getAccount(voiceState.member.id, guild.id).addBalance(
                    1
                );
            }
        });
    });
}, 60 * 1000);

process.on("uncaughtException", (err, origin) => {
    console.log(err);
});

client.login(process.env.TOKEN);
