const cors = require('cors');
app.use(cors({
  origin: 'https://trpg-app-93d57.web.app'
}));

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
const PARTICIPATION_ENDPOINT = process.env.PARTICIPATION_ENDPOINT; // e.g. 'https://your-site.com/react-participation'
const PARTICIPATION_SECRET = process.env.PARTICIPATION_SECRET;

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

app.post('/post-session', async (req, res) => {
  const { title, maxPlayers, gm, sessionId } = req.body;

  try {
    const channel = await client.channels.fetch(DISCORD_CHANNEL_ID);
    if (!channel || !channel.isTextBased()) return res.status(500).send('チャンネルが見つからない');

    const msg = await channel.send({
      content: `📢 新しいセッションが募集開始！\n\n**タイトル:** ${title}\n**GM:** ${gm ? 'あり' : '未定'}\n**募集人数:** ${maxPlayers}人\n\n👍 リアクションで参加を表明できます！\nID: \`${sessionId}\``
    });

    await msg.react('👍');
    res.status(200).send('メッセージ送信完了');
  } catch (err) {
    console.error('投稿エラー:', err);
    res.status(500).send('メッセージ投稿に失敗しました');
  }
});

client.on('messageReactionAdd', async (reaction, user) => {
  if (reaction.partial) await reaction.fetch();
  if (user.bot) return;
  if (reaction.emoji.name !== '👍') return;

  const content = reaction.message.content;
  const match = content.match(/ID: `(.+?)`/);
  if (!match) return;

  const sessionId = match[1];
  const userId = user.id;
  const username = user.username + '#' + user.discriminator;

  const baseUrl = process.env.REACT_PAGE_URL;
  const token = process.env.SHARED_SECRET;
  const fullUrl = `${baseUrl}?sessionId=${sessionId}&userId=${userId}&username=${encodeURIComponent(username)}&token=${token}`;

  try {
    const response = await fetch(fullUrl);
    if (!response.ok) {
      console.error(`❌ 参加リクエスト失敗 (${response.status})`);
    } else {
      console.log(`✅ ${username} の参加リクエストを送信しました`);
    }
  } catch (e) {
    console.error('❌ HTTPリクエスト送信エラー:', e);
  }
});


app.get('/', (req, res) => {
  res.status(200).send('Bot is alive!');
});

app.listen(PORT, () => console.log(`🌐 サーバー起動: ${PORT}`));
