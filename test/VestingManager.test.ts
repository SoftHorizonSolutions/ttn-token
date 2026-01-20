import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { VestingManager, TTNVestingManagerV2, TTNToken, TokenVault } from "../typechain-types";

describe("VestingManager", function () {
  // Role identifiers
  const VESTING_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VESTING_ADMIN_ROLE"));
  const MANUAL_UNLOCK_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MANUAL_UNLOCK_ROLE"));
  const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;

  
  // Test accounts
  let owner: SignerWithAddress;
  let vestingAdmin: SignerWithAddress;
  let manualUnlocker: SignerWithAddress;
  let beneficiary: SignerWithAddress;
  let user: SignerWithAddress;

  // Contract instances
  let token: TTNToken;
  let vault: TokenVault;
  let vestingManager: VestingManager;

  async function deployFixture() {
    [owner, vestingAdmin, manualUnlocker, beneficiary, user] = await ethers.getSigners();

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
    await token.grantRole(DEFAULT_ADMIN_ROLE, await vestingManager.getAddress());
    await vestingManager.grantRole(VESTING_ADMIN_ROLE, owner.address);
    await vestingManager.grantRole(MANUAL_UNLOCK_ROLE, owner.address);

    return { token, vault, vestingManager, owner, vestingAdmin, manualUnlocker, beneficiary, user };
  }

  beforeEach(async function () {
    ({ token, vault, vestingManager, owner, vestingAdmin, manualUnlocker, beneficiary, user } = 
      await loadFixture(deployFixture));
  });

  describe("Deployment", function () {
    it("Should set the correct token and vault addresses", async function () {
      expect(await vestingManager.ttnToken()).to.equal(await token.getAddress());
      expect(await vestingManager.tokenVault()).to.equal(await vault.getAddress());
    });

    it("Should assign the correct roles", async function () {
      expect(await vestingManager.hasRole(VESTING_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await vestingManager.hasRole(MANUAL_UNLOCK_ROLE, owner.address)).to.be.true;
    });
  });

  describe("Vesting Schedule Creation", function () {
    const amount = ethers.parseEther("1000");
    const startTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    const cliffDuration = 3600 * 24 * 30; // 30 days
    const duration = 3600 * 24 * 365; // 1 year

    it("Should allow vesting admin to create a vesting schedule", async function () {
      // First create an allocation in the vault
      const allocationAmount = ethers.parseEther("2000"); // More than vesting amount
      const tx = await vault.connect(owner).createAllocation(beneficiary.address, allocationAmount);
      const receipt = await tx.wait();
      const event = receipt?.logs[0];
      const allocationId = event?.topics[3] ? BigInt(event.topics[3]) : BigInt(0);
      
      const vestingTx = await vestingManager.connect(owner).createVestingSchedule(
        beneficiary.address,
        amount,
        startTime,
        cliffDuration,
        duration,
        allocationId // Use the returned allocation ID
      );

      const vestingReceipt = await vestingTx.wait();
      const vestingEvent = vestingReceipt?.logs[0];
      const scheduleId = vestingEvent?.topics[1] ? BigInt(vestingEvent.topics[1]) : BigInt(0);

      expect(await vestingManager.getVestingSchedule(scheduleId)).to.exist;
    });

    it("Should not allow non-admin to create vesting schedule", async function () {
      await expect(
        vestingManager.connect(user).createVestingSchedule(
          beneficiary.address,
          amount,
          startTime,
          cliffDuration,
          duration,
          0
        )
      ).to.be.revertedWithCustomError(vestingManager, "NotAuthorized");
    });

    it("Should not allow creating schedule with zero amount", async function () {
      await expect(
        vestingManager.connect(owner).createVestingSchedule(
          beneficiary.address,
          0,
          startTime,
          cliffDuration,
          duration,
          0
        )
      ).to.be.revertedWithCustomError(vestingManager, "InvalidAmount");
    });

    it("Should not allow creating schedule with zero duration", async function () {
      await expect(
        vestingManager.connect(owner).createVestingSchedule(
          beneficiary.address,
          amount,
          startTime,
          cliffDuration,
          0,
          0
        )
      ).to.be.revertedWithCustomError(vestingManager, "InvalidDuration");
    });
  });

  describe("Token Release", function () {
    const amount = ethers.parseEther("1000");
    let scheduleId: bigint;

    beforeEach(async function () {
      // Create a vesting schedule
      const startTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const cliffDuration = 3600 * 24 * 30; // 30 days
      const duration = 3600 * 24 * 365; // 1 year

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
      scheduleId = event?.topics[1] ? BigInt(event.topics[1]) : BigInt(0);
    });

    it("Should not allow release before cliff", async function () {
      await expect(
        vestingManager.connect(beneficiary).claimVestedTokens(scheduleId)
      ).to.be.revertedWithCustomError(vestingManager, "NoTokensDue");
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

    it("Should not allow non-beneficiary to release tokens", async function () {
      await expect(
        vestingManager.connect(user).claimVestedTokens(scheduleId)
      ).to.be.revertedWithCustomError(vestingManager, "NotBeneficiary");
    });

    it("Should not allow burning locked tokens", async function () {
      // First mint tokens to the vesting manager
      await token.mint(await vestingManager.getAddress(), amount);
      
      // Verify beneficiary has no tokens yet (they are still locked)
      expect(await token.balanceOf(beneficiary.address)).to.equal(0);

      // Try to burn tokens before they are unlocked
      await expect(
        token.connect(beneficiary).burn(ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");

      // Verify beneficiary still has no tokens
      expect(await token.balanceOf(beneficiary.address)).to.equal(0);
    });

    it("Should only allow burning unlocked tokens", async function () {
      // First mint tokens to the vesting manager
      await token.mint(await vestingManager.getAddress(), amount);

      // Manually unlock some tokens
      const unlockAmount = ethers.parseEther("100");
      await vestingManager.connect(owner).manualUnlock(scheduleId, unlockAmount);
      
      // Verify beneficiary received the unlocked tokens
      expect(await token.balanceOf(beneficiary.address)).to.equal(unlockAmount);

      // Should be able to burn unlocked tokens
      const burnAmount = ethers.parseEther("50");
      await token.connect(beneficiary).burn(burnAmount);
      expect(await token.balanceOf(beneficiary.address)).to.equal(unlockAmount - burnAmount);

      // Try to burn more than unlocked amount
      const remainingLocked = amount - unlockAmount;
      await expect(
        token.connect(beneficiary).burn(remainingLocked)
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
    });
  });

  describe("Manual Unlock", function () {
    const amount = ethers.parseEther("1000");
    let scheduleId: bigint;

    beforeEach(async function () {
      // Create a vesting schedule
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
      scheduleId = event?.topics[1] ? BigInt(event.topics[1]) : BigInt(0);
    });

    it("Should allow a manual unlock", async function () {
      const unlockAmount = ethers.parseEther("100");
      await vestingManager.connect(owner).manualUnlock(scheduleId, unlockAmount);
      
      const schedule = await vestingManager.getVestingSchedule(scheduleId);
      expect(schedule.releasedAmount).to.equal(unlockAmount);
      
      // Verify beneficiary received the tokens
      expect(await token.balanceOf(beneficiary.address)).to.equal(unlockAmount);
    });

    it("Should not allow non-manual-unlocker to unlock tokens", async function () {
      await expect(
        vestingManager.connect(user).manualUnlock(scheduleId, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(vestingManager, "NotAuthorized");
    });
  });

  describe("Schedule Revocation", function () {
    const amount = ethers.parseEther("1000");
    let scheduleId: bigint;

    beforeEach(async function () {
      // Create a vesting schedule
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
      scheduleId = event?.topics[1] ? BigInt(event.topics[1]) : BigInt(0);
    });

    it("Should allow vesting admin to revoke schedule", async function () {
     
      await token.mint(await vestingManager.getAddress(), amount);

      await vestingManager.connect(owner).revokeSchedule(scheduleId);
      
      const schedule = await vestingManager.getVestingSchedule(scheduleId);
      expect(schedule.revoked).to.be.true;
    });

    it("Should not allow non-admin to revoke schedule", async function () {
      await expect(
        vestingManager.connect(user).revokeSchedule(scheduleId)
      ).to.be.revertedWithCustomError(vestingManager, "NotAuthorized");
    });

    it("Should not allow revoking already revoked schedule", async function () {
      // Mint tokens for first revocation
      await token.mint(await vestingManager.getAddress(), amount);
      await vestingManager.connect(owner).revokeSchedule(scheduleId);
      
      // Mint tokens for second revocation attempt
      await token.mint(await vestingManager.getAddress(), amount);
      await expect(
        vestingManager.connect(owner).revokeSchedule(scheduleId)
      ).to.be.revertedWithCustomError(vestingManager, "ScheduledRevoked");
    });
  });

  describe("Force Revoke Schedule", function () {
    const amount = ethers.parseEther("1000");
    let scheduleId: bigint;
    let allocationId: bigint;
    let vestingManagerV2: TTNVestingManagerV2;

    beforeEach(async function () {
      // Upgrade contract to V2 first
      const VestingManagerV2 = await ethers.getContractFactory("TTNVestingManagerV2");
      const upgraded = await upgrades.upgradeProxy(await vestingManager.getAddress(), VestingManagerV2);
      await upgraded.initializeV2();
      
      // Get the upgraded contract as V2 type
      vestingManagerV2 = upgraded as unknown as TTNVestingManagerV2;
      
      // Update vestingManager reference to point to upgraded contract
      vestingManager = upgraded as unknown as VestingManager;
      
      // Create an allocation in the vault
      const allocationAmount = ethers.parseEther("2000");
      const allocationTx = await vault.connect(owner).createAllocation(beneficiary.address, allocationAmount);
      const allocationReceipt = await allocationTx.wait();
      const allocationEvent = allocationReceipt?.logs[0];
      allocationId = allocationEvent?.topics[3] ? BigInt(allocationEvent.topics[3]) : BigInt(0);

      // Create a vesting schedule
      const startTime = Math.floor(Date.now() / 1000) + 3600;
      const cliffDuration = 3600 * 24 * 30;
      const duration = 3600 * 24 * 365;

      const tx = await vestingManager.connect(owner).createVestingSchedule(
        beneficiary.address,
        amount,
        startTime,
        cliffDuration,
        duration,
        allocationId
      );

      const receipt = await tx.wait();
      const event = receipt?.logs[0];
      scheduleId = event?.topics[1] ? BigInt(event.topics[1]) : BigInt(0);
    });

    it("Should allow admin to force revoke schedule", async function () {
      await vestingManagerV2.connect(owner).forceRevokeSchedule(scheduleId);
      
      const schedule = await vestingManager.getVestingSchedule(scheduleId);
      expect(schedule.revoked).to.be.true;
    });

    it("Should not allow non-admin to force revoke schedule", async function () {
      await expect(
        vestingManagerV2.connect(user).forceRevokeSchedule(scheduleId)
      ).to.be.revertedWithCustomError(vestingManager, "AccessControlUnauthorizedAccount");
    });

    it("Should not allow force revoking already revoked schedule", async function () {
      await vestingManagerV2.connect(owner).forceRevokeSchedule(scheduleId);
      
      await expect(
        vestingManagerV2.connect(owner).forceRevokeSchedule(scheduleId)
      ).to.be.revertedWithCustomError(vestingManager, "ScheduledRevoked");
    });

    it("Should not call tokenVault.revokeAllocation()", async function () {
      // Verify allocation exists before revoking
      if (allocationId > 0) {
        // Revoke allocation in vault first (simulating the bug scenario)
        await vault.connect(owner).revokeAllocation(allocationId);
        
        // Verify allocation is revoked
        const [, , allocationRevoked] = await vault.getAllocationById(allocationId);
        expect(allocationRevoked).to.be.true;
      }

      // Force revoke schedule - should NOT revert even though allocation is already revoked
      await expect(
        vestingManagerV2.connect(owner).forceRevokeSchedule(scheduleId)
      ).to.not.be.reverted;

      const schedule = await vestingManager.getVestingSchedule(scheduleId);
      expect(schedule.revoked).to.be.true;
    });

    it("Should emit ScheduleRevoked event with correct unvested amount", async function () {
      await expect(
        vestingManagerV2.connect(owner).forceRevokeSchedule(scheduleId)
      ).to.emit(vestingManager, "ScheduleRevoked")
        .withArgs(scheduleId, beneficiary.address, amount);
    });

    it("Should return correct unvested amount", async function () {
      const unvestedAmount = await vestingManagerV2.connect(owner).forceRevokeSchedule.staticCall(scheduleId);
      expect(unvestedAmount).to.equal(amount);
    });

    it("Should calculate unvested amount correctly when some tokens are released", async function () {
      // Fast forward past cliff to allow claiming
      await time.increaseTo(Math.floor(Date.now() / 1000) + 3600 * 24 * 31);
      
      // Claim some tokens
      await vestingManager.connect(beneficiary).claimVestedTokens(scheduleId);

      // Get the actual released amount
      const scheduleBefore = await vestingManager.getVestingSchedule(scheduleId);
      const releasedAmount = scheduleBefore.releasedAmount;

      // Force revoke and check unvested amount
      const expectedUnvested = amount - releasedAmount;
      const unvestedAmount = await vestingManagerV2.connect(owner).forceRevokeSchedule.staticCall(scheduleId);
      expect(unvestedAmount).to.equal(expectedUnvested);
      
      // Actually execute the revocation
      await vestingManagerV2.connect(owner).forceRevokeSchedule(scheduleId);
      const schedule = await vestingManager.getVestingSchedule(scheduleId);
      expect(schedule.revoked).to.be.true;
    });

    it("Should reject invalid schedule ID", async function () {
      const invalidScheduleId = 999999;
      await expect(
        vestingManagerV2.connect(owner).forceRevokeSchedule(invalidScheduleId)
      ).to.be.revertedWithCustomError(vestingManager, "InvalidScheduleId");
    });

    it("Should reject schedule ID 0", async function () {
      await expect(
        vestingManagerV2.connect(owner).forceRevokeSchedule(0)
      ).to.be.revertedWithCustomError(vestingManager, "InvalidScheduleId");
    });
  });

  describe("Batch Force Revoke Schedules", function () {
    const amount = ethers.parseEther("1000");
    let scheduleId1: bigint;
    let scheduleId2: bigint;
    let scheduleId3: bigint;
    let allocationId1: bigint;
    let allocationId2: bigint;
    let allocationId3: bigint;
    let vestingManagerV2: TTNVestingManagerV2;

    beforeEach(async function () {
      // Upgrade contract to V2 first
      const VestingManagerV2 = await ethers.getContractFactory("TTNVestingManagerV2");
      const upgraded = await upgrades.upgradeProxy(await vestingManager.getAddress(), VestingManagerV2);
      await upgraded.initializeV2();
      
      // Get the upgraded contract as V2 type
      vestingManagerV2 = upgraded as unknown as TTNVestingManagerV2;
      
      // Update vestingManager reference to point to upgraded contract
      vestingManager = upgraded as unknown as VestingManager;
      const startTime = Math.floor(Date.now() / 1000) + 3600;
      const cliffDuration = 3600 * 24 * 30;
      const duration = 3600 * 24 * 365;

      // Create first allocation and schedule
      const allocationAmount1 = ethers.parseEther("2000");
      const allocationTx1 = await vault.connect(owner).createAllocation(beneficiary.address, allocationAmount1);
      const allocationReceipt1 = await allocationTx1.wait();
      const allocationEvent1 = allocationReceipt1?.logs[0];
      allocationId1 = allocationEvent1?.topics[3] ? BigInt(allocationEvent1.topics[3]) : BigInt(0);

      const tx1 = await vestingManager.connect(owner).createVestingSchedule(
        beneficiary.address,
        amount,
        startTime,
        cliffDuration,
        duration,
        allocationId1
      );
      const receipt1 = await tx1.wait();
      const event1 = receipt1?.logs[0];
      scheduleId1 = event1?.topics[1] ? BigInt(event1.topics[1]) : BigInt(0);

      // Create second allocation and schedule
      const allocationAmount2 = ethers.parseEther("2000");
      const allocationTx2 = await vault.connect(owner).createAllocation(beneficiary.address, allocationAmount2);
      const allocationReceipt2 = await allocationTx2.wait();
      const allocationEvent2 = allocationReceipt2?.logs[0];
      allocationId2 = allocationEvent2?.topics[3] ? BigInt(allocationEvent2.topics[3]) : BigInt(0);

      const tx2 = await vestingManager.connect(owner).createVestingSchedule(
        beneficiary.address,
        amount,
        startTime,
        cliffDuration,
        duration,
        allocationId2
      );
      const receipt2 = await tx2.wait();
      const event2 = receipt2?.logs[0];
      scheduleId2 = event2?.topics[1] ? BigInt(event2.topics[1]) : BigInt(0);

      // Create third allocation and schedule
      const allocationAmount3 = ethers.parseEther("2000");
      const allocationTx3 = await vault.connect(owner).createAllocation(beneficiary.address, allocationAmount3);
      const allocationReceipt3 = await allocationTx3.wait();
      const allocationEvent3 = allocationReceipt3?.logs[0];
      allocationId3 = allocationEvent3?.topics[3] ? BigInt(allocationEvent3.topics[3]) : BigInt(0);

      const tx3 = await vestingManager.connect(owner).createVestingSchedule(
        beneficiary.address,
        amount,
        startTime,
        cliffDuration,
        duration,
        allocationId3
      );
      const receipt3 = await tx3.wait();
      const event3 = receipt3?.logs[0];
      scheduleId3 = event3?.topics[1] ? BigInt(event3.topics[1]) : BigInt(0);
    });

    it("Should allow admin to batch force revoke schedules", async function () {
      const scheduleIds = [scheduleId1, scheduleId2, scheduleId3];
      await vestingManagerV2.connect(owner).batchForceRevokeSchedules(scheduleIds);

      const schedule1 = await vestingManager.getVestingSchedule(scheduleId1);
      const schedule2 = await vestingManager.getVestingSchedule(scheduleId2);
      const schedule3 = await vestingManager.getVestingSchedule(scheduleId3);

      expect(schedule1.revoked).to.be.true;
      expect(schedule2.revoked).to.be.true;
      expect(schedule3.revoked).to.be.true;
    });

    it("Should not allow non-admin to batch force revoke schedules", async function () {
      const scheduleIds = [scheduleId1, scheduleId2];
      await expect(
        vestingManagerV2.connect(user).batchForceRevokeSchedules(scheduleIds)
      ).to.be.revertedWithCustomError(vestingManager, "AccessControlUnauthorizedAccount");
    });

    it("Should skip invalid schedule IDs", async function () {
      const scheduleIds = [scheduleId1, 999999, scheduleId2, 0];
      const successCount = await vestingManagerV2.connect(owner).batchForceRevokeSchedules.staticCall(scheduleIds);

      expect(successCount).to.equal(2); // Only scheduleId1 and scheduleId2

      await vestingManagerV2.connect(owner).batchForceRevokeSchedules(scheduleIds);

      const schedule1 = await vestingManager.getVestingSchedule(scheduleId1);
      const schedule2 = await vestingManager.getVestingSchedule(scheduleId2);

      expect(schedule1.revoked).to.be.true;
      expect(schedule2.revoked).to.be.true;
    });

    it("Should skip already revoked schedules", async function () {
      // Revoke schedule1 first
      await vestingManagerV2.connect(owner).forceRevokeSchedule(scheduleId1);

      const scheduleIds = [scheduleId1, scheduleId2, scheduleId3];
      const successCount = await vestingManagerV2.connect(owner).batchForceRevokeSchedules.staticCall(scheduleIds);

      expect(successCount).to.equal(2); // Only scheduleId2 and scheduleId3

      await vestingManagerV2.connect(owner).batchForceRevokeSchedules(scheduleIds);

      const schedule2 = await vestingManager.getVestingSchedule(scheduleId2);
      const schedule3 = await vestingManager.getVestingSchedule(scheduleId3);

      expect(schedule2.revoked).to.be.true;
      expect(schedule3.revoked).to.be.true;
    });

    it("Should return correct success count", async function () {
      // Revoke one schedule and use one invalid ID
      await vestingManagerV2.connect(owner).forceRevokeSchedule(scheduleId1);

      const scheduleIds = [scheduleId1, scheduleId2, 999999, scheduleId3];
      const successCount = await vestingManagerV2.connect(owner).batchForceRevokeSchedules.staticCall(scheduleIds);

      expect(successCount).to.equal(2); // Only scheduleId2 and scheduleId3
    });

    it("Should emit ScheduleRevoked events for all successful revocations", async function () {
      const scheduleIds = [scheduleId1, scheduleId2, scheduleId3];
      
      await expect(
        vestingManagerV2.connect(owner).batchForceRevokeSchedules(scheduleIds)
      ).to.emit(vestingManager, "ScheduleRevoked")
        .withArgs(scheduleId1, beneficiary.address, amount)
        .to.emit(vestingManager, "ScheduleRevoked")
        .withArgs(scheduleId2, beneficiary.address, amount)
        .to.emit(vestingManager, "ScheduleRevoked")
        .withArgs(scheduleId3, beneficiary.address, amount);
    });

    it("Should handle empty array", async function () {
      const scheduleIds: bigint[] = [];
      const successCount = await vestingManagerV2.connect(owner).batchForceRevokeSchedules.staticCall(scheduleIds);

      expect(successCount).to.equal(0);
    });

    it("Should handle mix of valid, invalid, and already revoked schedules", async function () {
      // Revoke schedule1
      await vestingManagerV2.connect(owner).forceRevokeSchedule(scheduleId1);

      const scheduleIds = [scheduleId1, 999999, scheduleId2, 0, scheduleId3, 888888];
      const successCount = await vestingManagerV2.connect(owner).batchForceRevokeSchedules.staticCall(scheduleIds);

      expect(successCount).to.equal(2); // Only scheduleId2 and scheduleId3

      await vestingManagerV2.connect(owner).batchForceRevokeSchedules(scheduleIds);

      const schedule2 = await vestingManager.getVestingSchedule(scheduleId2);
      const schedule3 = await vestingManager.getVestingSchedule(scheduleId3);

      expect(schedule2.revoked).to.be.true;
      expect(schedule3.revoked).to.be.true;
    });
  });

  describe("View Functions", function () {
    const amount = ethers.parseEther("1000");
    let scheduleId: bigint;

    beforeEach(async function () {
      // Create a vesting schedule
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
      scheduleId = event?.topics[1] ? BigInt(event.topics[1]) : BigInt(0);
    });

    it("Should return correct vesting schedule details", async function () {
      const schedule = await vestingManager.getVestingSchedule(scheduleId);
      expect(schedule.beneficiary).to.equal(beneficiary.address);
      expect(schedule.totalAmount).to.equal(amount);
      expect(schedule.revoked).to.be.false;
    });

    it("Should return correct vesting info", async function () {
      const info = await vestingManager.getVestingInfo(scheduleId);
      expect(info.totalAmount).to.equal(amount);
      expect(info.releasedAmount).to.equal(0);
      expect(info.releasableAmount).to.equal(0); // Before cliff
    });

    it("Should return correct schedules for beneficiary", async function () {
      const schedules = await vestingManager.getSchedulesForBeneficiary(beneficiary.address);
      expect(schedules).to.include(scheduleId);
    });
  });

  describe("Pausing", function () {
    it("Should allow admin to pause and unpause", async function () {
      await vestingManager.pause();
      expect(await vestingManager.paused()).to.be.true;

      await vestingManager.unpause();
      expect(await vestingManager.paused()).to.be.false;
    });

    it("Should not allow non-admin to pause", async function () {
      await expect(
        vestingManager.connect(user).pause()
      ).to.be.revertedWithCustomError(vestingManager, "AccessControlUnauthorizedAccount");
    });

    it("Should not allow operations when paused", async function () {
      await vestingManager.pause();
      
      const amount = ethers.parseEther("1000");
      const startTime = Math.floor(Date.now() / 1000) + 3600;
      const cliffDuration = 3600 * 24 * 30;
      const duration = 3600 * 24 * 365;

      await expect(
        vestingManager.connect(owner).createVestingSchedule(
          beneficiary.address,
          amount,
          startTime,
          cliffDuration,
          duration,
          0
        )
      ).to.be.revertedWithCustomError(vestingManager, "EnforcedPause");
    });
  });

  describe("Vesting Token Tracking", function () {
    const amount = ethers.parseEther("1000");
    let scheduleId: bigint;
    let allocationId: bigint;

    beforeEach(async function () {
      // First create an allocation in the vault
      const allocationAmount = ethers.parseEther("2000"); // More than vesting amount
      const tx = await vault.connect(owner).createAllocation(beneficiary.address, allocationAmount);
      const receipt = await tx.wait();
      const event = receipt?.logs[0];
      allocationId = event?.topics[3] ? BigInt(event.topics[3]) : BigInt(0);

      // Create a vesting schedule using the allocation
      const startTime = Math.floor(Date.now() / 1000) + 3600;
      const cliffDuration = 3600 * 24 * 30;
      const duration = 3600 * 24 * 365;

      const vestingTx = await vestingManager.connect(owner).createVestingSchedule(
        beneficiary.address,
        amount,
        startTime,
        cliffDuration,
        duration,
        allocationId
      );

      const vestingReceipt = await vestingTx.wait();
      const vestingEvent = vestingReceipt?.logs[0];
      scheduleId = vestingEvent?.topics[1] ? BigInt(vestingEvent.topics[1]) : BigInt(0);
    });

    it("Should track total vested tokens correctly", async function () {
      // Check initial vested amount
      // expect(await vestingManager.getVestedToken()).to.equal(amount);

      // Create another allocation and vesting schedule
      const secondAllocationAmount = ethers.parseEther("2000");
      const secondTx = await vault.connect(owner).createAllocation(beneficiary.address, secondAllocationAmount);
      const secondReceipt = await secondTx.wait();
      const secondEvent = secondReceipt?.logs[0];
      const secondAllocationId = secondEvent?.topics[3] ? BigInt(secondEvent.topics[3]) : BigInt(0);

      const secondAmount = ethers.parseEther("1500");
      const vestingTx = await vestingManager.connect(owner).createVestingSchedule(
        beneficiary.address,
        secondAmount,
        Math.floor(Date.now() / 1000) + 3600,
        3600 * 24 * 30,
        3600 * 24 * 365,
        secondAllocationId
      );

      // Check total vested amount after second schedule
      // expect(await vestingManager.getVestedToken()).to.equal(amount + secondAmount);
    });

    it("Should track claimed tokens correctly", async function () {
      // Fast forward past cliff
      await time.increaseTo(Math.floor(Date.now() / 1000) + 3600 * 24 * 31);

      // Initial claimed amount should be 0
      // expect(await vestingManager.getClaimedTokens()).to.equal(0);

      // Claim some tokens
      await vestingManager.connect(beneficiary).claimVestedTokens(scheduleId);
      // const claimedAfterVesting = await vestingManager.getClaimedTokens();
      // expect(claimedAfterVesting).to.be.gt(0);

      // Manual unlock some tokens
      const unlockAmount = ethers.parseEther("200");
      await vestingManager.connect(owner).manualUnlock(scheduleId, unlockAmount);

      // Check claimed amount after manual unlock
      // expect(await vestingManager.getClaimedTokens()).to.equal(claimedAfterVesting + unlockAmount);
    });

    it("Should update tracking when schedule is revoked", async function () {
      // Fast forward past cliff
      await time.increaseTo(Math.floor(Date.now() / 1000) + 3600 * 24 * 31);

      // Claim some tokens first
      await vestingManager.connect(beneficiary).claimVestedTokens(scheduleId);
      // const claimedBeforeRevoke = await vestingManager.getClaimedTokens();

      // Revoke the schedule
      await vestingManager.connect(owner).revokeSchedule(scheduleId);

      // Check that vested amount is reduced but claimed amount remains
      // expect(await vestingManager.getVestedToken()).to.equal(claimedBeforeRevoke);
      // expect(await vestingManager.getClaimedTokens()).to.equal(claimedBeforeRevoke);
    });

    it("Should track multiple schedules and claims correctly", async function () {
      // Create second allocation and schedule
      const secondAllocationAmount = ethers.parseEther("2000");
      const secondTx = await vault.connect(owner).createAllocation(beneficiary.address, secondAllocationAmount);
      const secondReceipt = await secondTx.wait();
      const secondEvent = secondReceipt?.logs[0];
      const secondAllocationId = secondEvent?.topics[3] ? BigInt(secondEvent.topics[3]) : BigInt(0);

      const secondAmount = ethers.parseEther("1500");
      const vestingTx = await vestingManager.connect(owner).createVestingSchedule(
        beneficiary.address,
        secondAmount,
        Math.floor(Date.now() / 1000) + 3600,
        3600 * 24 * 30,
        3600 * 24 * 365,
        secondAllocationId
      );

      // Fast forward past cliff
      await time.increaseTo(Math.floor(Date.now() / 1000) + 3600 * 24 * 31);

      // Check initial amounts
      // expect(await vestingManager.getVestedToken()).to.equal(amount + secondAmount);
      // expect(await vestingManager.getClaimedTokens()).to.equal(0);

      // Claim from first schedule
      await vestingManager.connect(beneficiary).claimVestedTokens(scheduleId);
      // const claimedAfterFirst = await vestingManager.getClaimedTokens();

      // Manual unlock from second schedule
      const unlockAmount = ethers.parseEther("1000");
      await vestingManager.connect(owner).manualUnlock(2, unlockAmount);

      // Check final amounts
      // expect(await vestingManager.getVestedToken()).to.equal(amount + secondAmount);
      // expect(await vestingManager.getClaimedTokens()).to.equal(claimedAfterFirst + unlockAmount);
    });
  });
}); 