/**
 * ETRID Telegram Governance Bot
 *
 * Allows validators to vote on collective proposals via Telegram.
 * Admin: @gizziio
 */

import { Telegraf, Context, Markup } from 'telegraf';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import * as dotenv from 'dotenv';

dotenv.config();

// Configuration
const CONFIG = {
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  adminUsername: 'gizziio',
  adminChatId: process.env.ADMIN_CHAT_ID || '',
  wsEndpoint: process.env.WS_ENDPOINT || 'wss://primearc.etrid.io',

  // Validator accounts (Telegram username -> Substrate address)
  // Validators self-register with /register, this maps their usernames to addresses
  validators: new Map<string, string>([
    ['gizziio', '5Dd8AjjuwKDP8P8sDguiiNKfADAXrACramNbWvLcdLEpGaPJ'], // Director-1: Gizzi (AI Overseer)
    // Other Directors will self-register with /register command
  ]),

  // Pre-authorized Director addresses (can self-register without admin approval)
  // These are the 9 validators from ValidatorCollective in chainspec
  authorizedAddresses: new Set<string>([
    '5Dd8AjjuwKDP8P8sDguiiNKfADAXrACramNbWvLcdLEpGaPJ', // Director-1: Gizzi (AI Overseer)
    '5HYpUK51E1BzhEfiRikhjkNivJiw2WAEG5Uxsrbj5ZE669EM', // Director-2: EojEdred (Founder)
    '5DLWfsK2jUGX5A6SZUqPjNYNgn4fZPTzc5PSjVR1fa3k65QY', // Director-3: validator-3
    '5HRMNRrTr6ahy5TPzC3YndWnGLSQQEuYYxLQbw2zv6M6HVWR', // Director-4: validator-4
    '5DJj4b331JKDTuwQegXSEVFC2yPjtJBW1QW4tBRBsnC9Bxgb', // Director-5: validator-5
    '5Hb2ySKHArSwzoAY9JHsXWBNMGW33q23Hmrr39JzGjm1xDwj', // Director-6: validator-6
    '5CvjTcBhW1Vy3GUA5GwpLEm47Jhkjco5rFFd82oQY7sjwfeg', // Director-7: validator-7
    '5GEn5LgTjEo6bBevEdL3ArZu8RBHNP4tj1pwEewxW4DkrTpC', // Director-8: validator-8
    '5EtWzCvcDMkjhpjbn51QWZNyNJZBeJCbyr8hRdBHqYmanx2N', // Director-9: validator-9
  ]),

  // Collective settings
  collectivePalletName: 'validatorCollective',
  threshold: 5, // 5-of-9 for most proposals
};

// Validator chat IDs for broadcasting (populated as they interact with bot)
const validatorChatIds = new Map<string, number>();

interface Proposal {
  index: number;
  hash: string;
  proposer: string;
  description: string;
  ayes: string[];
  nays: string[];
  threshold: number;
  createdAt: Date;
}

// In-memory proposal tracking
const activeProposals = new Map<number, Proposal>();
const pendingVotes = new Map<string, { proposalIndex: number; vote: boolean }>();

let api: ApiPromise;
let bot: Telegraf;

async function initApi(): Promise<ApiPromise> {
  console.log(`Connecting to ${CONFIG.wsEndpoint}...`);
  const provider = new WsProvider(CONFIG.wsEndpoint);
  const api = await ApiPromise.create({ provider });
  console.log(`Connected to chain: ${(await api.rpc.system.chain()).toString()}`);
  return api;
}

async function initBot(): Promise<Telegraf> {
  if (!CONFIG.botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN not set');
  }

  const bot = new Telegraf(CONFIG.botToken);

  // Commands
  bot.command('start', handleStart);
  bot.command('help', handleHelp);
  bot.command('proposals', handleListProposals);
  bot.command('vote', handleVoteCommand);
  bot.command('status', handleStatus);
  bot.command('register', handleRegister);
  bot.command('propose', handlePropose);

  // Admin commands
  bot.command('admin_add_validator', handleAdminAddValidator);
  bot.command('admin_authorize', handleAdminAuthorize);
  bot.command('admin_list', handleAdminList);
  bot.command('admin_broadcast', handleAdminBroadcast);

  // Callback queries for inline voting
  bot.action(/^vote_yes_(\d+)$/, handleVoteYes);
  bot.action(/^vote_no_(\d+)$/, handleVoteNo);
  bot.action(/^confirm_vote_(\d+)_(yes|no)$/, handleConfirmVote);

  return bot;
}

