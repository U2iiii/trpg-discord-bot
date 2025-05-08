const express = require('express');
const bodyParser = require('body-parser');
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Discord Bot クライアント
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildScheduledEvents,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Channel]
});

client.once('ready', () => {
  console.log(`✅ ログイン完了: ${client.user.tag}`);
});

client.login(process.env.DISCORD_BOT_TOKEN);

// ✅ Discord OAuth2 設定
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = 'https://trpg-discord-bot-7gpv.onrender.com/oauth/callback'; // ←あなたのRenderのURLに変更

app.use(bodyParser.json());

app.get('/login', (req, res) => {
  const url = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20guilds%20guilds.members.read`;
  res.redirect(url);
});

app.get('/oauth/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('Code is missing');

  try {
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      })
    });

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const user = await userRes.json();

    const guildRes = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const guilds = await guildRes.json();

    res.send(`ログイン成功：${user.username}#${user.discriminator}<br><pre>${JSON.stringify(guilds, null, 2)}</pre>`);
  } catch (e) {
    console.error(e);
    res.status(500).send('OAuth処理中にエラーが発生しました');
  }
});

// 🔔 セッション確定通知API（既存の処理）
app.post('/finalize-session', async (req, res) => {
  const { guildId, title, date, sessionId } = req.body;

  try {
    const guild = await client.guilds.fetch(guildId);

    const category = await guild.channels.create({
      name: `📅 ${title}`,
      type: 4
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
    res.status(500).send('イベント作成中にエラーが発生しました');
  }
});

// 🔄 スリープ防止Ping
app.get('/', (req, res) => {
  res.status(200).send('Bot is alive!');
});

app.listen(PORT, () => console.log(`🌐 サーバー起動: ${PORT}`));
