#!/bin/bash

# Check if fork exists
USERNAME="EojEdred"
echo "Checking if fork exists..."
echo ""

if curl -s -o /dev/null -w "%{http_code}" "https://github.com/$USERNAME/token-list" | grep -q "200"; then
    echo "✅ Fork exists at: https://github.com/$USERNAME/token-list"
    echo ""
    echo "You can now run the submission script!"
else
    echo "❌ Fork not found at: https://github.com/$USERNAME/token-list"
    echo ""
    echo "Please fork the repository:"
    echo "1. Go to: https://github.com/solana-labs/token-list"
    echo "2. Click the 'Fork' button (top right)"
    echo "3. Wait for it to complete (takes 5-10 seconds)"
    echo "4. You should see it at: https://github.com/$USERNAME/token-list"
fi
