// Create on-chain metadata for existing SPL token
const { Connection, Keypair, PublicKey, Transaction } = require('@solana/web3.js');
const { createMetadataAccountV3 } = require('@metaplex-foundation/mpl-token-metadata');
const fs = require('fs');

const TOKEN_ADDRESS = 'CA4ALvCam7N3ya8d2axp3AakwNdCdQchQNNwYSYiMRR4';
const METADATA_URI = 'https://arweave.net/M2OtLp8Q3OaDrn3jmYjR5ZQO3G05NMxucyEiErc9n3Q';

async function createMetadata() {
  try {
    console.log('=== Creating On-Chain Metadata ===\n');

    // Load wallet
    const walletPath = process.env.HOME + '/.config/solana/id.json';
    const wallet = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(fs.readFileSync(walletPath, 'utf8')))
    );
    console.log('✅ Wallet:', wallet.publicKey.toString());

    // Connect
    const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
    const mint = new PublicKey(TOKEN_ADDRESS);

    // Find metadata PDA
    const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
    const [metadataPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    console.log('📍 Metadata PDA:', metadataPDA.toString());
    console.log('');

    // Create metadata instruction
    const createMetadataIx = createMetadataAccountV3(
      connection,
      {
        metadata: metadataPDA,
        mint: mint,
        mintAuthority: wallet.publicKey,
        payer: wallet.publicKey,
        updateAuthority: wallet.publicKey,
        data: {
          name: 'Ëtrid',
          symbol: 'ÉTR',
          uri: METADATA_URI,
          sellerFeeBasisPoints: 0,
          creators: null,
          collection: null,
          uses: null,
        },
        isMutable: true,
        collectionDetails: null,
      }
    );

    // Send transaction
    console.log('📤 Creating on-chain metadata...');
    const transaction = new Transaction().add(createMetadataIx);
    const signature = await connection.sendTransaction(transaction, [wallet]);

    console.log('⏳ Confirming transaction...');
    await connection.confirmTransaction(signature, 'confirmed');

    console.log('✅ On-chain metadata created!');
    console.log('   Signature:', signature);
    console.log('   Metadata account:', metadataPDA.toString());
    console.log('');

    // Update deployment info
    const deploymentInfo = JSON.parse(fs.readFileSync('deployment-info.json', 'utf8'));
    deploymentInfo.metadata_uri = METADATA_URI;
    deploymentInfo.logo_uri = 'https://arweave.net/ga6lvo-_6QoGFrLhO8T6_2FtHHMkCsas0LIEFZT3voI';
    deploymentInfo.metadata_account = metadataPDA.toString();
    deploymentInfo.metadata_signature = signature;
    deploymentInfo.updated_at = new Date().toISOString();
    fs.writeFileSync('deployment-info.json', JSON.stringify(deploymentInfo, null, 2));

    console.log('=== METADATA COMPLETE ===\n');
    console.log('🎨 Your token now has:');
    console.log('   ✅ Logo on Arweave');
    console.log('   ✅ Metadata JSON on Arweave');
    console.log('   ✅ On-chain metadata account');
    console.log('');
    console.log('📱 It will show properly on:');
    console.log('   - Jupiter');
    console.log('   - Birdeye');
    console.log('   - Dexscreener');
    console.log('   - Phantom wallet');
    console.log('   - All Solana explorers');
    console.log('');
    console.log('🚀 Ready for Raydium pool!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.logs) console.error('Logs:', error.logs);
    process.exit(1);
  }
}

createMetadata();
