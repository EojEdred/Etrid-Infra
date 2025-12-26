# ËTRID Secure Scripts Architecture

## Overview

This document describes the new secure architecture for ËTRID scripts that separates public automation from sensitive configuration. The goal is to maintain the functionality of the scripts while ensuring that sensitive information like IP addresses, private keys, and credentials are not hardcoded in the source code.

## Directory Structure

```
etrid/
├── config/
│   ├── templates/           # Configuration templates (safe to commit)
│   │   ├── .env.example   # Environment variables template
│   │   └── validator-config.json  # Validator configuration template
│   └── secure/             # Sensitive configuration (gitignored)
│       └── .env.secure     # Actual environment variables (not committed)
├── scripts/
│   ├── public/             # Public scripts that use external config
│   │   ├── inject-all-pbc-keys-secure.sh
│   │   ├── generate-attester-envs-secure.sh
│   │   ├── register-attesters-onchain-secure.ts
│   │   └── deploy-attester-registry-evm-secure.ts
│   └── [original scripts]  # Original scripts (to be deprecated)
└── secrets/                # Attester keys and other secrets (gitignored)
```

## Security Principles

1. **Separation of Concerns**: Public scripts contain no sensitive information
2. **External Configuration**: All sensitive data is loaded from external files
3. **Environment Variables**: Use environment variables for runtime configuration
4. **Template-Based**: Provide templates for users to customize their environment
5. **Git Safety**: Sensitive files are properly excluded via .gitignore

## Configuration Management

### Environment Variables

The system uses environment variables for sensitive configuration:

- `PRIMEARC_RPC_URL`: Primearc RPC endpoint
- `SUDO_SEED`: Sudo account seed phrase
- `FUNDING_PRIVATE_KEY`: Funding account private key
- `SSH_KEY_PATH`: Path to SSH key for remote operations
- `ATTESTER_KEYS_FILE`: Path to attester keys file
- `ATTESTER_THRESHOLD`: Number of signatures required for attestations

### Configuration Files

Configuration files are stored in JSON format for structured data:

- `config/templates/validator-config.json`: Contains validator IP addresses and metadata
- `config/secure/attester-keys.json`: Contains attester private keys (gitignored)

## Migration Guide

### For Developers

1. Copy `config/templates/.env.example` to `config/secure/.env.secure`
2. Fill in your actual values in the secure file
3. Update your scripts to use the new secure versions in `scripts/public/`
4. Set environment variables before running scripts

### Example Usage

```bash
# Set environment variables
export SUDO_SEED="your sudo seed phrase here"
export FUNDING_PRIVATE_KEY="0xyourfundingprivatekeyhere"
export PRIMEARC_RPC_URL="ws://your-ip:9944"

# Run secure scripts
npx ts-node scripts/public/register-attesters-onchain-secure.ts
```

Or source from a secure file:
```bash
source config/secure/.env.secure
npx ts-node scripts/public/register-attesters-onchain-secure.ts
```

## Script Security Features

### 1. Dynamic Configuration Loading

Scripts now load configuration from external sources instead of hardcoded values:

```bash
# Before (insecure)
PRIMEARC_RPC_URL="ws://100.71.127.127:9944"

# After (secure)
PRIMEARC_RPC_URL="${PRIMEARC_RPC_URL:-ws://127.0.0.1:9944}"
```

### 2. JSON Configuration

Validator IP addresses and other structured data are loaded from JSON:

```bash
# Load from JSON config
vm_ip=$(jq -r ".pbcValidators[\"$pbc\"].ip" "$VALIDATOR_CONFIG_FILE")
```

### 3. Environment Variable Validation

Scripts validate required environment variables before execution:

```typescript
if (!CONFIG.sudoSeed) {
  log(colors.red, 'ERROR: SUDO_SEED environment variable is not set');
  process.exit(1);
}
```

## Security Best Practices

### For Maintainers

1. Never commit files containing real secrets
2. Always use the template pattern for sensitive configuration
3. Regularly audit .gitignore to ensure sensitive files are excluded
4. Use the secure script versions for all new development

### For Users

1. Never commit your `.env.secure` file
2. Use strong, unique values for all sensitive configuration
3. Store your secure files in a safe location outside the repository
4. Regularly rotate sensitive keys and credentials

## Legacy Script Handling

The original scripts with hardcoded values should be considered deprecated. The new secure versions provide the same functionality while maintaining security:

| Legacy Script | Secure Replacement |
|---------------|-------------------|
| `inject-all-pbc-keys.sh` | `scripts/public/inject-all-pbc-keys-secure.sh` |
| `generate-attester-envs.sh` | `scripts/public/generate-attester-envs-secure.sh` |
| `register-attesters-onchain.ts` | `scripts/public/register-attesters-onchain-secure.ts` |
| `deploy-attester-registry-evm.ts` | `scripts/public/deploy-attester-registry-evm-secure.ts` |

## Testing the Secure Architecture

To verify the secure architecture is working:

1. Ensure all sensitive files are properly gitignored
2. Test that scripts work with environment variables
3. Verify that scripts fail gracefully when required variables are missing
4. Confirm that no sensitive data appears in git history

## Future Improvements

1. Implement secret management integration (HashiCorp Vault, AWS Secrets Manager)
2. Add configuration validation tools
3. Create automated security scanning for sensitive data
4. Implement secure credential rotation tools