#!/bin/bash

# Script to query TokensReleased events using Foundry's cast
# This is much faster than chunking queries and automatically finds deployment block

set -e

# Configuration
VESTING_MANAGER_ADDRESS="${VESTING_MANAGER_ADDRESS:-0x70Ca23c7f2b72DdF40E909B72aB9B43A9b5eEf51}"
BASE_RPC_URL="${BASE_RPC_URL:-https://base-mainnet.g.alchemy.com/v2/egiIx6XhC4WtmHI_y0Cbm}"
CHUNK_SIZE="${CHUNK_SIZE:-10000}"  # Query in chunks to avoid RPC limits (Alchemy allows larger chunks)

# Event signature: TokensReleased(uint256 indexed,address indexed,uint256)
# Event topic[0] (keccak256 of signature)
EVENT_TOPIC="0xa6c812047c4dc10f52f9e7943b1b3dfafae864d5e0d4ded081bbbde69dd6ff0d"

echo "🚀 Starting claim history query using Foundry cast..."
echo "📄 Contract address: $VESTING_MANAGER_ADDRESS"
echo "🌐 RPC URL: $BASE_RPC_URL"
echo ""

# Get current block
echo "📊 Getting current block number..."
CURRENT_BLOCK=$(cast block-number --rpc-url "$BASE_RPC_URL")
echo "📊 Current block: $CURRENT_BLOCK"
echo ""

# Find deployment block by binary search (when contract first got code)
echo "🔍 Finding contract deployment block..."
DEPLOYMENT_BLOCK="${DEPLOYMENT_BLOCK:-}"

if [ -z "$DEPLOYMENT_BLOCK" ]; then
    echo "   Searching for when contract was first deployed..."
    
    # Binary search for deployment block
    LOW=0
    HIGH=$CURRENT_BLOCK
    DEPLOYMENT_BLOCK=$HIGH
    
    # Quick check: contract exists at current block?
    CODE=$(cast code "$VESTING_MANAGER_ADDRESS" --rpc-url "$BASE_RPC_URL" --block "$CURRENT_BLOCK" 2>/dev/null || echo "0x")
    
    if [ "$CODE" = "0x" ]; then
        echo "❌ Contract has no code at current block. Check the address."
        exit 1
    fi
    
    # Binary search for first block with code
    while [ $LOW -le $HIGH ]; do
        MID=$(( (LOW + HIGH) / 2 ))
        CODE=$(cast code "$VESTING_MANAGER_ADDRESS" --rpc-url "$BASE_RPC_URL" --block "$MID" 2>/dev/null || echo "0x")
        
        if [ "$CODE" != "0x" ]; then
            DEPLOYMENT_BLOCK=$MID
            HIGH=$((MID - 1))
        else
            LOW=$((MID + 1))
        fi
    done
    
    echo "✅ Found deployment block: $DEPLOYMENT_BLOCK"
else
    echo "📅 Using deployment block from env: $DEPLOYMENT_BLOCK"
fi

echo ""

# Query events using cast in chunks to avoid RPC limits
echo "🔍 Querying TokensReleased events from block $DEPLOYMENT_BLOCK to latest..."
echo "📦 Querying in chunks of $CHUNK_SIZE blocks (RPC limit)"
TOTAL_BLOCKS=$((CURRENT_BLOCK - DEPLOYMENT_BLOCK))
TOTAL_CHUNKS=$(( (TOTAL_BLOCKS + CHUNK_SIZE - 1) / CHUNK_SIZE ))
echo "📊 Total chunks to process: $TOTAL_CHUNKS"
echo "⏳ This may take a while for large block ranges..."
echo ""

START_TIME=$(date +%s)

# Initialize output file with empty array
echo "[]" > /tmp/claim-events.json

# Query in chunks
CHUNK_NUM=0
FROM_BLOCK=$DEPLOYMENT_BLOCK

