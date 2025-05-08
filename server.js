// server.js（更新済み）
const express = require('express');
const bodyParser = require('body-parser');
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

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

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = 'https://trpg-discord-bot-7gpv.onrender.com/oauth/callback';
const REQUIRED_GUILD_ID = '1369927990439448711';
const REQUIRED_ROLE_ID = '1369969519384072252';

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

    const guildMemberRes = await fetch(`https://discord.com/api/users/@me/guilds/${REQUIRED_GUILD_ID}/member`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!guildMemberRes.ok) {
      return res.status(403).send('このサーバーに参加していないためアクセスできません。');
    }

    const memberData = await guildMemberRes.json();
    const hasRole = memberData.roles.includes(REQUIRED_ROLE_ID);

    if (!hasRole) {
      return res.status(403).send('必要なロールを所持していないためアクセスできません。');
    }

    res.redirect(`https://trpg-app-93d57.web.app/login-success.html?username=${encodeURIComponent(user.username + '#' + user.discriminator)}&id=${user.id}`);
  } catch (e) {
    console.error(e);
    res.status(500).send('OAuth処理中にエラーが発生しました');
  }
});

app.post('/finalize-session', async (req, res) => {
  const { guildId, title, date, sessionId } = req.body;

  try {
    const guild = await client.guilds.fetch(guildId);

    const category = await guild.channels.create({ name: `📅 ${title}`, type: 4 });
    const role = await guild.roles.create({ name: `参加者-${sessionId}`, color: 'Blue' });

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

    await guild.scheduledEvents.create({
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

app.get('/', (req, res) => {
  res.status(200).send('Bot is alive!');
});

app.listen(PORT, () => console.log(`🌐 サーバー起動: ${PORT}`));
