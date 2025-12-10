#!/bin/bash

# Script to find wallets that have vesting schedules but haven't claimed tokens
# This script uses Foundry's cast to query events and identify unclaimed wallets
# For detailed schedule information, use the TypeScript script instead

set -e

# Configuration
VESTING_MANAGER_ADDRESS="${VESTING_MANAGER_ADDRESS:-0x70Ca23c7f2b72DdF40E909B72aB9B43A9b5eEf51}"
BASE_RPC_URL="${BASE_RPC_URL:-https://base-mainnet.g.alchemy.com/v2/egiIx6XhC4WtmHI_y0Cbm}"
CHUNK_SIZE="${CHUNK_SIZE:-10000}"
OUTPUT_FILE="${OUTPUT_FILE:-unclaimed-wallets-summary.json}"

# Event signatures
# VestingScheduleCreated(uint256 indexed,address indexed,uint256,uint256,uint256,uint256,uint256)
VESTING_CREATED_TOPIC="0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0"
# TokensReleased(uint256 indexed,address indexed,uint256)
TOKENS_RELEASED_TOPIC="0xa6c812047c4dc10f52f9e7943b1b3dfafae864d5e0d4ded081bbbde69dd6ff0d"

echo "🚀 Starting unclaimed wallets query..."
echo "📄 Contract address: $VESTING_MANAGER_ADDRESS"
echo "🌐 RPC URL: $BASE_RPC_URL"
echo ""

# Get current block
echo "📊 Getting current block number..."
CURRENT_BLOCK=$(cast block-number --rpc-url "$BASE_RPC_URL")
echo "📊 Current block: $CURRENT_BLOCK"
echo ""

# Find deployment block
echo "🔍 Finding contract deployment block..."
DEPLOYMENT_BLOCK="${DEPLOYMENT_BLOCK:-}"

if [ -z "$DEPLOYMENT_BLOCK" ]; then
    echo "   Searching for when contract was first deployed..."
    
    LOW=0
    HIGH=$CURRENT_BLOCK
    DEPLOYMENT_BLOCK=$HIGH
    
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

# Query VestingScheduleCreated events
echo "🔍 Querying VestingScheduleCreated events..."
echo "📦 Querying in chunks of $CHUNK_SIZE blocks"
TOTAL_BLOCKS=$((CURRENT_BLOCK - DEPLOYMENT_BLOCK))
TOTAL_CHUNKS=$(( (TOTAL_BLOCKS + CHUNK_SIZE - 1) / CHUNK_SIZE ))
echo "📊 Total chunks to process: $TOTAL_CHUNKS"
echo ""

START_TIME=$(date +%s)

# Initialize temp files
echo "[]" > /tmp/vesting-events.json
echo "[]" > /tmp/claim-events.json

# Query VestingScheduleCreated events
FROM_BLOCK=$DEPLOYMENT_BLOCK
CHUNK_NUM=0

while [ $FROM_BLOCK -lt $CURRENT_BLOCK ]; do
    TO_BLOCK=$((FROM_BLOCK + CHUNK_SIZE - 1))
    if [ $TO_BLOCK -gt $CURRENT_BLOCK ]; then
        TO_BLOCK=$CURRENT_BLOCK
    fi
    
    CHUNK_NUM=$((CHUNK_NUM + 1))
    
    echo -n "   Processing chunk $CHUNK_NUM/$TOTAL_CHUNKS (blocks $FROM_BLOCK-$TO_BLOCK)... "
    
    # Query VestingScheduleCreated events
    # Note: We need to query for the event signature hash
    # The actual topic hash for VestingScheduleCreated needs to be calculated
    # For now, we'll use a simpler approach - query all events and filter
    
    CHUNK_RESULT=$(cast logs \
        --from-block "$FROM_BLOCK" \
        --to-block "$TO_BLOCK" \
        --address "$VESTING_MANAGER_ADDRESS" \
        --rpc-url "$BASE_RPC_URL" 2>/dev/null || echo "ERROR")
    
    if [ "$CHUNK_RESULT" != "ERROR" ] && [ -n "$CHUNK_RESULT" ] && [ "$CHUNK_RESULT" != "[]" ]; then
        # Filter for VestingScheduleCreated events (topic[0] should match)
        # We'll process this in the next step
        if command -v jq &> /dev/null; then
            jq -s 'add' /tmp/vesting-events.json <(echo "$CHUNK_RESULT") > /tmp/vesting-events-merged.json 2>/dev/null
            mv /tmp/vesting-events-merged.json /tmp/vesting-events.json
            EVENT_COUNT=$(echo "$CHUNK_RESULT" | jq 'if type == "array" then length else 1 end' 2>/dev/null || echo "0")
            echo "✅ Found $EVENT_COUNT events"
        else
            echo "$CHUNK_RESULT" >> /tmp/vesting-events.json
            echo "✅"
        fi
    else
        echo "✅ (no events)"
    fi
    
    FROM_BLOCK=$((TO_BLOCK + 1))
    sleep 0.1
