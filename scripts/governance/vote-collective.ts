#!/usr/bin/env ts-node
/**
 * CLI script for voting on ValidatorCollective proposals
 *
 * Usage:
 *   npx ts-node vote-collective.ts --proposal 1 --vote yes --seed "your mnemonic"
 *   npx ts-node vote-collective.ts --list
 *   npx ts-node vote-collective.ts --propose "Upgrade to v110" --call 0x...
 */

import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';

const CONFIG = {
  wsEndpoint: process.env.WS_ENDPOINT || 'wss://primearc.etrid.io',
  collectivePallet: 'validatorCollective',
};

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.length === 0) {
    printHelp();
    return;
  }

  await cryptoWaitReady();

  console.log(`Connecting to ${CONFIG.wsEndpoint}...`);
  const provider = new WsProvider(CONFIG.wsEndpoint);
  const api = await ApiPromise.create({ provider });
  console.log(`Connected to: ${(await api.rpc.system.chain()).toString()}`);

  if (args.includes('--list')) {
    await listProposals(api);
  } else if (args.includes('--vote')) {
    const proposalIdx = getArg(args, '--proposal');
    const vote = getArg(args, '--vote');
    const seed = getArg(args, '--seed');

    if (!proposalIdx || !vote || !seed) {
      console.error('Missing required arguments: --proposal, --vote, --seed');
      process.exit(1);
    }

    await voteOnProposal(api, parseInt(proposalIdx), vote === 'yes', seed);
  } else if (args.includes('--propose')) {
    const description = getArg(args, '--propose');
    const call = getArg(args, '--call');
    const seed = getArg(args, '--seed');

    if (!description || !seed) {
      console.error('Missing required arguments: --propose, --seed');
      process.exit(1);
    }

    await createProposal(api, description, call || '', seed);
  } else if (args.includes('--close')) {
    const proposalIdx = getArg(args, '--proposal');
    const seed = getArg(args, '--seed');

    if (!proposalIdx || !seed) {
      console.error('Missing required arguments: --proposal, --seed');
      process.exit(1);
    }

    await closeProposal(api, parseInt(proposalIdx), seed);
  }

  await api.disconnect();
}

function getArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

function printHelp() {
  console.log(`
ETRID ValidatorCollective Voting CLI

Commands:
  --list                    List all active proposals
  --vote                    Vote on a proposal
  --propose                 Create a new proposal
  --close                   Close a proposal after threshold reached

Options:
  --proposal <index>        Proposal index number
  --vote <yes|no>           Your vote
  --seed "mnemonic"         Your validator seed phrase
  --propose "description"   Proposal description
  --call <hex>              Encoded call data (optional)
  --ws <endpoint>           WebSocket endpoint (default: wss://primearc.etrid.io)

Examples:
  # List proposals
  npx ts-node vote-collective.ts --list

  # Vote yes on proposal #1
  npx ts-node vote-collective.ts --proposal 1 --vote yes --seed "word1 word2 ..."

  # Create proposal (admin/sudo)
  npx ts-node vote-collective.ts --propose "Upgrade runtime" --seed "..."

  # Close proposal after threshold
  npx ts-node vote-collective.ts --close --proposal 1 --seed "..."
`);
}

async function listProposals(api: ApiPromise) {
  console.log('\n═══ Active Proposals ═══\n');

  try {
    // Get proposal count
    const proposalCount = await api.query[CONFIG.collectivePallet].proposalCount();
    console.log(`Total proposals: ${proposalCount.toString()}`);

    // Get all proposals
    const proposals = await api.query[CONFIG.collectivePallet].proposals();
    const proposalHashes = (proposals as any).toArray ? (proposals as any).toArray() : [];

    if (proposalHashes.length === 0) {
      console.log('No active proposals.');
      return;
    }

    for (let i = 0; i < proposalHashes.length; i++) {
      const hash = proposalHashes[i];
      const voting = await api.query[CONFIG.collectivePallet].voting(hash);

      if (voting.isSome) {
        const votingData = voting.unwrap();
        console.log(`Proposal #${i}:`);
        console.log(`  Hash: ${hash.toString().slice(0, 20)}...`);
        console.log(`  Index: ${(votingData as any).index?.toString() || 'N/A'}`);
        console.log(`  Threshold: ${(votingData as any).threshold?.toString() || 'N/A'}`);
        console.log(`  Ayes: ${(votingData as any).ayes?.length || 0}`);
        console.log(`  Nays: ${(votingData as any).nays?.length || 0}`);
        console.log('');
      }
    }
  } catch (error) {
    console.error('Error listing proposals:', error);
    console.log('\nNote: ValidatorCollective pallet may not be active on this chain.');
  }
}

