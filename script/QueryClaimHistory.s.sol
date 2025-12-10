// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../contracts/TTNVestingManager.sol";

/**
 * @title QueryClaimHistory
 * @notice Foundry script to query TokensReleased events from deployment to current block
 * 
 * Usage:
 *   forge script script/QueryClaimHistory.s.sol:QueryClaimHistory --rpc-url $BASE_RPC_URL
 * 
 * Environment variables:
 *   VESTING_MANAGER_ADDRESS - Contract address (default: 0x70Ca23c7f2b72DdF40E909B72aB9B43A9b5eEf51)
 *   BASE_RPC_URL - Base Mainnet RPC URL
 */
contract QueryClaimHistory is Script {
    address constant VESTING_MANAGER_PROXY = 0x70Ca23c7f2b72DdF40E909B72aB9B43A9b5eEf51;
    
    function run() external view {
        address vestingAddress = vm.envOr("VESTING_MANAGER_ADDRESS", VESTING_MANAGER_PROXY);
        
        console.log("Starting claim history query...\n");
        console.log("Contract address:", vestingAddress);
        
        // Get current block
        uint256 currentBlock = block.number;
        console.log("Current block number:", currentBlock);
        
        // Get deployment block by finding first transaction to this address
        // We'll use a reasonable default or query from block 0
        uint256 fromBlock = 0;
        string memory deploymentBlockEnv = vm.envOr("DEPLOYMENT_BLOCK", string(""));
        if (bytes(deploymentBlockEnv).length > 0) {
            fromBlock = vm.envUint("DEPLOYMENT_BLOCK");
            console.log("Using deployment block from env:", fromBlock);
        } else {
            console.log("Querying from block 0 (use DEPLOYMENT_BLOCK env var to set specific block)");
        }
        
        console.log("\nTo query events, use the following cast command:");
        console.log("   cast logs --from-block", fromBlock, "--to-block latest");
        console.log("   --address", vestingAddress);
        console.log("   --topic 0xa6c812047c4dc10f52f9e7943b1b3dfafae864d5e0d4ded081bbbde69dd6ff0d");
        console.log("\n   Or use the helper script: ./scripts/query-claims.sh");
        console.log("\nEvent signature: TokensReleased(uint256 indexed,address indexed,uint256)");
        console.log("Event topic[0]: 0xa6c812047c4dc10f52f9e7943b1b3dfafae864d5e0d4ded081bbbde69dd6ff0d");
    }
}

