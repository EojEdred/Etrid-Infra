#!/bin/bash

# Ëtrid Codebase Cleanup Script
# Removes bloat from old chain iterations

set -e

cd ~/Desktop/etrid

echo "═══════════════════════════════════════════════════════════"
echo "Ëtrid Codebase Cleanup - Removing Old Iteration Files"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Create archive directories
echo "Creating archive directories..."
mkdir -p archive/old-iterations/aidevs
mkdir -p docs/governance
echo "✅ Directories created"
echo ""

# Move GRANDPA files
echo "Moving old GRANDPA consensus files..."
mv GRANDPA_*.md archive/old-iterations/ 2>/dev/null || true
mv verify-grandpa-upgrade.sh archive/old-iterations/ 2>/dev/null || true
echo "✅ GRANDPA files archived"

# Move V26 files
echo "Moving old V26 documentation..."
mv V26_*.md archive/old-iterations/ 2>/dev/null || true
echo "✅ V26 files archived"

# Move implementation summaries
echo "Moving old implementation summaries..."
mv CHECKPOINT_*.md archive/old-iterations/ 2>/dev/null || true
mv STUCK_DETECTION*.md archive/old-iterations/ 2>/dev/null || true
mv PEER_WHITELISTING_IMPLEMENTATION_SUMMARY.md archive/old-iterations/ 2>/dev/null || true
mv ASF_P2P_IMPLEMENTATION_SUMMARY.md archive/old-iterations/ 2>/dev/null || true
echo "✅ Implementation summaries archived"

# Move deployment docs
echo "Moving old deployment documentation..."
mv DEPLOYMENT_*.md archive/old-iterations/ 2>/dev/null || true
mv CURRENT_DEPLOYMENT_STATUS.md archive/old-iterations/ 2>/dev/null || true
mv deploy-testnet-checkpoint-finality.sh archive/old-iterations/ 2>/dev/null || true
mv deploy_val1_manual.sh archive/old-iterations/ 2>/dev/null || true
echo "✅ Deployment docs archived"

# Move handoff/migration docs
echo "Moving handoff and migration documentation..."
mv flarechain_asf_handoff.md archive/old-iterations/ 2>/dev/null || true
mv EXACT_CODE_CHANGES.md archive/old-iterations/ 2>/dev/null || true
mv CODE_REFERENCE_ASF_P2P_INTEGRATION.md archive/old-iterations/ 2>/dev/null || true
mv P2P_MESSAGE_STREAM_IMPLEMENTATION.md archive/old-iterations/ 2>/dev/null || true
mv TEST_RESULTS_EXPLAINED.md archive/old-iterations/ 2>/dev/null || true
echo "✅ Migration docs archived"

# Move today's governance docs to proper location
echo "Moving governance documentation to docs/governance/..."
mv DIRECTOR_GENESIS_CONFIGURATION_GUIDE.md docs/governance/ 2>/dev/null || true
mv REAL_DIRECTORS_GENESIS_CONFIG.md docs/governance/ 2>/dev/null || true
mv CRITICAL_VALIDATOR_DIRECTOR_ANALYSIS.md docs/governance/ 2>/dev/null || true
echo "✅ Governance docs organized"

# Clean up aidevs bloat
echo "Cleaning up AI Devs documentation bloat..."
cd 14-aidevs/docs
mv *SUMMARY*.md ../../archive/old-iterations/aidevs/ 2>/dev/null || true
mv *COMPLETE*.md ../../archive/old-iterations/aidevs/ 2>/dev/null || true
mv SESSION_*.md ../../archive/old-iterations/aidevs/ 2>/dev/null || true
cd ../..
echo "✅ AI Devs docs cleaned"

# Update .gitignore
echo "Updating .gitignore..."
if ! grep -q "^archive/" .gitignore 2>/dev/null; then
    echo "archive/" >> .gitignore
fi
if ! grep -q "^.secrets/" .gitignore 2>/dev/null; then
    echo ".secrets/" >> .gitignore
fi
echo "✅ .gitignore updated"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "Cleanup Complete!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Summary:"
echo "  - Old GRANDPA files archived"
echo "  - Old V26 documentation archived"
echo "  - Implementation summaries archived"
echo "  - Deployment documentation archived"
echo "  - Migration docs archived"
echo "  - Governance docs organized to docs/governance/"
echo "  - AI Devs bloat cleaned"
echo "  - .gitignore updated"
echo ""
echo "Archived files location: ~/Desktop/etrid/archive/old-iterations/"
echo ""
echo "✅ Codebase is now clean!"
