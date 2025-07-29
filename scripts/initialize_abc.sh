#!/bin/bash

# ABC Token Initialization Script
# This script helps you initialize the ABC token proxy contracts

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== ABC Token Initialization Script ===${NC}"

# Function to check if address is valid
check_address() {
    if [[ ! $1 =~ ^0x[a-fA-F0-9]{40}$ ]]; then
        echo -e "${RED}Error: Invalid address format: $1${NC}"
        exit 1
    fi
}

# Function to prompt for address
prompt_for_address() {
    local prompt="$1"
    local var_name="$2"
    local address
    
    while true; do
        read -p "$prompt: " address
        if [[ -z "$address" ]]; then
            echo -e "${YELLOW}Address cannot be empty. Please try again.${NC}"
            continue
        fi
        if check_address "$address"; then
            eval "$var_name=$address"
            break
        fi
    done
}

# Check if we're in the right directory
if [[ ! -f "foundry.toml" ]]; then
    echo -e "${RED}Error: Please run this script from the project root directory${NC}"
    exit 1
fi

# Check if environment variables are set
if [[ -z "$TOKEN_PROXY" || -z "$VAULT_PROXY" || -z "$VESTING_PROXY" ]]; then
    echo -e "${YELLOW}Environment variables not set. Please provide proxy addresses:${NC}"
    
    prompt_for_address "Enter ABCToken proxy address" TOKEN_PROXY
    prompt_for_address "Enter ABCTokenVault proxy address" VAULT_PROXY
    prompt_for_address "Enter ABCVestingManager proxy address" VESTING_PROXY
    
    # Optional admin address
    read -p "Enter admin address (press Enter to use deployer): " ADMIN
    if [[ -n "$ADMIN" ]]; then
        check_address "$ADMIN"
        export ADMIN
    fi
else
    echo -e "${GREEN}Using environment variables:${NC}"
    echo "TOKEN_PROXY: $TOKEN_PROXY"
    echo "VAULT_PROXY: $VAULT_PROXY"
    echo "VESTING_PROXY: $VESTING_PROXY"
    if [[ -n "$ADMIN" ]]; then
        echo "ADMIN: $ADMIN"
    fi
fi

# Validate addresses
check_address "$TOKEN_PROXY"
check_address "$VAULT_PROXY"
check_address "$VESTING_PROXY"
if [[ -n "$ADMIN" ]]; then
    check_address "$ADMIN"
fi

# Export variables
export TOKEN_PROXY
export VAULT_PROXY
export VESTING_PROXY

echo -e "\n${BLUE}=== Running Initialization Script ===${NC}"

# Run the Foundry script
forge script script/InitializeABC.s.sol:InitializeABCScript \
    --rpc-url $RPC_URL \
    --private-key $PRIVATE_KEY \
    --broadcast \
    --verify

echo -e "\n${GREEN}=== Initialization Complete ===${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Grant MANAGER_ROLE to VestingManager in TokenVault"
echo "2. Grant MANAGER_ROLE to desired managers in TokenVault"
echo "3. Grant MANAGER_ROLE to desired managers in VestingManager"
echo "4. Create allocations and vesting schedules" 