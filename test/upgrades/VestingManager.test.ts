import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { VestingManager, TokenVault, TTNToken } from "../../typechain-types";

// Role identifiers
const DEFAULT_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("DEFAULT_ADMIN_ROLE"));

describe("VestingManager Upgrades", function () {
  
  // Test accounts
  let owner: SignerWithAddress;
  let upgrader: SignerWithAddress;
  let vestingAdmin: SignerWithAddress;
  let beneficiary: SignerWithAddress;
  let user: SignerWithAddress;

  // Contract instances
  let vestingManager: VestingManager;
  let vault: TokenVault;
  let token: TTNToken;

  async function deployFixture() {
    [owner, upgrader, vestingAdmin, beneficiary, user] = await ethers.getSigners();

    // Deploy token
    const TTNToken = await ethers.getContractFactory("TTNToken");
    const token = await upgrades.deployProxy(TTNToken, [], { initializer: 'initialize' });
    await token.waitForDeployment();

    // Deploy vault
    const TokenVault = await ethers.getContractFactory("TokenVault");
    const vault = await upgrades.deployProxy(TokenVault, [await token.getAddress()], { initializer: 'initialize' });
    await vault.waitForDeployment();

    // Deploy vesting manager
    const VestingManager = await ethers.getContractFactory("VestingManager");
    const vestingManager = await upgrades.deployProxy(VestingManager, 
      [await token.getAddress(), await vault.getAddress(), owner.address], 
      { initializer: 'initialize' }
    );
    await vestingManager.waitForDeployment();

    // Grant roles
    const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
    await token.grantRole(MINTER_ROLE, await vault.getAddress());
    await token.grantRole(MINTER_ROLE, await vestingManager.getAddress());
    await vestingManager.grantRole(DEFAULT_ADMIN_ROLE, owner.address);

    return {vestingManager, vault, token, owner, upgrader, vestingAdmin, beneficiary, user };
  }

  beforeEach(async function () {
    ({ vestingManager, vault, token, owner, upgrader, vestingAdmin, beneficiary, user } = 
      await loadFixture(deployFixture));
  });

  describe("Upgrading", function () {
    it("Should allow upgrader to upgrade the contract", async function () {
      // Get V2 contract factory
      const VestingManagerV2 = await ethers.getContractFactory("TTNVestingManagerV2");
      
      // Upgrade to V2
      const upgraded = await upgrades.upgradeProxy(
        await vestingManager.getAddress(), 
        await VestingManagerV2.connect(owner)
      );
      await upgraded.initializeV2();
      
      // Verify new functionality
      expect(await upgraded.version()).to.equal(2);
    });

    it("Should not allow non-upgrader to upgrade the contract", async function () {
      // Get V2 contract factory
      const VestingManagerV2 = await ethers.getContractFactory("TTNVestingManagerV2");
      
      await expect(
        upgrades.upgradeProxy(await vestingManager.getAddress(), VestingManagerV2.connect(user))
      ).to.be.revertedWithCustomError(vestingManager, "AccessControlUnauthorizedAccount");
    });

    it("Should preserve state after upgrade", async function () {
      // Create a vesting schedule before upgrade
      const amount = ethers.parseEther("1000");
      const startTime = Math.floor(Date.now() / 1000) + 3600;
      const cliffDuration = 3600 * 24 * 30;
      const duration = 3600 * 24 * 365;

      const tx = await vestingManager.connect(owner).createVestingSchedule(
        beneficiary.address,
        amount,
        startTime,
        cliffDuration,
        duration,
        0
      );

      const receipt = await tx.wait();
      const event = receipt?.logs[0];
      const scheduleId = event?.topics[1] ? BigInt(event.topics[1]) : BigInt(0);

      // Get V2 contract factory
      const VestingManagerV2 = await ethers.getContractFactory("TTNVestingManagerV2");
      
      // Upgrade to V2
      const upgraded = await upgrades.upgradeProxy(await vestingManager.getAddress(), VestingManagerV2);
      await upgraded.initializeV2();
      
      // Verify state is preserved
      const schedule = await upgraded.getVestingSchedule(scheduleId);
      expect(schedule.beneficiary).to.equal(beneficiary.address);
      expect(schedule.totalAmount).to.equal(amount);
      expect(schedule.revoked).to.be.false;
    });

    it("Should not allow initializing V2 twice", async function () {
      // Get V2 contract factory
      const VestingManagerV2 = await ethers.getContractFactory("TTNVestingManagerV2");
      
      // Upgrade to V2
      const upgraded = await upgrades.upgradeProxy(await vestingManager.getAddress(), VestingManagerV2);
      await upgraded.initializeV2();
      
      // Try to initialize again
      await expect(
        upgraded.initializeV2()
      ).to.be.revertedWithCustomError(upgraded, "InvalidInitialization");
    });

    it("Should maintain access control after upgrade", async function () {
     
      // Get V2 contract factory
      const VestingManagerV2 = await ethers.getContractFactory("TTNVestingManagerV2");
      
      // Upgrade to V2
      const upgraded = await upgrades.upgradeProxy(await vestingManager.getAddress(), VestingManagerV2);
      await upgraded.initializeV2();
      
      
      // Verify roles are preserved in the vesting manager
      expect(await upgraded.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
    });

    it("Should not allow claiming tokens that are only allocated but not scheduled", async function () {
      // Create an allocation
      const amount = ethers.parseEther("1000");
      await vault.connect(owner).createAllocation(
        beneficiary.address,
        amount
      );

      // Try to claim tokens before creating a vesting schedule
      await expect(
        vestingManager.connect(beneficiary).claimVestedTokens(0) // Try to claim first schedule
      ).to.be.revertedWithCustomError(vestingManager, "InvalidScheduleId");

      // Verify beneficiary has no tokens
      expect(await token.balanceOf(beneficiary.address)).to.equal(0);
    });
  });
}); 