const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');

// ---- CONFIG ----
const TOKEN = process.env.DISCORD_TOKEN;     // your bot token
const CLIENT_ID = process.env.DISCORD_CLIENT_ID; // your bot's application/client ID
// ----------------

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

const commands = [
  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Deletes all messages in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
].map((c) => c.toJSON());

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log('Slash commands registered.');
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'clear') return;

  // Extra safety: require Manage Messages permission
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
    return interaction.reply({
      content: "You don't have permission to do that.",
      ephemeral: true,
    });
  }

  await interaction.reply({ content: 'Clearing channel...', ephemeral: true });

  const channel = interaction.channel;
  let totalDeleted = 0;

  try {
    while (true) {
      // bulkDelete only works on messages < 14 days old, and max 100 at a time
      const messages = await channel.messages.fetch({ limit: 100 });
      if (messages.size === 0) break;

      const deletable = messages.filter(
        (m) => Date.now() - m.createdTimestamp < 14 * 24 * 60 * 60 * 1000
      );

      if (deletable.size === 0) {
        // Remaining messages are too old for bulkDelete; delete one by one
        for (const msg of messages.values()) {
          try {
            await msg.delete();
            totalDeleted++;
          } catch (e) {
            // ignore individual failures
          }
        }
        continue;
      }

      const deleted = await channel.bulkDelete(deletable, true);
      totalDeleted += deleted.size;

      if (messages.size < 100) break; // no more pages
    }

    await interaction.followUp({
      content: `Done. Deleted ${totalDeleted} messages.`,
      ephemeral: true,
    });
  } catch (err) {
    console.error(err);
    await interaction.followUp({
      content: `Stopped due to an error: ${err.message}`,
      ephemeral: true,
    });
  }
});

registerCommands().then(() => client.login(TOKEN));
