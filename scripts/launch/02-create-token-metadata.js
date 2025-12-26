// Create SPL Token Metadata for ÉTR using Metaplex
// Run: node 02-create-token-metadata.js

const { Connection, Keypair, PublicKey } = require('@solana/web3.js');
const { Metaplex, keypairIdentity, bundlrStorage } = require('@metaplex-foundation/js');
const fs = require('fs');

// Configuration
const CONFIG = {
  network: 'mainnet-beta', // or 'devnet' for testing
  rpcEndpoint: 'https://api.mainnet-beta.solana.com',

  // Token details
  tokenName: 'Ëtrid',
  tokenSymbol: 'ÉTR',
  description: 'Native token of the ËTRID multichain network - PrimeArc Core Chain and Partition Burst Chains. Live mainnet with 22 validators and E320 governance.',

  // Metadata
  image: './etrid-logo-200x200.png', // Local file, will be uploaded to Arweave
  externalUrl: 'https://etrid.org',

  // Additional metadata
  attributes: [
    { trait_type: 'Network', value: 'PrimeArc Core Chain' },
    { trait_type: 'Total Supply', value: '2,521,014,000' },
    { trait_type: 'Type', value: 'Native Token' },
    { trait_type: 'Use Case', value: 'Payments, Staking, Governance' },
    { trait_type: 'Validators', value: '22 Active' },
    { trait_type: 'Consensus', value: 'ASF with PPFA' }
  ],

  // Social links
  twitter: 'https://x.com/gizzi_io',
  telegram: 'https://t.me/etridnetwork',
  discord: 'https://discord.gg/etrid',
  website: 'https://etrid.org'
};

async function createMetadata() {
  try {
    console.log('=== Creating ÉTR Token Metadata ===\n');

    // Load deployment info
    const deploymentInfo = JSON.parse(
      fs.readFileSync('deployment-info.json', 'utf8')
    );

    const tokenAddress = new PublicKey(deploymentInfo.token_address);
    console.log('Token Address:', tokenAddress.toString());

    // Load wallet
    const walletPath = process.env.HOME + '/.config/solana/id.json';
    const walletKeypair = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(fs.readFileSync(walletPath, 'utf8')))
    );
    console.log('Wallet:', walletKeypair.publicKey.toString());
    console.log('');

    // Connect to Solana
    const connection = new Connection(CONFIG.rpcEndpoint, 'confirmed');

    // Initialize Metaplex
    const metaplex = Metaplex.make(connection)
      .use(keypairIdentity(walletKeypair))
      .use(bundlrStorage({
        address: 'https://node1.bundlr.network',
        providerUrl: CONFIG.rpcEndpoint,
        timeout: 60000,
      }));

    console.log('✅ Connected to Solana');
    console.log('');

    // Create metadata object
    const metadata = {
      name: CONFIG.tokenName,
      symbol: CONFIG.tokenSymbol,
      description: CONFIG.description,
      image: CONFIG.image,
      external_url: CONFIG.externalUrl,
      attributes: CONFIG.attributes,
      properties: {
        files: [
          {
            uri: CONFIG.image,
            type: 'image/png'
          }
        ],
        category: 'image',
        creators: [
          {
            address: walletKeypair.publicKey.toString(),
            share: 100
          }
        ]
      },
      extensions: {
        twitter: CONFIG.twitter,
        telegram: CONFIG.telegram,
        discord: CONFIG.discord,
        website: CONFIG.website
      }
    };

    console.log('📝 Metadata to upload:');
    console.log(JSON.stringify(metadata, null, 2));
    console.log('');

    // Upload metadata to Arweave via Bundlr
    console.log('📤 Uploading metadata to Arweave...');
    const { uri } = await metaplex.nfts().uploadMetadata(metadata);
    console.log('✅ Metadata uploaded!');
    console.log('   URI:', uri);
    console.log('');

    // Create on-chain metadata account
    console.log('⛓️  Creating on-chain metadata account...');
    const { nft } = await metaplex.nfts().create({
      uri,
      name: CONFIG.tokenName,
      symbol: CONFIG.tokenSymbol,
      sellerFeeBasisPoints: 0,
      tokenOwner: walletKeypair.publicKey,
    });

    console.log('✅ On-chain metadata created!');
    console.log('');

    // Save metadata info
    const metadataInfo = {
      ...deploymentInfo,
      metadata_uri: uri,
      metadata_account: nft.metadataAddress.toString(),
      updated_at: new Date().toISOString()
    };

    fs.writeFileSync(
      'deployment-info.json',
      JSON.stringify(metadataInfo, null, 2)
    );

    console.log('=== METADATA CREATION COMPLETE ===');
    console.log('');
    console.log('📋 Important addresses:');
    console.log('   Token Address:', tokenAddress.toString());
    console.log('   Metadata URI:', uri);
    console.log('   Metadata Account:', nft.metadataAddress.toString());
    console.log('');
    console.log('✅ Next steps:');
    console.log('   1. Verify metadata on Solana Explorer');
    console.log('   2. Submit to Solana Token List');
    console.log('   3. Create Raydium liquidity pools');
    console.log('');

  } catch (error) {
    console.error('❌ Error creating metadata:', error);
    process.exit(1);
  }
}

// Run
createMetadata();