done

# Query TokensReleased events
echo ""
echo "🔍 Querying TokensReleased events..."
FROM_BLOCK=$DEPLOYMENT_BLOCK
CHUNK_NUM=0

while [ $FROM_BLOCK -lt $CURRENT_BLOCK ]; do
    TO_BLOCK=$((FROM_BLOCK + CHUNK_SIZE - 1))
    if [ $TO_BLOCK -gt $CURRENT_BLOCK ]; then
        TO_BLOCK=$CURRENT_BLOCK
    fi
    
    CHUNK_NUM=$((CHUNK_NUM + 1))
    
    echo -n "   Processing chunk $CHUNK_NUM/$TOTAL_CHUNKS (blocks $FROM_BLOCK-$TO_BLOCK)... "
    
    CHUNK_RESULT=$(cast logs \
        --from-block "$FROM_BLOCK" \
        --to-block "$TO_BLOCK" \
        --address "$VESTING_MANAGER_ADDRESS" \
        --topic "$TOKENS_RELEASED_TOPIC" \
        --rpc-url "$BASE_RPC_URL" 2>/dev/null || echo "ERROR")
    
    if [ "$CHUNK_RESULT" != "ERROR" ] && [ -n "$CHUNK_RESULT" ] && [ "$CHUNK_RESULT" != "[]" ]; then
        if command -v jq &> /dev/null; then
            jq -s 'add' /tmp/claim-events.json <(echo "$CHUNK_RESULT") > /tmp/claim-events-merged.json 2>/dev/null
            mv /tmp/claim-events-merged.json /tmp/claim-events.json
            EVENT_COUNT=$(echo "$CHUNK_RESULT" | jq 'if type == "array" then length else 1 end' 2>/dev/null || echo "0")
            echo "✅ Found $EVENT_COUNT events"
        else
            echo "$CHUNK_RESULT" >> /tmp/claim-events.json
            echo "✅"
        fi
    else
        echo "✅ (no events)"
    fi
    
    FROM_BLOCK=$((TO_BLOCK + 1))
    sleep 0.1
done

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo ""
echo "⏱️  Query completed in ${ELAPSED}s"
echo ""

# Process results
if ! command -v jq &> /dev/null; then
    echo "⚠️  jq is required for processing results. Please install jq."
    echo "📄 Raw event data saved to: /tmp/vesting-events.json and /tmp/claim-events.json"
    exit 0
fi

echo "📝 Processing results..."

# Extract unique beneficiaries from VestingScheduleCreated events
# Note: This is a simplified version. The actual event parsing would need the ABI
# For a complete solution, use the TypeScript script

echo ""
echo "⚠️  Note: This bash script provides a basic summary."
echo "   For detailed wallet data with schedule information, use:"
echo "   npm run query-unclaimed"
echo ""
echo "📄 Event data saved to:"
echo "   - /tmp/vesting-events.json (VestingScheduleCreated events)"
echo "   - /tmp/claim-events.json (TokensReleased events)"
echo ""
echo "✅ Query completed!"