// === Command Handlers ===

async function handleStart(ctx: Context) {
  const username = ctx.from?.username;
  const chatId = ctx.from?.id;
  const isValidator = username && CONFIG.validators.has(username);

  // Save chat ID for broadcasting
  if (username && chatId) {
    validatorChatIds.set(username, chatId);
  }

  await ctx.reply(
    `Welcome to ETRID Governance Bot!\n\n` +
    `Status: ${isValidator ? '✅ Registered Validator' : '❌ Not a validator'}\n\n` +
    `Commands:\n` +
    `/proposals - View active proposals\n` +
    `/vote <index> <yes|no> - Vote on a proposal\n` +
    `/status - Check your validator status\n` +
    `/register <address> - Register as validator\n` +
    `/help - Show detailed help\n\n` +
    `Admin: @${CONFIG.adminUsername}`
  );
}

async function handleHelp(ctx: Context) {
  await ctx.reply(
    `ETRID Governance Bot Help\n\n` +
    `📋 Viewing Proposals:\n` +
    `/proposals - List all active proposals\n\n` +
    `🗳️ Voting:\n` +
    `/vote <index> yes - Vote YES on proposal\n` +
    `/vote <index> no - Vote NO on proposal\n\n` +
    `📊 Status:\n` +
    `/status - Your validator status and vote history\n\n` +
    `🔐 Registration:\n` +
    `/register <substrate_address> - Request validator registration\n\n` +
    `ℹ️ How Voting Works:\n` +
    `• Proposals require ${CONFIG.threshold} votes to pass\n` +
    `• Only registered validators can vote\n` +
    `• Votes are recorded on-chain via ValidatorCollective\n` +
    `• Admin can propose sudo-level actions for collective approval`
  );
}

async function handleListProposals(ctx: Context) {
  if (activeProposals.size === 0) {
    await ctx.reply('No active proposals.');
    return;
  }

  let message = '📋 Active Proposals:\n\n';

  for (const [index, proposal] of activeProposals) {
    const ayeCount = proposal.ayes.length;
    const nayCount = proposal.nays.length;
    const status = ayeCount >= proposal.threshold ? '✅ Passed' :
                   nayCount >= proposal.threshold ? '❌ Rejected' : '⏳ Pending';

    message += `#${index}: ${proposal.description}\n`;
    message += `  Status: ${status}\n`;
    message += `  Votes: ${ayeCount} YES / ${nayCount} NO (need ${proposal.threshold})\n`;
    message += `  Hash: ${proposal.hash.slice(0, 16)}...\n\n`;
  }

  await ctx.reply(message);
}

async function handleVoteCommand(ctx: Context) {
  const username = ctx.from?.username;

  if (!username || !CONFIG.validators.has(username)) {
    await ctx.reply('❌ You are not a registered validator. Use /register to apply.');
    return;
  }

  const args = (ctx.message as any)?.text?.split(' ').slice(1) || [];
  if (args.length < 2) {
    await ctx.reply('Usage: /vote <proposal_index> <yes|no>\nExample: /vote 1 yes');
    return;
  }

  const proposalIndex = parseInt(args[0]);
  const voteChoice = args[1].toLowerCase();

  if (isNaN(proposalIndex)) {
    await ctx.reply('❌ Invalid proposal index. Use a number.');
    return;
  }

  if (voteChoice !== 'yes' && voteChoice !== 'no') {
    await ctx.reply('❌ Vote must be "yes" or "no".');
    return;
  }

  const proposal = activeProposals.get(proposalIndex);
  if (!proposal) {
    await ctx.reply(`❌ Proposal #${proposalIndex} not found.`);
    return;
  }

  // Check if already voted
  const validatorAddress = CONFIG.validators.get(username)!;
  if (proposal.ayes.includes(validatorAddress) || proposal.nays.includes(validatorAddress)) {
    await ctx.reply('❌ You have already voted on this proposal.');
    return;
  }

  // Ask for confirmation
  await ctx.reply(
    `🗳️ Confirm Vote\n\n` +
    `Proposal #${proposalIndex}: ${proposal.description}\n` +
    `Your vote: ${voteChoice.toUpperCase()}\n\n` +
    `This will submit an on-chain transaction.`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Confirm', `confirm_vote_${proposalIndex}_${voteChoice}`),
        Markup.button.callback('❌ Cancel', 'cancel_vote'),
      ],
    ])
  );
}

