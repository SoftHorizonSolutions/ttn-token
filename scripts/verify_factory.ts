import { ethers } from "hardhat";

async function main() {
  const factoryAddress = "FACTORY_ADDRESS_HERE"; // Replace with actual deployed address
  
  console.log("Verifying TTNTokenFactory...");
  
  try {
    await hre.run("verify:verify", {
      address: factoryAddress,
      contract: "contracts/TTNTokenFactory.sol:TTNTokenFactory",
      constructorArguments: [],
    });
    
    console.log("✅ Factory verified successfully!");
  } catch (error) {
    console.error("❌ Verification failed:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