while [ $FROM_BLOCK -lt $CURRENT_BLOCK ]; do
    TO_BLOCK=$((FROM_BLOCK + CHUNK_SIZE - 1))
    if [ $TO_BLOCK -gt $CURRENT_BLOCK ]; then
        TO_BLOCK=$CURRENT_BLOCK
    fi
    
    CHUNK_NUM=$((CHUNK_NUM + 1))
    
    # Query this chunk
    echo -n "   Processing chunk $CHUNK_NUM/$TOTAL_CHUNKS (blocks $FROM_BLOCK-$TO_BLOCK)... "
    
    CHUNK_RESULT=$(cast logs \
        --from-block "$FROM_BLOCK" \
        --to-block "$TO_BLOCK" \
        --address "$VESTING_MANAGER_ADDRESS" \
        --rpc-url "$BASE_RPC_URL" \
        "$EVENT_TOPIC" 2>/dev/null || echo "ERROR")
    
    if [ "$CHUNK_RESULT" = "ERROR" ]; then
        echo "❌ Failed"
        echo "⚠️  Warning: Failed to query chunk $CHUNK_NUM. Continuing with next chunk..."
    else
        # Check if we got results
        if [ -n "$CHUNK_RESULT" ] && [ "$CHUNK_RESULT" != "[]" ]; then
            # Merge results into main file
            if command -v jq &> /dev/null; then
                # Use jq to merge arrays
                jq -s 'add' /tmp/claim-events.json <(echo "$CHUNK_RESULT") > /tmp/claim-events-merged.json 2>/dev/null
                mv /tmp/claim-events-merged.json /tmp/claim-events.json
                EVENT_COUNT_IN_CHUNK=$(echo "$CHUNK_RESULT" | jq 'if type == "array" then length else 1 end' 2>/dev/null || echo "0")
                echo "✅ Found $EVENT_COUNT_IN_CHUNK events"
            else
                # Fallback: append raw JSON (will need manual cleanup)
                echo "$CHUNK_RESULT" >> /tmp/claim-events.json
                echo "✅"
            fi
        else
            echo "✅ (no events)"
        fi
    fi
    
    # Progress update every 50 chunks or on last chunk
    if [ $((CHUNK_NUM % 50)) -eq 0 ] || [ $TO_BLOCK -ge $CURRENT_BLOCK ]; then
        ELAPSED_SO_FAR=$(($(date +%s) - START_TIME))
        PROGRESS=$(( (CHUNK_NUM * 100) / TOTAL_CHUNKS ))
        CURRENT_EVENTS=$(jq -r 'if type == "array" then length else 1 end' /tmp/claim-events.json 2>/dev/null || echo "0")
        echo "   📊 Progress: $PROGRESS% ($CHUNK_NUM/$TOTAL_CHUNKS chunks) - $CURRENT_EVENTS total events - ${ELAPSED_SO_FAR}s elapsed"
    fi
    
    FROM_BLOCK=$((TO_BLOCK + 1))
    
    # Small delay to avoid rate limiting
    sleep 0.1
done

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

# Count events
if [ ! -s /tmp/claim-events.json ]; then
    EVENT_COUNT=0
else
    EVENT_COUNT=$(jq -r 'if type == "array" then length else 1 end' /tmp/claim-events.json 2>/dev/null || echo "0")
fi

echo ""
echo "⏱️  Query completed in ${ELAPSED}s"
echo "✅ Found $EVENT_COUNT TokensReleased events"
echo ""

if [ "$EVENT_COUNT" -eq "0" ]; then
    echo "⚠️  No events found. This could mean:"
    echo "   1. No claims have been made yet"
    echo "   2. The contract address is incorrect"
    echo "   3. The query range is too narrow"
    echo ""
    echo "📄 Event data saved to: /tmp/claim-events.json"
    exit 0
fi

# Process events and calculate statistics
echo "📝 Processing events..."
echo ""

# Save summary
cat > /tmp/claim-summary.txt << EOF
================================================================================
📊 CLAIM HISTORY SUMMARY
================================================================================
Contract Address: $VESTING_MANAGER_ADDRESS
Deployment Block: $DEPLOYMENT_BLOCK
Current Block: $CURRENT_BLOCK
Query Range: $((CURRENT_BLOCK - DEPLOYMENT_BLOCK)) blocks
Query Time: ${ELAPSED}s

Total Claims: $EVENT_COUNT
================================================================================

Full event data saved to: /tmp/claim-events.json

To process the data further, you can use:
  jq '.[] | {blockNumber, transactionHash, topics, data}' /tmp/claim-events.json

To get unique beneficiaries:
  jq '[.[].topics[1]] | unique | length' /tmp/claim-events.json

EOF

cat /tmp/claim-summary.txt

echo ""
echo "✅ Query completed successfully!"
echo "📄 Full event data: /tmp/claim-events.json"
echo "📄 Summary: /tmp/claim-summary.txt"