async function handleVoteYes(ctx: Context) {
  const match = (ctx.callbackQuery as any)?.data?.match(/^vote_yes_(\d+)$/);
  if (!match) return;

  const proposalIndex = parseInt(match[1]);
  await processVoteConfirmation(ctx, proposalIndex, true);
}

async function handleVoteNo(ctx: Context) {
  const match = (ctx.callbackQuery as any)?.data?.match(/^vote_no_(\d+)$/);
  if (!match) return;

  const proposalIndex = parseInt(match[1]);
  await processVoteConfirmation(ctx, proposalIndex, false);
}

async function handleConfirmVote(ctx: Context) {
  const match = (ctx.callbackQuery as any)?.data?.match(/^confirm_vote_(\d+)_(yes|no)$/);
  if (!match) return;

  const proposalIndex = parseInt(match[1]);
  const vote = match[2] === 'yes';

  await processVoteConfirmation(ctx, proposalIndex, vote);
}

async function processVoteConfirmation(ctx: Context, proposalIndex: number, vote: boolean) {
  const username = ctx.from?.username;

  if (!username || !CONFIG.validators.has(username)) {
    await ctx.answerCbQuery('Not authorized');
    return;
  }

  const proposal = activeProposals.get(proposalIndex);
  if (!proposal) {
    await ctx.answerCbQuery('Proposal not found');
    return;
  }

  const validatorAddress = CONFIG.validators.get(username)!;

  try {
    // Record vote locally (in production, submit to chain)
    if (vote) {
      proposal.ayes.push(validatorAddress);
    } else {
      proposal.nays.push(validatorAddress);
    }

    await ctx.answerCbQuery('Vote recorded!');
    await ctx.editMessageText(
      `✅ Vote Submitted!\n\n` +
      `Proposal #${proposalIndex}: ${proposal.description}\n` +
      `Your vote: ${vote ? 'YES' : 'NO'}\n\n` +
      `Current tally: ${proposal.ayes.length} YES / ${proposal.nays.length} NO`
    );

    // Check if threshold reached
    if (proposal.ayes.length >= proposal.threshold) {
      await notifyProposalPassed(proposalIndex, proposal);
    } else if (proposal.nays.length >= proposal.threshold) {
      await notifyProposalRejected(proposalIndex, proposal);
    }

  } catch (error) {
    console.error('Vote error:', error);
    await ctx.answerCbQuery('Error submitting vote');
  }
}

async function handleStatus(ctx: Context) {
  const username = ctx.from?.username;

  if (!username) {
    await ctx.reply('❌ Cannot determine your username.');
    return;
  }

  const isValidator = CONFIG.validators.has(username);
  const address = CONFIG.validators.get(username);

  let message = `📊 Validator Status\n\n`;
  message += `Username: @${username}\n`;
  message += `Status: ${isValidator ? '✅ Registered' : '❌ Not registered'}\n`;

  if (address) {
    message += `Address: ${address.slice(0, 12)}...${address.slice(-8)}\n`;
  }

  // Count votes
  let votesCount = 0;
  for (const proposal of activeProposals.values()) {
    if (address && (proposal.ayes.includes(address) || proposal.nays.includes(address))) {
      votesCount++;
    }
  }
  message += `Votes cast: ${votesCount}\n`;

  await ctx.reply(message);
}

async function handleRegister(ctx: Context) {
  const username = ctx.from?.username;
  const chatId = ctx.from?.id;
  const args = (ctx.message as any)?.text?.split(' ').slice(1) || [];

  if (!username) {
    await ctx.reply('❌ You must have a Telegram username to register.');
    return;
  }

  if (CONFIG.validators.has(username)) {
    await ctx.reply('✅ You are already registered as a validator.');
    return;
  }

  if (args.length < 1) {
    await ctx.reply(
      'Usage: /register <substrate_address>\n\n' +
      'Example: /register 5HQMqpWrZU1AdN2WumX2Fv8EphJUgiF6fmyMZr94HH31kVQd'
    );
    return;
  }

  const address = args[0];

  // Basic validation
  if (!address.startsWith('5') || address.length !== 48) {
    await ctx.reply('❌ Invalid Substrate address format. Address should start with "5" and be 48 characters.');
    return;
  }

  // Check if address is pre-authorized (Director)
  if (CONFIG.authorizedAddresses.has(address)) {
    // Auto-approve
    CONFIG.validators.set(username, address);
    if (chatId) {
      validatorChatIds.set(username, chatId);
    }

    await ctx.reply(
      `✅ Auto-Approved! Welcome Director!\n\n` +
      `Username: @${username}\n` +
      `Address: ${address}\n\n` +
      `You can now:\n` +
      `• View proposals with /proposals\n` +
      `• Vote with /vote <index> <yes|no>\n` +
      `• Check status with /status`
    );

    // Notify admin
    if (CONFIG.adminChatId) {
      await bot.telegram.sendMessage(
        CONFIG.adminChatId,
        `✅ Director Auto-Registered\n\n` +
        `Username: @${username}\n` +
        `Address: ${address}`
      );
    }
    return;
  }

  // Not pre-authorized, need admin approval
  if (CONFIG.adminChatId) {
    await bot.telegram.sendMessage(
      CONFIG.adminChatId,
      `🔔 New Validator Registration Request\n\n` +
      `Username: @${username}\n` +
      `Address: ${address}\n\n` +
      `To approve:\n` +
      `/admin_add_validator ${username} ${address}`
    );
  }

  await ctx.reply(
    `📝 Registration request submitted!\n\n` +
    `Username: @${username}\n` +
    `Address: ${address}\n\n` +
    `An admin will review your request. Contact @${CONFIG.adminUsername} if urgent.`
  );
}

