const { createUmi } = require('@metaplex-foundation/umi-bundle-defaults');
const { createMetadataAccountV3, mplTokenMetadata, findMetadataPda } = require('@metaplex-foundation/mpl-token-metadata');
const { publicKey, signerIdentity, createSignerFromKeypair } = require('@metaplex-foundation/umi');
const fs = require('fs');

const TOKEN_ADDRESS = 'CA4ALvCam7N3ya8d2axp3AakwNdCdQchQNNwYSYiMRR4';
const METADATA_URI = 'https://arweave.net/M2OtLp8Q3OaDrn3jmYjR5ZQO3G05NMxucyEiErc9n3Q';

async function main() {
  console.log('=== Creating On-Chain Metadata with Umi ===\n');

  // Create Umi instance
  const umi = createUmi('https://api.mainnet-beta.solana.com').use(mplTokenMetadata());

  // Load wallet
  const walletPath = process.env.HOME + '/.config/solana/id.json';
  const secretKey = new Uint8Array(JSON.parse(fs.readFileSync(walletPath, 'utf8')));
  const keypair = umi.eddsa.createKeypairFromSecretKey(secretKey);
  const signer = createSignerFromKeypair(umi, keypair);
  umi.use(signerIdentity(signer));

  console.log('✅ Wallet:', signer.publicKey.toString());

  const mint = publicKey(TOKEN_ADDRESS);

  // Derive metadata PDA using helper
  const metadataPDA = findMetadataPda(umi, { mint });

  console.log('📍 Metadata PDA:', metadataPDA[0].toString());
  console.log('📄 Metadata URI:', METADATA_URI);
  console.log('');

  try {
    console.log('📤 Creating on-chain metadata...');

    const tx = await createMetadataAccountV3(umi, {
      metadata: metadataPDA[0],
      mint: mint,
      mintAuthority: signer,
      payer: signer,
      updateAuthority: signer.publicKey,
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
    }).sendAndConfirm(umi);

    console.log('✅ On-chain metadata created!');
    console.log('   Signature:', tx.signature.toString());
    console.log('');

    // Update deployment info
    const deploymentInfo = JSON.parse(fs.readFileSync('deployment-info.json', 'utf8'));
    deploymentInfo.metadata_signature = tx.signature.toString();
    deploymentInfo.updated_at = new Date().toISOString();
    fs.writeFileSync('deployment-info.json', JSON.stringify(deploymentInfo, null, 2));

    console.log('=== METADATA COMPLETE ===\n');
    console.log('🎨 Your token now has on-chain metadata!');
    console.log('   Logo and name will show on:');
    console.log('   - Jupiter, Birdeye, Dexscreener');
    console.log('   - Phantom, Solflare wallets');
    console.log('   - All Solana explorers');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.logs) console.error('Logs:', error.logs);
    process.exit(1);
  }
}

main();
