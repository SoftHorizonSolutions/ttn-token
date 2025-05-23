import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";


// Import the contract type
import { TTNToken } from "../typechain-types";

describe("TTNToken", function () {
  // Test accounts
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  // Contract instance
  let token: TTNToken;

  async function deployTokenFixture() {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy and initialize with owner as msg.sender
    const TTNToken = await ethers.getContractFactory("TTNToken");
    const token = await upgrades.deployProxy(TTNToken, [], { initializer: 'initialize' });
    await token.waitForDeployment();

    return { token, owner, user1, user2 };
  }

  beforeEach(async function () {
    ({ token, owner, user1, user2 } = await loadFixture(deployTokenFixture));
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await token.owner()).to.equal(owner.address);
    });

    it("Should assign the DEFAULT_ADMIN_ROLE to the deployer (owner)", async function () {
      // Owner (first signer) is the deployer and msg.sender during initialization
      expect(await token.hasRole(await token.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
    });

    it("Should set the correct token name and symbol", async function () {
      expect(await token.name()).to.equal("TTN");
      expect(await token.symbol()).to.equal("TTN");
    });

    it("Should set the correct max supply", async function () {
      expect(await token.MAX_SUPPLY()).to.equal(ethers.parseEther("1000000000")); // 1 billion tokens
    });
  });

  describe("Minting", function () {
    it("Should allow admin to mint tokens", async function () {
      // Verify owner has DEFAULT_ADMIN_ROLE
      const DEFAULT_ADMIN_ROLE = await token.DEFAULT_ADMIN_ROLE();
      expect(await token.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;

      const amount = ethers.parseEther("1000");
      await token.connect(owner).mint(user1.address, amount);
      expect(await token.balanceOf(user1.address)).to.equal(amount);
    });

    it("Should not allow non-admin to mint tokens", async function () {
      const amount = ethers.parseEther("1000");
      await expect(
        token.connect(user1).mint(user2.address, amount)
      ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    });

    it("Should allow minting up to max supply", async function () {
      const maxSupply = await token.MAX_SUPPLY();
      await token.connect(owner).mint(user1.address, maxSupply);
      expect(await token.totalSupply()).to.equal(maxSupply);
    });

    it("Should not allow minting beyond max supply", async function () {
      const maxSupply = await token.MAX_SUPPLY();
      await token.connect(owner).mint(user1.address, maxSupply);
      
      // Try to mint 1 more token
      await expect(
        token.connect(owner).mint(user1.address, 1)
      ).to.be.revertedWithCustomError(token, "MaxSupplyExceeded")
        .withArgs(1, 0); // requested: 1, available: 0
    });

    it("Should not allow minting that would exceed max supply", async function () {
      const maxSupply = await token.MAX_SUPPLY();
      const halfSupply = maxSupply / 2n;
      
      // Mint half the supply
      await token.connect(owner).mint(user1.address, halfSupply);
      
      // Try to mint more than the remaining supply
      await expect(
        token.connect(owner).mint(user1.address, halfSupply + 1n)
      ).to.be.revertedWithCustomError(token, "MaxSupplyExceeded");
    });
  });

  describe("Pausing", function () {
    it("Should allow admin to pause and unpause", async function () {
      await token.connect(owner).pause();
      expect(await token.paused()).to.be.true;

      await token.connect(owner).unpause();
      expect(await token.paused()).to.be.false;
    });

    it("Should not allow non-admin to pause", async function () {
      await expect(
        token.connect(user1).pause()
      ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    });

    it("Should not allow transfers when paused", async function () {
      await token.connect(owner).mint(user1.address, ethers.parseEther("1000"));
      await token.connect(owner).pause();
      
      await expect(
        token.connect(user1).transfer(user2.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(token, "EnforcedPause");
    });
  });

  describe("Burning", function () {
    it("Should allow users to burn their tokens", async function () {
      const amount = ethers.parseEther("1000");
      await token.connect(owner).mint(user1.address, amount);
      
      const burnAmount = ethers.parseEther("500");
      await token.connect(user1).burn(burnAmount);
      
      expect(await token.balanceOf(user1.address)).to.equal(amount - burnAmount);
    });

    it("Should not allow burning more tokens than balance", async function () {
      const amount = ethers.parseEther("1000");
      await token.connect(owner).mint(user1.address, amount);
      
      await expect(
        token.connect(user1).burn(ethers.parseEther("1500"))
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
    });
  });

  describe("Admin Role Management", function () {
    it("Should allow admin to transfer default admin role", async function () {
      await expect(token.connect(owner).transferTokenAdmin(user1.address))
        .to.emit(token, "DefaultAdminTransferred")
        .withArgs(owner.address, user1.address);

      // Verify role transfer
      expect(await token.hasRole(await token.DEFAULT_ADMIN_ROLE(), user1.address)).to.be.true;
      expect(await token.hasRole(await token.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.false;
    });

    it("Should not allow non-admin to transfer default admin role", async function () {
      await expect(
        token.connect(user1).transferTokenAdmin(user2.address)
      ).to.be.revertedWithCustomError(token, "NotAuthorized");
    });

    it("Should not allow transferring to zero address", async function () {
      await expect(
        token.connect(owner).transferTokenAdmin(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(token, "InvalidAddress");
    });

    it("Should not allow transferring to self", async function () {
      await expect(
        token.connect(owner).transferTokenAdmin(owner.address)
      ).to.be.revertedWithCustomError(token, "CannotTransferToSelf");
    });

    it("Should allow old admin to perform admin functions", async function () {
      // Transfer admin role
      await token.connect(owner).transferTokenAdmin(user1.address);

      // Verify new admin can perform admin functions
      await expect(token.connect(user1).mint(user2.address, ethers.parseEther("1000")))
        .to.not.be.reverted;

      // Verify old admin cannot perform admin functions
      await expect(
        token.connect(owner).mint(user2.address, ethers.parseEther("1000"))
      ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    });

    it("Should not allow user to grant themselves admin role", async function () {
      // Try to grant DEFAULT_ADMIN_ROLE to self
      await expect(
        token.connect(user1).grantRole(await token.DEFAULT_ADMIN_ROLE(), user1.address)
      ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");

      // Verify user1 still cannot perform admin actions
      await expect(
        token.connect(user1).mint(user2.address, ethers.parseEther("1000"))
      ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Token Tracking", function () {
    it("Should correctly track total minted tokens", async function () {
      // Initial total minted should be 0
      expect(await token.getTotalMinted()).to.equal(0);

      // Mint some tokens
      const amount1 = ethers.parseEther("1000");
      await token.connect(owner).mint(user1.address, amount1);
      expect(await token.getTotalMinted()).to.equal(amount1);

      // Mint more tokens
      const amount2 = ethers.parseEther("500");
      await token.connect(owner).mint(user2.address, amount2);
      expect(await token.getTotalMinted()).to.equal(amount1 + amount2);

      // Burn some tokens - total minted should remain the same
      await token.connect(user1).burn(ethers.parseEther("200"));
      expect(await token.getTotalMinted()).to.equal(amount1 + amount2);
    });

    it("Should correctly return token balances", async function () {
      // Initial balances should be 0
      expect(await token.getTokenBalance(user1.address)).to.equal(0);
      expect(await token.getTokenBalance(user2.address)).to.equal(0);

      // Mint tokens to user1
      const amount = ethers.parseEther("1000");
      await token.connect(owner).mint(user1.address, amount);
      expect(await token.getTokenBalance(user1.address)).to.equal(amount);

      // Transfer some tokens to user2
      const transferAmount = ethers.parseEther("300");
      await token.connect(user1).transfer(user2.address, transferAmount);
      
      // Check updated balances
      expect(await token.getTokenBalance(user1.address)).to.equal(amount - transferAmount);
      expect(await token.getTokenBalance(user2.address)).to.equal(transferAmount);
    });
  });
}); 