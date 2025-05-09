const express = require('express');
const bodyParser = require('body-parser');
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildScheduledEvents,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction]
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
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const REACT_PAGE_URL = process.env.REACT_PAGE_URL || 'https://trpg-app-93d57.web.app/react.html';

app.use(bodyParser.json());

// CORS ヘッダー手動追加
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://trpg-app-93d57.web.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

app.options('*', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://trpg-app-93d57.web.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(200);
});

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

app.post('/post-session', async (req, res) => {
  const { title, maxPlayers, gm, sessionId } = req.body;

  try {
    const channel = await client.channels.fetch(DISCORD_CHANNEL_ID);
    if (!channel || !channel.isTextBased()) return res.status(500).send('チャンネルが見つからない');

    const reactUrl = `${REACT_PAGE_URL}?sessionId=${sessionId}`;

    const msg = await channel.send({
      content: `📢 新しいセッションが募集開始！\n\n**タイトル:** ${title}\n**GM:** ${gm ? 'あり' : '未定'}\n**募集人数:** ${maxPlayers}人\n\n👉 [ここをクリックして参加する](${reactUrl})`
    });

    res.status(200).send('メッセージ送信完了');
  } catch (err) {
    console.error('投稿エラー:', err);
    res.status(500).send('メッセージ投稿に失敗しました');
  }
});

app.get('/', (req, res) => {
  res.status(200).send('Bot is alive!');
});

app.listen(PORT, () => console.log(`🌐 サーバー起動: ${PORT}`));
