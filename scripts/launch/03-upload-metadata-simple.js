// Simple metadata upload for ETR token
// Uses direct Arweave upload via bundlr

const fs = require('fs');
const { Connection, Keypair, PublicKey } = require('@solana/web3.js');
const { Metaplex, keypairIdentity, toMetaplexFile } = require('@metaplex-foundation/js');

const CONFIG = {
  rpcEndpoint: 'https://api.mainnet-beta.solana.com',
  tokenAddress: 'CA4ALvCam7N3ya8d2axp3AakwNdCdQchQNNwYSYiMRR4',

  metadata: {
    name: 'Ëtrid',
    symbol: 'ÉTR',
    description: 'Native token of the ËTRID multichain network - PrimeArc Core Chain and Partition Burst Chains. Live mainnet with 22 validators and E320 governance.',
    external_url: 'https://etrid.org',
    attributes: [
      { trait_type: 'Network', value: 'PrimeArc Core Chain' },
      { trait_type: 'Total Supply', value: '2,521,014,000' },
      { trait_type: 'Type', value: 'Native Token' },
      { trait_type: 'Validators', value: '22 Active' },
      { trait_type: 'Consensus', value: 'ASF with PPFA' }
    ],
    properties: {
      category: 'fungible',
      files: []
    }
  }
};

async function uploadMetadata() {
  try {
    console.log('=== Uploading ÉTR Metadata ===\n');

    // Load wallet
    const walletPath = process.env.HOME + '/.config/solana/id.json';
    const walletKeypair = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(fs.readFileSync(walletPath, 'utf8')))
    );
    console.log('✅ Wallet loaded:', walletKeypair.publicKey.toString());

    // Connect to Solana
    const connection = new Connection(CONFIG.rpcEndpoint, 'confirmed');
    console.log('✅ Connected to Solana\n');

    // Initialize Metaplex
    const metaplex = Metaplex.make(connection)
      .use(keypairIdentity(walletKeypair));

    console.log('📤 Uploading logo...');

    // Read and upload logo
    const logoPath = './etrid-logo-200x200.png';
    const logoBuffer = fs.readFileSync(logoPath);
    const logoFile = toMetaplexFile(logoBuffer, 'logo.png');

    const logoUri = await metaplex.storage().upload(logoFile);
    console.log('✅ Logo uploaded to:', logoUri);
    console.log('');

    // Add logo to metadata
    CONFIG.metadata.image = logoUri;
    CONFIG.metadata.properties.files.push({
      uri: logoUri,
      type: 'image/png'
    });

    console.log('📤 Uploading metadata JSON...');
    const { uri: metadataUri } = await metaplex.nfts().uploadMetadata(CONFIG.metadata);
    console.log('✅ Metadata uploaded to:', metadataUri);
    console.log('');

    console.log('⛓️  Creating on-chain metadata...');
    const mintAddress = new PublicKey(CONFIG.tokenAddress);

    const { nft } = await metaplex.nfts().create({
      uri: metadataUri,
      name: CONFIG.metadata.name,
      symbol: CONFIG.metadata.symbol,
      sellerFeeBasisPoints: 0,
      useNewMint: mintAddress,
      isMutable: true,
    });

    console.log('✅ On-chain metadata created!');
    console.log('   Metadata account:', nft.address.toString());
    console.log('');

    // Save deployment info
    const deploymentInfo = JSON.parse(fs.readFileSync('deployment-info.json', 'utf8'));
    deploymentInfo.metadata_uri = metadataUri;
    deploymentInfo.logo_uri = logoUri;
    deploymentInfo.metadata_account = nft.address.toString();
    deploymentInfo.updated_at = new Date().toISOString();

    fs.writeFileSync('deployment-info.json', JSON.stringify(deploymentInfo, null, 2));

    console.log('=== METADATA UPLOAD COMPLETE ===\n');
    console.log('📋 Summary:');
    console.log('   Token:', CONFIG.tokenAddress);
    console.log('   Logo:', logoUri);
    console.log('   Metadata:', metadataUri);
    console.log('   Account:', nft.address.toString());
    console.log('');
    console.log('✅ Your token now has logo and metadata!');
    console.log('   It will show on Jupiter, Birdeye, and all platforms.');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

uploadMetadata();