async function voteOnProposal(api: ApiPromise, proposalIndex: number, approve: boolean, seed: string) {
  console.log(`\n═══ Voting on Proposal #${proposalIndex} ═══`);
  console.log(`Vote: ${approve ? 'YES (Aye)' : 'NO (Nay)'}`);

  const keyring = new Keyring({ type: 'sr25519' });
  const voter = keyring.addFromUri(seed);

  console.log(`Voter: ${voter.address}`);

  try {
    // Get proposal hash from index
    const proposals = await api.query[CONFIG.collectivePallet].proposals();
    const proposalHashes = (proposals as any).toArray ? (proposals as any).toArray() : [];

    if (proposalIndex >= proposalHashes.length) {
      console.error(`Proposal #${proposalIndex} not found`);
      return;
    }

    const proposalHash = proposalHashes[proposalIndex];

    // Submit vote
    const tx = api.tx[CONFIG.collectivePallet].vote(proposalHash, proposalIndex, approve);

    console.log('Submitting vote...');

    const unsub = await tx.signAndSend(voter, ({ status, events }) => {
      if (status.isInBlock) {
        console.log(`✅ Vote included in block: ${status.asInBlock.toString()}`);

        events.forEach(({ event }) => {
          if (event.section === CONFIG.collectivePallet) {
            console.log(`  Event: ${event.method}`);
          }
        });
      } else if (status.isFinalized) {
        console.log(`✅ Vote finalized in block: ${status.asFinalized.toString()}`);
        unsub();
      }
    });

  } catch (error) {
    console.error('Error voting:', error);
  }
}

async function createProposal(api: ApiPromise, description: string, encodedCall: string, seed: string) {
  console.log(`\n═══ Creating Proposal ═══`);
  console.log(`Description: ${description}`);

  const keyring = new Keyring({ type: 'sr25519' });
  const proposer = keyring.addFromUri(seed);

  console.log(`Proposer: ${proposer.address}`);

  try {
    // Create a remark call with the description if no call provided
    let call;
    if (encodedCall) {
      call = api.createType('Call', encodedCall);
    } else {
      // Use system.remark as placeholder
      call = api.tx.system.remark(description);
    }

    // Get threshold (e.g., 5 for 5-of-9)
    const threshold = 5;

    const tx = api.tx[CONFIG.collectivePallet].propose(threshold, call, call.encodedLength);

    console.log('Submitting proposal...');

    const unsub = await tx.signAndSend(proposer, ({ status, events }) => {
      if (status.isInBlock) {
        console.log(`✅ Proposal included in block: ${status.asInBlock.toString()}`);

        events.forEach(({ event }) => {
          if (event.section === CONFIG.collectivePallet && event.method === 'Proposed') {
            const [account, proposalIndex, hash] = event.data;
            console.log(`\n📋 Proposal Created!`);
            console.log(`  Index: ${proposalIndex.toString()}`);
            console.log(`  Hash: ${hash.toString()}`);
          }
        });
      } else if (status.isFinalized) {
        console.log(`✅ Proposal finalized`);
        unsub();
      }
    });

  } catch (error) {
    console.error('Error creating proposal:', error);
  }
}

async function closeProposal(api: ApiPromise, proposalIndex: number, seed: string) {
  console.log(`\n═══ Closing Proposal #${proposalIndex} ═══`);

  const keyring = new Keyring({ type: 'sr25519' });
  const closer = keyring.addFromUri(seed);

  console.log(`Closer: ${closer.address}`);

  try {
    const proposals = await api.query[CONFIG.collectivePallet].proposals();
    const proposalHashes = (proposals as any).toArray ? (proposals as any).toArray() : [];

    if (proposalIndex >= proposalHashes.length) {
      console.error(`Proposal #${proposalIndex} not found`);
      return;
    }

    const proposalHash = proposalHashes[proposalIndex];

    // Get voting info for weight bounds
    const voting = await api.query[CONFIG.collectivePallet].voting(proposalHash);

    if (voting.isNone) {
      console.error('Voting info not found');
      return;
    }

    // Close with weight bounds
    const tx = api.tx[CONFIG.collectivePallet].close(
      proposalHash,
      proposalIndex,
      { refTime: 1_000_000_000, proofSize: 100_000 },
      1000
    );

    console.log('Closing proposal...');

    const unsub = await tx.signAndSend(closer, ({ status, events }) => {
      if (status.isInBlock) {
        console.log(`✅ Close included in block: ${status.asInBlock.toString()}`);

        events.forEach(({ event }) => {
          if (event.section === CONFIG.collectivePallet) {
            console.log(`  Event: ${event.method}`);
            if (event.method === 'Closed') {
              console.log('  Proposal closed successfully!');
            } else if (event.method === 'Executed') {
              console.log('  Proposal executed!');
            }
          }
        });
      } else if (status.isFinalized) {
        unsub();
      }
    });

  } catch (error) {
    console.error('Error closing proposal:', error);
  }
}

main().catch(console.error);
