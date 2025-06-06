import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { TokenVault, TTNToken } from "../typechain-types";

describe("TokenVault", function () {
  // Test accounts
  let owner: SignerWithAddress;
  let vestingManager: SignerWithAddress;
  let beneficiary1: SignerWithAddress;
  let beneficiary2: SignerWithAddress;
  let user: SignerWithAddress;
  let manager1: SignerWithAddress;
  let manager2: SignerWithAddress;

  // Contract instances
  let token: TTNToken;
  let vault: TokenVault;

  async function deployVaultFixture() {
    [owner, vestingManager, beneficiary1, beneficiary2, user,  manager1,
      manager2] = await ethers.getSigners();

    // Deploy token
    const TTNToken = await ethers.getContractFactory("TTNToken");
    const token = await upgrades.deployProxy(TTNToken, [], { initializer: 'initialize' });
    await token.waitForDeployment();


    // Deploy vault
    const TokenVault = await ethers.getContractFactory("TokenVault");
    const vault = await upgrades.deployProxy(TokenVault, [await token.getAddress()], { initializer: 'initialize' });
    await vault.waitForDeployment();

    // Grant MINTER_ROLE to the vault contract
    const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;
    await token.connect(owner).grantRole(DEFAULT_ADMIN_ROLE , await vault.getAddress());
    

    return { token, vault, owner, vestingManager, beneficiary1, beneficiary2, user };
  }

  beforeEach(async function () {
    ({ token, vault, owner, vestingManager, beneficiary1, beneficiary2, user } = 
      await loadFixture(deployVaultFixture));
  });

  describe("Deployment", function () {
    it("Should set the correct token address", async function () {
      expect(await vault.ttnToken()).to.equal(await token.getAddress());
    });

    it("Should assign the DEFAULT_ADMIN_ROLE to deployer", async function () {
      const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
      expect(await vault.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
    });

    it("Should initialize counters to zero", async function () {
      expect(await vault.getAllocationsForBeneficiary(beneficiary1.address)).to.be.empty;
    });
  });

  describe("Allocations", function () {
    it("Should allow admin to create allocation", async function () {
      const amount = 1000;
      await vault.connect(owner).createAllocation(beneficiary1.address, amount);
      
      const allocations = await vault.getAllocationsForBeneficiary(beneficiary1.address);
      expect(allocations.length).to.equal(1);
      
      const allocation = await vault.allocations(allocations[0]);
      expect(allocation.amount).to.equal(amount);
      expect(allocation.beneficiary).to.equal(beneficiary1.address);
      expect(allocation.revoked).to.be.false;
    });

    it("Should return correct allocation details by ID", async function () {
      const amount = 1000;
      await vault.createAllocation(beneficiary1.address, amount);
      const allocations = await vault.getAllocationsForBeneficiary(beneficiary1.address);
      const allocationId = allocations[0];
      
      const [retrievedAmount, retrievedBeneficiary, revoked] = await vault.getAllocationById(allocationId);
      
      expect(retrievedAmount).to.equal(amount);
      expect(retrievedBeneficiary).to.equal(beneficiary1.address);
      expect(revoked).to.be.false;
    });

    it("Should return correct allocation details after revocation", async function () {
      const amount = ethers.parseEther("1000");
      await vault.createAllocation(beneficiary1.address, amount);
      const allocations = await vault.getAllocationsForBeneficiary(beneficiary1.address);
      const allocationId = allocations[0];
      
      await vault.revokeAllocation(allocationId);
      
      const [retrievedAmount, retrievedBeneficiary, revoked] = await vault.getAllocationById(allocationId);
      
      expect(retrievedAmount).to.equal(amount);
      expect(retrievedBeneficiary).to.equal(beneficiary1.address);
      expect(revoked).to.be.true;
    });

    it("Should not allow non-admin to create allocation", async function () {
      const amount = 1000;
      await expect(
        vault.connect(user).createAllocation(beneficiary1.address, amount)
      ).to.be.revertedWithCustomError(vault, "NotAuthorized");
    });

    it("Should not allow creating allocation with zero amount", async function () {
      await expect(
        vault.connect(owner).createAllocation(beneficiary1.address, 0)
      ).to.be.revertedWithCustomError(vault, "InvalidAmount");
    });

    it("Should not allow creating allocation for zero address", async function () {
      await expect(
        vault.connect(owner).createAllocation(ethers.ZeroAddress, ethers.parseEther("1000"))
      ).to.be.revertedWithCustomError(vault, "InvalidBeneficiary");
    });

    it("Should allow admin to revoke allocation", async function () {
      const amount = ethers.parseEther("1000");
      await vault.connect(owner).createAllocation(beneficiary1.address, amount);
      
      const allocations = await vault.getAllocationsForBeneficiary(beneficiary1.address);
      await vault.connect(owner).revokeAllocation(allocations[0]);
      
      const allocation = await vault.allocations(allocations[0]);
      expect(allocation.revoked).to.be.true;
    });

    it("Should not allow revoking non-existent allocation", async function () {
      await expect(
        vault.connect(owner).revokeAllocation(999)
      ).to.be.revertedWithCustomError(vault, "InvalidAllocationId");
    });

    it("Should not allow revoking already revoked allocation", async function () {
      const amount = ethers.parseEther("1000");
      await vault.connect(owner).createAllocation(beneficiary1.address, amount);
      
      const allocations = await vault.getAllocationsForBeneficiary(beneficiary1.address);
      await vault.connect(owner).revokeAllocation(allocations[0]);
      
      await expect(
        vault.connect(owner).revokeAllocation(allocations[0])
      ).to.be.revertedWithCustomError(vault, "AllocationAlreadyRevoked");
    });
  });

  describe("Airdrops", function () {
    it("Should allow admin to execute airdrop", async function () {
      const beneficiaries = [beneficiary1.address, beneficiary2.address];
      const amounts = [ethers.parseEther("1000"), ethers.parseEther("2000")];
      
      await vault.connect(owner).executeAirdrop(beneficiaries, amounts);
      
      // Check token balances
      expect(await token.balanceOf(beneficiary1.address)).to.equal(amounts[0]);
      expect(await token.balanceOf(beneficiary2.address)).to.equal(amounts[1]);
    });

    it("Should not allow non-admin to execute airdrop", async function () {
      const beneficiaries = [beneficiary1.address];
      const amounts = [ethers.parseEther("1000")];
      
      await expect(
        vault.connect(user).executeAirdrop(beneficiaries, amounts)
      ).to.be.revertedWithCustomError(vault, "NotAuthorized");
    });

    it("Should not allow airdrop with empty beneficiaries list", async function () {
      await expect(
        vault.connect(owner).executeAirdrop([], [])
      ).to.be.revertedWithCustomError(vault, "EmptyBeneficiariesList");
    });

    it("Should not allow airdrop with mismatched arrays", async function () {
      const beneficiaries = [beneficiary1.address, beneficiary2.address];
      const amounts = [ethers.parseEther("1000")];
      
      await expect(
        vault.connect(owner).executeAirdrop(beneficiaries, amounts)
      ).to.be.revertedWithCustomError(vault, "ArraysLengthMismatch");
    });
  });

  describe("Pausing", function () {
    it("Should allow admin to pause and unpause", async function () {
      await vault.pause();
      expect(await vault.paused()).to.be.true;

      await vault.unpause();
      expect(await vault.paused()).to.be.false;
    });

    it("Should not allow non-admin to pause", async function () {
      await expect(
        vault.connect(user).pause()
      ).to.be.revertedWithCustomError(vault, "AccessControlUnauthorizedAccount");
    });

    it("Should not allow allocations when paused", async function () {
      await vault.pause();
      
      await expect(
        vault.connect(owner).createAllocation(beneficiary1.address, ethers.parseEther("1000"))
      ).to.be.revertedWithCustomError(vault, "EnforcedPause");
    });

    it("Should not allow airdrops when paused", async function () {
      await vault.pause();
      
      const beneficiaries = [beneficiary1.address];
      const amounts = [ethers.parseEther("1000")];
      
      await expect(
        vault.connect(owner).executeAirdrop(beneficiaries, amounts)
      ).to.be.revertedWithCustomError(vault, "EnforcedPause");
    });
  });

  describe("Token Minting", function () {
    it("Should allow minting up to max supply", async function () {
      const maxSupply = await token.MAX_SUPPLY();
      const halfSupply = maxSupply / 2n;
    
      const beneficiaries = [beneficiary1.address, beneficiary2.address];
      const amounts = [halfSupply, halfSupply];
    
      // Execute airdrop that mints up to max supply
      await vault.connect(owner).executeAirdrop(beneficiaries, amounts);
    
      // Assert token supply has reached the cap
      expect(await token.totalSupply()).to.equal(maxSupply);
    });
    

    it("Should not allow minting beyond max supply", async function () {
      const maxSupply = await token.MAX_SUPPLY();
      const almostAll = maxSupply - 1n;
    
      // First airdrop close to cap
      await vault.connect(owner).executeAirdrop(
        [beneficiary1.address],
        [almostAll]
      );
    
      // Now try to mint 2 tokens (which exceeds the remaining 1 token)
      await expect(
        vault.connect(owner).executeAirdrop(
          [beneficiary2.address],
          [2n] // this should exceed max supply by 1
        )
      ).to.be.revertedWithCustomError(token, "MaxSupplyExceeded");
    });
  });

  describe("Manager Role Management", function () {
    let manager: SignerWithAddress;
    let otherManager: SignerWithAddress;
  
    beforeEach(async function () {
      [, , , , , manager, otherManager] = await ethers.getSigners();
    });
  
    it("Should allow admin to add a new manager", async function () {
      await expect(vault.connect(owner).addManager(manager.address))
        .to.emit(vault, "ManagerAssigned")
        .withArgs(manager.address);
  
      expect(await vault.hasRole(await vault.MANAGER_ROLE(), manager.address)).to.be.true;
      expect(await vault.getAllManagers()).to.include(manager.address);
    });
  
    it("Should not allow a manager to add themselves", async function () {
      await vault.connect(owner).addManager(manager.address);
  
      await expect(
        vault.connect(manager).addManager(manager.address)
      ).to.be.revertedWithCustomError(vault, "CannotAddSelf");
    });
  
    it("Should not allow non-admin/non-manager to add a manager", async function () {
      await expect(
        vault.connect(user).addManager(manager.address)
      ).to.be.revertedWithCustomError(vault, "NotAuthorized");
    });
  
    it("Should not add duplicate manager", async function () {
      await vault.connect(owner).addManager(manager.address);
  
      // Second attempt won't emit again
      await expect(vault.connect(owner).addManager(manager.address)).to.not.emit(vault, "ManagerAssigned");
  
      const allManagers = await vault.getAllManagers();
      const filtered = allManagers.filter((m) => m === manager.address);
      expect(filtered.length).to.equal(1);
    });
  
    it("Should allow admin to remove a manager", async function () {
      await vault.connect(owner).addManager(manager.address);
  
      await expect(vault.connect(owner).removeManager(manager.address))
        .to.emit(vault, "ManagerRemoved")
        .withArgs(manager.address);
  
      expect(await vault.hasRole(await vault.MANAGER_ROLE(), manager.address)).to.be.false;
    });
  
    it("Should not allow a manager to remove themselves", async function () {
      await vault.connect(owner).addManager(manager.address);
  
      await expect(
        vault.connect(manager).removeManager(manager.address)
      ).to.be.revertedWithCustomError(vault, "CannotRemoveSelf");
    });
  
    it("Should not allow non-admin/non-manager to remove a manager", async function () {
      await vault.connect(owner).addManager(manager.address);
  
      await expect(
        vault.connect(user).removeManager(manager.address)
      ).to.be.revertedWithCustomError(vault, "NotAuthorized");
    });
  
    it("Should return true for isManager if address is a manager or admin", async function () {
      await vault.connect(owner).addManager(manager.address);
  
      expect(await vault.isManager(manager.address)).to.equal(true);
      expect(await vault.isManager(owner.address)).to.equal(true); // owner is default admin
      expect(await vault.isManager(user.address)).to.equal(false);
    });

    it("Should allow admin to add multiple managers", async function () {
      const managers = [manager1.address, manager2.address, user.address];
    
      for (const addr of managers) {
        await expect(vault.connect(owner).addManager(addr))
          .to.emit(vault, "ManagerAssigned")
          .withArgs(addr);
    
        const hasRole = await vault.hasRole(await vault.MANAGER_ROLE(), addr);
        expect(hasRole).to.be.true;
      }
    
      const allManagers = await vault.getAllManagers();
    
      for (const addr of managers) {
        expect(allManagers).to.include(addr);
      }
    
      // Optional: assert count
      expect(allManagers.length).to.equal(managers.length);
    });

    it("Should allow each added manager to create allocations and execute airdrops", async function () {
      const managers = [manager1, manager2, user]; // user is used here as a third manager
    
      // Step 1: Add all managers
      for (const m of managers) {
        await vault.connect(owner).addManager(m.address);
        expect(await vault.hasRole(await vault.MANAGER_ROLE(), m.address)).to.be.true;
      }
    
      // Step 2: Each manager creates an allocation
      for (const m of managers) {
        const amount = ethers.parseEther("100");
        await expect(
          vault.connect(m).createAllocation(beneficiary1.address, amount)
        ).to.emit(vault, "AllocationCreated");
    
        const allocations = await vault.getAllocationsForBeneficiary(beneficiary1.address);
        expect(allocations.length).to.be.greaterThan(0);
      }
    
      // Step 3: Each manager executes an airdrop
      for (const m of managers) {
        const beneficiaries = [beneficiary2.address];
        const amounts = [ethers.parseEther("50")];
    
        await expect(
          vault.connect(m).executeAirdrop(beneficiaries, amounts)
        ).to.emit(vault, "AirdropExecuted");
    
        const balance = await token.balanceOf(beneficiary2.address);
        expect(balance).to.be.gte(ethers.parseEther("50")); // balance grows each time
      }
    });

    it("Should properly remove manager from both role and managers array", async function () {
      // Add multiple managers first
      await vault.connect(owner).addManager(manager1.address);
      await vault.connect(owner).addManager(manager2.address);
      await vault.connect(owner).addManager(user.address);

      // Verify initial state
      const initialManagers = await vault.getAllManagers();
      expect(initialManagers).to.include(manager1.address);
      expect(initialManagers).to.include(manager2.address);
      expect(initialManagers).to.include(user.address);
      expect(initialManagers.length).to.equal(3);

      // Remove manager1
      await vault.connect(owner).removeManager(manager1.address);

      // Verify manager1 is removed from both role and array
      expect(await vault.hasRole(await vault.MANAGER_ROLE(), manager1.address)).to.be.false;
      
      const remainingManagers = await vault.getAllManagers();
      expect(remainingManagers).to.not.include(manager1.address);
      expect(remainingManagers).to.include(manager2.address);
      expect(remainingManagers).to.include(user.address);
      expect(remainingManagers.length).to.equal(2);

      // Remove manager2
      await vault.connect(owner).removeManager(manager2.address);

      // Verify manager2 is removed from both role and array
      expect(await vault.hasRole(await vault.MANAGER_ROLE(), manager2.address)).to.be.false;
      
      const finalManagers = await vault.getAllManagers();
      expect(finalManagers).to.not.include(manager1.address);
      expect(finalManagers).to.not.include(manager2.address);
      expect(finalManagers).to.include(user.address);
      expect(finalManagers.length).to.equal(1);
    });
  });

  describe("reduceAllocation", function () {
    it("Should reduce allocation amount correctly", async function () {
      const { vault, owner, beneficiary1 } = await loadFixture(deployVaultFixture);
      
      // Create an allocation
      const amount = ethers.parseEther("1000");
      await vault.createAllocation(beneficiary1.address, amount);
      const allocations = await vault.getAllocationsForBeneficiary(beneficiary1.address);
      const allocationId = allocations[0];
      
      // Reduce allocation by half
      const reduceAmount = ethers.parseEther("500");
      await vault.reduceAllocation(allocationId, reduceAmount);
      
      // Check allocation details
      const [remainingAmount, beneficiary, revoked] = await vault.getAllocationById(allocationId);
      expect(remainingAmount).to.equal(amount - reduceAmount);
      expect(beneficiary).to.equal(beneficiary1.address);
      expect(revoked).to.be.false;
    });

    it("Should revert if caller is not authorized", async function () {
      const { vault, beneficiary1, beneficiary2 } = await loadFixture(deployVaultFixture);
      
      // Create an allocation
      const amount = ethers.parseEther("1000");
      await vault.createAllocation(beneficiary1.address, amount);
      const allocations = await vault.getAllocationsForBeneficiary(beneficiary1.address);
      const allocationId = allocations[0];
      
      // Try to reduce allocation as non-authorized user
      const reduceAmount = ethers.parseEther("500");
      await expect(
        vault.connect(beneficiary2).reduceAllocation(allocationId, reduceAmount)
      ).to.be.revertedWithCustomError(vault, "NotAuthorized");
    });

    it("Should revert if allocation is already revoked", async function () {
      const { vault, owner, beneficiary1 } = await loadFixture(deployVaultFixture);
      
      // Create an allocation
      const amount = ethers.parseEther("1000");
      await vault.createAllocation(beneficiary1.address, amount);
      const allocations = await vault.getAllocationsForBeneficiary(beneficiary1.address);
      const allocationId = allocations[0];
      
      // Revoke allocation first
      await vault.revokeAllocation(allocationId);
      
      // Try to reduce revoked allocation
      const reduceAmount = ethers.parseEther("500");
      await expect(
        vault.reduceAllocation(allocationId, reduceAmount)
      ).to.be.revertedWithCustomError(vault, "AllocationAlreadyRevoked");
    });

    it("Should revert if reducing amount is greater than allocation amount", async function () {
      const { vault, owner, beneficiary1 } = await loadFixture(deployVaultFixture);
      
      // Create an allocation
      const amount = ethers.parseEther("1000");
      await vault.createAllocation(beneficiary1.address, amount);
      const allocations = await vault.getAllocationsForBeneficiary(beneficiary1.address);
      const allocationId = allocations[0];
      
      // Try to reduce more than allocated amount
      const reduceAmount = ethers.parseEther("1500");
      await expect(
        vault.reduceAllocation(allocationId, reduceAmount)
      ).to.be.revertedWithCustomError(vault, "InvalidAmount");
    });

    it("Should revert if reducing amount is zero", async function () {
      const { vault, owner, beneficiary1 } = await loadFixture(deployVaultFixture);
      
      // Create an allocation
      const amount = ethers.parseEther("1000");
      await vault.createAllocation(beneficiary1.address, amount);
      const allocations = await vault.getAllocationsForBeneficiary(beneficiary1.address);
      const allocationId = allocations[0];
      
      // Try to reduce by zero
      await expect(
        vault.reduceAllocation(allocationId, 0)
      ).to.be.revertedWithCustomError(vault, "InvalidAmount");
    });
  });
}); 