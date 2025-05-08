const { Client, GatewayIntentBits, Partials } = require('discord.js');
const express = require('express');
const bodyParser = require('body-parser');

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const PORT = 3000;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildScheduledEvents,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Channel]
});

const app = express();
app.use(bodyParser.json());

// 🔔 Webhookエンドポイント（セッション確定時にPOST）
app.post('/finalize-session', async (req, res) => {
  const { guildId, title, date, sessionId } = req.body;

  try {
    const guild = await client.guilds.fetch(guildId);
    const category = await guild.channels.create({
      name: `📅 ${title}`,
      type: 4 // カテゴリ
    });

    const role = await guild.roles.create({
      name: `参加者-${sessionId}`,
      color: 'Blue'
    });

    const textChannel = await guild.channels.create({
      name: `📖-${sessionId}-テキスト`,
      type: 0,
      parent: category.id
    });

    const voiceChannel = await guild.channels.create({
      name: `🎤-${sessionId}-通話`,
      type: 2,
      parent: category.id
    });

    const event = await guild.scheduledEvents.create({
      name: title,
      scheduledStartTime: new Date(date),
      privacyLevel: 2,
      entityType: 3,
      channel: voiceChannel.id,
      description: `セッション「${title}」が確定しました！`
    });

    res.status(200).send('イベント作成完了');
  } catch (err) {
    console.error('エラー:', err);
    res.status(500).send('エラーが発生しました');
  }
});

client.once('ready', () => {
  console.log(`✅ ログイン完了: ${client.user.tag}`);
});

client.login(TOKEN);
app.listen(PORT, () => console.log(`🌐 Expressサーバー起動：${PORT}`));
