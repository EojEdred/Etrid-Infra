# ËTRID Configuration Templates

This directory contains configuration templates that can be used to set up your ËTRID environment securely.

## Available Templates

- `.env.example`: Environment variables template
- `validator-config.json`: Validator configuration template

## Usage Instructions

### Environment Variables

1. Copy `.env.example` to a secure location outside the repository:
   ```bash
   cp config/templates/.env.example config/secure/.env.secure
   ```

2. Edit the copied file with your actual values:
   ```bash
   nano config/secure/.env.secure
   ```

3. Set the `CONFIG_FILE` environment variable when running scripts:
   ```bash
   export CONFIG_FILE="./config/secure/.env.secure"
   ```

### Validator Configuration

The `validator-config.json` file contains structured data for validators, attesters, and other network components. You can customize this file based on your deployment requirements.

## Security Notes

- Never commit files with actual secrets to the repository
- Store sensitive configuration files in the `config/secure/` directory (gitignored)
- Use environment variables for runtime configuration
- Regularly rotate sensitive keys and credentials