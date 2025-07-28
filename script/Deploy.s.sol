// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../contracts/TTNToken.sol";
import "../contracts/TTNTokenVault.sol";
import "../contracts/TTNVestingManager.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployScript is Script {
    function run() external {
        
        vm.startBroadcast();

        // Deploy implementation contracts
        TTNToken tokenImpl = new TTNToken();
        TokenVault vaultImpl = new TokenVault();
        VestingManager vestingImpl = new VestingManager();

        console.log("Implementation contracts deployed:");
        console.log("TTNToken implementation:", address(tokenImpl));
        console.log("TTNTokenVault implementation:", address(vaultImpl));
        console.log("TTNVestingManager implementation:", address(vestingImpl));

        // Deploy proxy contracts
        // Get deployer address from the broadcast
        address deployer = msg.sender;
        bytes memory initData = abi.encodeWithSelector(
            TTNToken.initialize.selector,
            "TTN Token",           // name
            "TTN",                 // symbol
            18,                    // decimals
            1000000000 * 10**18,   // total supply (1 billion tokens)
            deployer // initial owner
        );

        ERC1967Proxy tokenProxy = new ERC1967Proxy(
            address(tokenImpl),
            initData
        );

        console.log("TTNToken proxy deployed at:", address(tokenProxy));

        // Deploy vault proxy
        bytes memory vaultInitData = abi.encodeWithSelector(
            TokenVault.initialize.selector,
            address(tokenProxy),   // token address
            deployer // owner
        );

        ERC1967Proxy vaultProxy = new ERC1967Proxy(
            address(vaultImpl),
            vaultInitData
        );

        console.log("TTNTokenVault proxy deployed at:", address(vaultProxy));

        // Deploy vesting manager proxy
        bytes memory vestingInitData = abi.encodeWithSelector(
            VestingManager.initialize.selector,
            address(tokenProxy),   // token address
            address(vaultProxy),   // vault address
            deployer // owner
        );

        ERC1967Proxy vestingProxy = new ERC1967Proxy(
            address(vestingImpl),
            vestingInitData
        );

        console.log("TTNVestingManager proxy deployed at:", address(vestingProxy));

        bytes32 DEFAULT_ADMIN_ROLE = 0x00;
        TTNToken(address(tokenProxy)).grantRole(DEFAULT_ADMIN_ROLE, address(vaultProxy));
        TTNToken(address(tokenProxy)).grantRole(DEFAULT_ADMIN_ROLE, address(vestingProxy));

        vm.stopBroadcast();

        console.log("\n=== DEPLOYMENT SUMMARY ===");
        console.log("Network: Base Sepolia");
        console.log("Deployer:", deployer);
        console.log("\nImplementation Addresses:");
        console.log("TTNToken:", address(tokenImpl));
        console.log("TTNTokenVault:", address(vaultImpl));
        console.log("TTNVestingManager:", address(vestingImpl));
        console.log("\nProxy Addresses:");
        console.log("TTNToken:", address(tokenProxy));
        console.log("TTNTokenVault:", address(vaultProxy));
        console.log("TTNVestingManager:", address(vestingProxy));

        // These are the addresses you verify on Basescan
        console.log("TTNToken Implementation:", address(tokenImpl));
        console.log("TokenVault Implementation:", address(vaultImpl));
        console.log("VestingManager Implementation:", address(vestingImpl));

        // These are the addresses users interact with
        console.log("TTNToken Proxy:", address(tokenProxy));
        console.log("TokenVault Proxy:", address(vaultProxy));
        console.log("VestingManager Proxy:", address(vestingProxy));
    }
} 