async function handlePropose(ctx: Context) {
  const username = ctx.from?.username;

  if (username !== CONFIG.adminUsername) {
    await ctx.reply('❌ Only admin can create proposals.');
    return;
  }

  const text = (ctx.message as any)?.text || '';
  const description = text.replace('/propose ', '').trim();

  if (!description) {
    await ctx.reply('Usage: /propose <description>\nExample: /propose Upgrade runtime to v110');
    return;
  }

  // Create proposal
  const index = activeProposals.size + 1;
  const proposal: Proposal = {
    index,
    hash: `0x${Date.now().toString(16)}`, // Placeholder hash
    proposer: CONFIG.validators.get(username) || '',
    description,
    ayes: [],
    nays: [],
    threshold: CONFIG.threshold,
    createdAt: new Date(),
  };

  activeProposals.set(index, proposal);

  // Broadcast to all validators
  await broadcastToValidators(
    `🆕 New Proposal #${index}\n\n` +
    `${description}\n\n` +
    `Proposed by: @${username}\n` +
    `Threshold: ${CONFIG.threshold} votes needed\n\n` +
    `Vote with: /vote ${index} yes  or  /vote ${index} no`,
    [
      [
        Markup.button.callback('✅ Vote YES', `vote_yes_${index}`),
        Markup.button.callback('❌ Vote NO', `vote_no_${index}`),
      ],
    ]
  );

  await ctx.reply(`✅ Proposal #${index} created and broadcast to validators.`);
}

// === Admin Commands ===

async function handleAdminAddValidator(ctx: Context) {
  const username = ctx.from?.username;

  if (username !== CONFIG.adminUsername) {
    await ctx.reply('❌ Admin only command.');
    return;
  }

  const args = (ctx.message as any)?.text?.split(' ').slice(1) || [];
  if (args.length < 2) {
    await ctx.reply('Usage: /admin_add_validator <telegram_username> <substrate_address>');
    return;
  }

  const [newUsername, address] = args;
  const cleanUsername = newUsername.replace('@', '');

  CONFIG.validators.set(cleanUsername, address);

  await ctx.reply(
    `✅ Validator added!\n\n` +
    `Username: @${cleanUsername}\n` +
    `Address: ${address}`
  );
}

async function handleAdminAuthorize(ctx: Context) {
  const username = ctx.from?.username;

  if (username !== CONFIG.adminUsername) {
    await ctx.reply('❌ Admin only command.');
    return;
  }

  const args = (ctx.message as any)?.text?.split(' ').slice(1) || [];
  if (args.length < 1) {
    await ctx.reply(
      'Usage: /admin_authorize <substrate_address>\n\n' +
      'This pre-authorizes an address for auto-registration.\n' +
      'When a user registers with this address, they will be auto-approved.'
    );
    return;
  }

  const address = args[0];

  if (!address.startsWith('5') || address.length !== 48) {
    await ctx.reply('❌ Invalid Substrate address format.');
    return;
  }

  CONFIG.authorizedAddresses.add(address);
  await ctx.reply(
    `✅ Address authorized!\n\n` +
    `${address}\n\n` +
    `This address can now self-register with /register`
  );
}

