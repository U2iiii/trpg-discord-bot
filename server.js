const express = require('express');
const bodyParser = require('body-parser');
const { Client, GatewayIntentBits, Partials, PermissionsBitField } = require('discord.js');
const fetch = require('node-fetch');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3000;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildScheduledEvents,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
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

app.post('/post-session', async (req, res) => {
  const { title, maxPlayers, gm, sessionId } = req.body;

  try {
    const guild = await client.guilds.fetch(REQUIRED_GUILD_ID);

    // ロール作成
    const role = await guild.roles.create({
      name: title,
      mentionable: true,
      reason: `セッション「${title}」のためのロール`
    });

    // シークレットカテゴリ作成とチャンネル配置
    const category = await guild.channels.create({
      name: title,
      type: 4,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: role.id,
          allow: [PermissionsBitField.Flags.ViewChannel]
        }
      ]
    });
    console.log(`✅ カテゴリ作成成功: ${category.id}`);
    } catch (error) {
      console.error('❌ カテゴリ作成失敗:', error);
    }

    await guild.channels.create({
      name: '全体',
      type: 0,
      parent: category.id,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: role.id,
          allow: [PermissionsBitField.Flags.ViewChannel]
        }
      ]
    });

    for (const vcName of ['VC1', 'VC2']) {
      await guild.channels.create({
        name: vcName,
        type: 2,
        parent: category.id,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: role.id,
            allow: [PermissionsBitField.Flags.ViewChannel]
          }
        ]
      });
    }

    const channel = await client.channels.fetch(DISCORD_CHANNEL_ID);
    if (!channel || !channel.isTextBased()) return res.status(500).send('チャンネルが見つからない');

    const reactUrl = `${REACT_PAGE_URL}?sessionId=${sessionId}`;

    await channel.send({
      content: `📢 新しいセッションが募集開始！\n\n**タイトル:** ${title}\n**GM:** ${gm ? 'あり' : '未定'}\n**募集人数:** ${maxPlayers}人\n\n👉 [ここをクリックして参加する](${reactUrl})`
    });

    res.status(200).json({ roleId: role.id });
  } catch (err) {
    console.error('投稿エラー:', err);
    res.status(500).send('メッセージ投稿に失敗しました');
  }
});

cron.schedule('0 0 * * *', async () => {
  console.log('🕘 リマインド処理開始');
  try {
    const response = await fetch('https://trpg-app-93d57.web.app/public/today-sessions.json');
    const sessions = await response.json();

    const channel = await client.channels.fetch(DISCORD_CHANNEL_ID);
    if (!channel || !channel.isTextBased()) return;

    for (const session of sessions) {
      const roleMention = session.roleId ? `<@&${session.roleId}>` : '';
      const start = new Date(session.finalDate).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
      await channel.send(`📣 本日開催のセッションリマインド！\n\n📖 タイトル: ${session.title}\n🕒 開始時間: ${start}\n👥 参加者: ${roleMention}`);
    }
  } catch (error) {
    console.error('リマインド送信エラー:', error);
  }
}, {
  timezone: 'UTC'
});
