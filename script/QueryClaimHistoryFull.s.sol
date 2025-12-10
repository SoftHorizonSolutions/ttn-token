// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../contracts/TTNVestingManager.sol";

/**
 * @title QueryClaimHistoryFull
 * @notice Foundry script to query all TokensReleased events using cast logs via FFI
 * 
 * Usage:
 *   forge script script/QueryClaimHistoryFull.s.sol:QueryClaimHistoryFull --rpc-url $BASE_RPC_URL
 * 
 * Environment variables:
 *   VESTING_MANAGER_ADDRESS - Contract address (default: 0x70Ca23c7f2b72DdF40E909B72aB9B43A9b5eEf51)
 *   DEPLOYMENT_BLOCK - Starting block number (optional, will auto-detect if not set)
 *   CHUNK_SIZE - Block range per query (default: 10000)
 *   BASE_RPC_URL - Base Mainnet RPC URL
 */
contract QueryClaimHistoryFull is Script {
    address constant VESTING_MANAGER_PROXY = 0x70Ca23c7f2b72DdF40E909B72aB9B43A9b5eEf51;
    bytes32 constant EVENT_TOPIC = 0xa6c812047c4dc10f52f9e7943b1b3dfafae864d5e0d4ded081bbbde69dd6ff0d;
    uint256 constant DEFAULT_CHUNK_SIZE = 10000;
    
    struct ClaimEvent {
        uint256 scheduleId;
        address beneficiary;
        uint256 amount;
        uint256 blockNumber;
        bytes32 transactionHash;
    }
    
    function run() external {
        address vestingAddress = vm.envOr("VESTING_MANAGER_ADDRESS", VESTING_MANAGER_PROXY);
        string memory rpcUrl = vm.envOr("BASE_RPC_URL", string("https://base-mainnet.g.alchemy.com/v2/egiIx6XhC4WtmHI_y0Cbm"));
        uint256 chunkSize = vm.envOr("CHUNK_SIZE", DEFAULT_CHUNK_SIZE);
        
        console.log("Starting claim history query using Foundry...\n");
        console.log("Contract address:", vestingAddress);
        console.log("RPC URL:", rpcUrl);
        console.log("Chunk size:", chunkSize);
        console.log("");
        
        // Get current block
        uint256 currentBlock = block.number;
        console.log("Current block number:", currentBlock);
        
        // Get deployment block
        uint256 fromBlock;
        bool hasDeploymentBlock = vm.envOr("DEPLOYMENT_BLOCK", bytes32(0)) != bytes32(0);
        if (hasDeploymentBlock) {
            fromBlock = vm.envUint("DEPLOYMENT_BLOCK");
            console.log("Using deployment block from env:", fromBlock);
        } else {
            console.log("Finding deployment block...");
            fromBlock = findDeploymentBlock(vestingAddress, rpcUrl, currentBlock);
            console.log("Found deployment block:", fromBlock);
        }
        
        console.log("");
        console.log("Querying TokensReleased events from block", fromBlock, "to", currentBlock);
        console.log("Total blocks to query:", currentBlock - fromBlock);
        console.log("Total chunks:", (currentBlock - fromBlock + chunkSize - 1) / chunkSize);
        console.log("");
        
        // Query events in chunks (saves to file)
        queryEventsInChunks(
            vestingAddress,
            rpcUrl,
            fromBlock,
            currentBlock,
            chunkSize
        );
        
        // Output completion message
        console.log("");
        console.log("Query completed!");
        console.log("");
        console.log("The events have been saved to claim-events-raw.json");
        console.log("Use jq or other tools to process the JSON file.");
    }
    
    function findDeploymentBlock(
        address contractAddress,
        string memory rpcUrl,
        uint256 currentBlock
    ) internal returns (uint256) {
        // Binary search for deployment block
        uint256 low = 0;
        uint256 high = currentBlock;
        uint256 deploymentBlock = high;
        
        // Quick check: contract exists at current block?
        string[] memory checkInputs = new string[](7);
        checkInputs[0] = "cast";
        checkInputs[1] = "code";
        checkInputs[2] = vm.toString(contractAddress);
        checkInputs[3] = "--rpc-url";
        checkInputs[4] = rpcUrl;
        checkInputs[5] = "--block";
        checkInputs[6] = vm.toString(currentBlock);
        
        bytes memory checkResult = vm.ffi(checkInputs);
        string memory code = string(checkResult);
        
        if (keccak256(bytes(code)) == keccak256(bytes("0x"))) {
            revert("Contract has no code at current block");
        }
        
        // Binary search (limit iterations to avoid gas issues)
        uint256 maxIterations = 50;
        uint256 iterations = 0;
        
        while (low <= high && iterations < maxIterations) {
            uint256 mid = (low + high) / 2;
            iterations++;
            
            string[] memory inputs = new string[](7);
            inputs[0] = "cast";
            inputs[1] = "code";
            inputs[2] = vm.toString(contractAddress);
            inputs[3] = "--rpc-url";
            inputs[4] = rpcUrl;
            inputs[5] = "--block";
            inputs[6] = vm.toString(mid);
            
            bytes memory result = vm.ffi(inputs);
            string memory contractCode = string(result);
            
            if (keccak256(bytes(contractCode)) != keccak256(bytes("0x"))) {
                deploymentBlock = mid;
                if (mid == 0) break;
                high = mid - 1;
            } else {
                low = mid + 1;
            }
        }
        
        return deploymentBlock;
    }
    
    function queryEventsInChunks(
        address contractAddress,
        string memory rpcUrl,
        uint256 fromBlock,
        uint256 toBlock,
        uint256 chunkSize
    ) internal {
        uint256 totalChunks = (toBlock - fromBlock + chunkSize - 1) / chunkSize;
        uint256 chunkNum = 0;
        uint256 currentFrom = fromBlock;
        uint256 totalEventsFound = 0;
        string memory outputFile = "claim-events-raw.json";
        
        // Initialize output file with empty array
        vm.writeFile(outputFile, "[]");
        
        console.log("Saving results to:", outputFile);
        console.log("");
        
        while (currentFrom < toBlock) {
            uint256 currentTo = currentFrom + chunkSize - 1;
            if (currentTo > toBlock) {
                currentTo = toBlock;
            }
            
            chunkNum++;
            
            // Query this chunk and append to file
            string[] memory inputs = new string[](11);
            inputs[0] = "bash";
            inputs[1] = "-c";
            inputs[2] = string.concat(
                "cast logs --from-block ", vm.toString(currentFrom),
                " --to-block ", vm.toString(currentTo),
                " --address ", vm.toString(contractAddress),
                " --rpc-url ", rpcUrl,
                " ", vm.toString(EVENT_TOPIC),
                " 2>/dev/null || echo '[]'"
            );
            
            try vm.ffi(inputs) returns (bytes memory result) {
                string memory jsonResult = string(result);
                
                // Check if we got results
                if (bytes(jsonResult).length > 2 && keccak256(bytes(jsonResult)) != keccak256(bytes("[]"))) {
                    // Count events (rough estimate)
                    uint256 eventsInChunk = countEventsInJson(jsonResult);
                    totalEventsFound += eventsInChunk;
                    
                    if (eventsInChunk > 0) {
                        string memory chunkMsg = string.concat(
                            "   Chunk ", vm.toString(chunkNum), "/", vm.toString(totalChunks),
                            " (blocks ", vm.toString(currentFrom), "-", vm.toString(currentTo),
                            "): ", vm.toString(eventsInChunk), " events"
                        );
                        console.log(chunkMsg);
                        
                        // Merge JSON arrays using jq if available, otherwise append
                        string[] memory mergeInputs = new string[](3);
                        mergeInputs[0] = "bash";
                        mergeInputs[1] = "-c";
                        mergeInputs[2] = string.concat(
                            "jq -s 'add' ", outputFile, " <(echo '", jsonResult, "') > ", outputFile, ".tmp && mv ", outputFile, ".tmp ", outputFile, " 2>/dev/null || echo '", jsonResult, "' >> ", outputFile
                        );
                        vm.ffi(mergeInputs);
                    } else {
                        if (chunkNum % 50 == 0 || currentTo >= toBlock) {
                            string memory noEventsMsg = string.concat(
                                "   Chunk ", vm.toString(chunkNum), "/", vm.toString(totalChunks),
                                " (blocks ", vm.toString(currentFrom), "-", vm.toString(currentTo), "): no events"
                            );
                            console.log(noEventsMsg);
                        }
                    }
                } else {
                    if (chunkNum % 50 == 0 || currentTo >= toBlock) {
                        string memory noEventsMsg = string.concat(
                            "   Chunk ", vm.toString(chunkNum), "/", vm.toString(totalChunks),
                            " (blocks ", vm.toString(currentFrom), "-", vm.toString(currentTo), "): no events"
                        );
                        console.log(noEventsMsg);
                    }
                }
            } catch {
                string memory failMsg = string.concat(
                    "   Chunk ", vm.toString(chunkNum), "/", vm.toString(totalChunks), ": query failed"
                );
                console.log(failMsg);
            }
            
            currentFrom = currentTo + 1;
        }
        
        console.log("");
        console.log("Total events found:", totalEventsFound);
        console.log("Full event data saved to:", outputFile);
        console.log("");
        console.log("To process the JSON file, use:");
        console.log("   jq 'length'", outputFile, "- total events");
        console.log("   jq '[.[].topics[1]] | unique | length'", outputFile, "- unique beneficiaries");
    }
    
    function countEventsInJson(string memory json) internal pure returns (uint256) {
        // Count events by looking for "address" field in topics (each event has topics array)
        bytes memory jsonBytes = bytes(json);
        uint256 count = 0;
        
        // Look for pattern: "topics": [ which appears once per event
        for (uint256 i = 0; i < jsonBytes.length - 8; i++) {
            if (jsonBytes[i] == '"' && 
                jsonBytes[i+1] == 't' && 
                jsonBytes[i+2] == 'o' && 
                jsonBytes[i+3] == 'p' &&
                jsonBytes[i+4] == 'i' &&
                jsonBytes[i+5] == 'c' &&
                jsonBytes[i+6] == 's' &&
                jsonBytes[i+7] == '"') {
                count++;
            }
        }
        
        return count;
    }
}