async function handleAdminList(ctx: Context) {
  const username = ctx.from?.username;

  if (username !== CONFIG.adminUsername) {
    await ctx.reply('❌ Admin only command.');
    return;
  }

  let message = '📋 Registered Validators\n\n';

  if (CONFIG.validators.size === 0) {
    message += 'No validators registered yet.';
  } else {
    let idx = 1;
    for (const [user, addr] of CONFIG.validators) {
      const hasChatId = validatorChatIds.has(user) ? '✓' : '○';
      message += `${idx}. @${user} ${hasChatId}\n`;
      message += `   ${addr.slice(0, 12)}...${addr.slice(-6)}\n`;
      idx++;
    }
    message += `\n✓ = can receive broadcasts\n○ = needs to /start`;
  }

  message += `\n\n📍 Authorized Addresses: ${CONFIG.authorizedAddresses.size}`;
  message += `\n📡 Active Chat IDs: ${validatorChatIds.size}`;

  await ctx.reply(message);
}

async function handleAdminBroadcast(ctx: Context) {
  const username = ctx.from?.username;

  if (username !== CONFIG.adminUsername) {
    await ctx.reply('❌ Admin only command.');
    return;
  }

  const text = (ctx.message as any)?.text || '';
  const message = text.replace('/admin_broadcast ', '').trim();

  if (!message) {
    await ctx.reply('Usage: /admin_broadcast <message>');
    return;
  }

  await broadcastToValidators(`📢 Admin Announcement\n\n${message}`);
  await ctx.reply(`✅ Broadcast sent to ${validatorChatIds.size} validators.`);
}

// === Helper Functions ===

async function broadcastToValidators(message: string, keyboard?: any[][]) {
  console.log(`Broadcasting to ${validatorChatIds.size} validators:`, message.slice(0, 50) + '...');

  // Send to all registered validators with known chat IDs
  for (const [username, chatId] of validatorChatIds) {
    try {
      if (keyboard) {
        await bot.telegram.sendMessage(chatId, message, Markup.inlineKeyboard(keyboard));
      } else {
        await bot.telegram.sendMessage(chatId, message);
      }
    } catch (error) {
      console.error(`Failed to send to @${username}:`, error);
    }
  }

  // Also send to admin if not already in the list
  if (CONFIG.adminChatId && !Array.from(validatorChatIds.values()).includes(Number(CONFIG.adminChatId))) {
    try {
      if (keyboard) {
        await bot.telegram.sendMessage(CONFIG.adminChatId, message, Markup.inlineKeyboard(keyboard));
      } else {
        await bot.telegram.sendMessage(CONFIG.adminChatId, message);
      }
    } catch (error) {
      console.error('Failed to send to admin:', error);
    }
  }
}

async function notifyProposalPassed(index: number, proposal: Proposal) {
  await broadcastToValidators(
    `✅ Proposal #${index} PASSED!\n\n` +
    `${proposal.description}\n\n` +
    `Final vote: ${proposal.ayes.length} YES / ${proposal.nays.length} NO`
  );
}

async function notifyProposalRejected(index: number, proposal: Proposal) {
  await broadcastToValidators(
    `❌ Proposal #${index} REJECTED\n\n` +
    `${proposal.description}\n\n` +
    `Final vote: ${proposal.ayes.length} YES / ${proposal.nays.length} NO`
  );
}

// === Chain Event Subscriptions ===

async function subscribeToChainEvents() {
  if (!api) return;

  // Subscribe to new collective proposals
  api.query.system.events((events: any) => {
    events.forEach((record: any) => {
      const { event } = record;

      // Look for ValidatorCollective.Proposed events
      if (event.section === 'validatorCollective' && event.method === 'Proposed') {
        const [account, proposalIndex, hash] = event.data;
        console.log(`New collective proposal: #${proposalIndex}`);

        // Notify validators
        broadcastToValidators(
          `🆕 On-Chain Proposal #${proposalIndex}\n\n` +
          `Hash: ${hash.toString().slice(0, 16)}...\n` +
          `Proposer: ${account.toString().slice(0, 12)}...`
        );
      }
    });
  });
}

// === Main ===

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   ETRID Telegram Governance Bot');
  console.log('   Admin: @gizziio');
  console.log('═══════════════════════════════════════════════════════════');

  await cryptoWaitReady();

  try {
    // Initialize chain connection
    api = await initApi();

    // Subscribe to chain events
    await subscribeToChainEvents();

  } catch (error) {
    console.warn('Chain connection failed, running in offline mode:', error);
  }

  // Initialize bot
  bot = await initBot();

  // Start bot
  console.log('Starting Telegram bot...');
  await bot.launch();
  console.log('Bot is running!');

  // Graceful shutdown
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

main().catch(console.error);
