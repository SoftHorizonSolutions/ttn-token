// SPDX-License-Identifier: MIT
/**
 * @title TTNTokenVault
 * @author https://github.com/spikeyrock
 * @dev Token Treasury & Allocation Manager for TTNToken
 * - Manages minting of tokens through allocations
 * - Handles airdrops to multiple addresses
 * - Allows revocation of allocations
 * - UUPS upgradeable pattern
 */

pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "./interfaces/ITTNToken.sol";

contract TokenVault is
    Initializable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    // Role identifiers
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    // State variables
    ITTNToken public ttnToken;
    address public vestingManagerAddress;
    address[] private _managers;

     // Allocation counter
    uint256 private _allocationCounter;
    uint256 private _airdropCounter;


    
    // Storage gap for future upgrades
    uint256[50] private __gap;

    // Events
    event AllocationCreated(
        address indexed beneficiary,
        uint256 amount,
        uint256 allocationId
    );
    event AllocationRevoked(
        address indexed beneficiary,
        uint256 amount,
        uint256 allocationId
    );
    event AirdropExecuted(
        address[] beneficiaries,
        uint256[] amounts,
        uint256 airdropId
    );
    event VestingManagerSet(address indexed vestingManager);
    event ManagerRemoved(address indexed manager);
    event ManagerAssigned(address indexed manager);


    // Custom errors
    error ZeroAddress(string param);
    error InvalidAmount();
    error InvalidAllocationId();
    error AllocationAlreadyRevoked();
    error EmptyBeneficiariesList();
    error ArraysLengthMismatch();
    error InvalidBeneficiary();
    error InvalidAmountInBatch();
    error NotAuthorized();
    error InvalidAddress();
    error CannotRemoveSelf();
    error CannotAddSelf();
    error AlreadyInitialized();
    error AlreadyPaused();
    error NotPaused();
    error InvalidImplementation();
    error ImplementationNotContract();
    error InvalidBeneficiaryInBatch();
    error DuplicateBeneficiary();
    error TransferFailed();

   

    // Allocation tracking
    struct Allocation {
        uint256 amount;
        address beneficiary;
        bool revoked;
    }

    // Mapping from allocation ID to Allocation
    mapping(uint256 => Allocation) public allocations;

    // Mapping from beneficiary to their allocation IDs
    mapping(address => uint256[]) public beneficiaryAllocations;


    /**
     * @dev Prevents the implementation contract from being initialized
     * This is a security measure to avoid potential attacks
     */
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the contract replacing the constructor for upgradeable contracts
     * @param _ttnToken Address of the TTNToken contract
     */
    function initialize(address _ttnToken) external initializer {
        if (_ttnToken == address(0)) revert ZeroAddress("token");
       
      

        __AccessControl_init();
        __UUPSUpgradeable_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        ttnToken = ITTNToken(_ttnToken);

        

        // Grant admin roles to deployer
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

        _allocationCounter = 0;
        _airdropCounter = 0;
    }


    /**
     * @dev Creates a new allocation and assign tokens
     * @param beneficiary Address to receive the allocation
     * @param amount Amount of tokens to allocate
     * @return allocationId Unique identifier for the allocation
     */
    function createAllocation(
        address beneficiary,
        uint256 amount
    ) external whenNotPaused nonReentrant returns (uint256) {
        if (
            !hasRole(MANAGER_ROLE, msg.sender) &&
            !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)
        ) revert NotAuthorized();
        if (beneficiary == address(0)) revert InvalidBeneficiary();
        if (amount <= 0) revert InvalidAmount();

        // Increment allocation counter before creating allocation
        _allocationCounter++;

        // Store allocation details
        allocations[_allocationCounter] = Allocation({
            beneficiary: beneficiary,
            amount: amount,
            revoked: false
        });

        // Add allocation ID to beneficiary's list
        beneficiaryAllocations[beneficiary].push(_allocationCounter);

        emit AllocationCreated(beneficiary, amount, _allocationCounter);

        return _allocationCounter;
    }

    /**
     * @dev Revokes an allocation
     * @param allocationId ID of the allocation to revoke
     * @return success Whether the revocation was successful
     */
    function revokeAllocation(
        uint256 allocationId
    ) external nonReentrant returns (bool) {
        if (
            !hasRole(MANAGER_ROLE, msg.sender) &&
            !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)
        ) revert NotAuthorized();
        if (allocationId == 0 || allocationId > _allocationCounter)
            revert InvalidAllocationId();

        Allocation storage allocation = allocations[allocationId];
        if (allocation.revoked) revert AllocationAlreadyRevoked();

        // Mark allocation as revoked
        allocation.revoked = true;

        emit AllocationRevoked(
            allocation.beneficiary,
            allocation.amount,
            allocationId
        );

        return true;
    }

    /**
     * @dev Executes an airdrop to multiple addresses
     * @param beneficiaries Array of addresses to receive tokens
     * @param amounts Array of token amounts to distribute
     * @return airdropId Unique identifier for the airdrop
     */
    function executeAirdrop(
        address[] calldata beneficiaries,
        uint256[] calldata amounts
    ) external whenNotPaused nonReentrant returns (uint256) {
        if (
            !hasRole(MANAGER_ROLE, msg.sender) &&
            !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)
        ) revert NotAuthorized();
        if (beneficiaries.length == 0) revert EmptyBeneficiariesList();
        if (beneficiaries.length != amounts.length)
            revert ArraysLengthMismatch();

        // Increment airdrop counter
        _airdropCounter++;

        // Process each beneficiary
        uint256 i = 0;
        while (i < beneficiaries.length) {
            if (beneficiaries[i] == address(0)) revert InvalidBeneficiary();
            if (amounts[i] == 0) revert InvalidAmountInBatch();

            // Create an allocation for each beneficiary
            _allocationCounter++;

            // Store allocation details
            allocations[_allocationCounter] = Allocation({
                beneficiary: beneficiaries[i],
                amount: amounts[i],
                revoked: false
            });

            // Add allocation ID to beneficiary's list
            beneficiaryAllocations[beneficiaries[i]].push(_allocationCounter);

            // Mint tokens to the beneficiary
            ttnToken.mint(beneficiaries[i], amounts[i]);

            i++;
        }

        emit AirdropExecuted(beneficiaries, amounts, _airdropCounter);

        return _airdropCounter;
    }


    /**
     * @dev Returns all allocations for a beneficiary
     * @param beneficiary Address to check allocations for
     * @return allocationIds Array of allocation IDs for the beneficiary
     */
    function getAllocationsForBeneficiary(
        address beneficiary
    ) external view returns (uint256[] memory) {
        return beneficiaryAllocations[beneficiary];
    }


    /**
     * @dev Returns allocation details from TokenVault
     * @param allocationId ID of the allocation to check
     * @return amount The allocated amount
     * @return beneficiary The beneficiary address
     * @return revoked Whether the allocation has been revoked
     */
    function getAllocationById(uint256 allocationId) external view returns (
        uint256 amount,
        address beneficiary,
        bool revoked
    ) {
        Allocation memory allocation = allocations[allocationId];
        return (allocation.amount, allocation.beneficiary, allocation.revoked);
    }

    /**
     * @dev Pauses vault operations
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @dev Unpauses vault operations
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev Function that should revert when `msg.sender` is not authorized to upgrade the contract
     * Called by {upgradeTo} and {upgradeToAndCall}
     *
     * @param newImplementation Address of the new implementation contract
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}


    /**
     * @dev Adds a new manager
     * @param newManager Address of the new manager
     */
    function addManager(address newManager) external {
        if (
            !hasRole(MANAGER_ROLE, msg.sender) &&
            !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)
        ) revert NotAuthorized();
        if (newManager == address(0)) revert InvalidAddress();
        if (newManager == msg.sender) revert CannotAddSelf();

        if (!hasRole(MANAGER_ROLE, newManager)) {
            _grantRole(MANAGER_ROLE, newManager);
            _managers.push(newManager);
            emit ManagerAssigned(newManager);
        }
    }

    /**
     * @dev Removes an manager
     * @param manager Address of the manager to remove
     */
    function removeManager(address manager) external {
        if (
            !hasRole(MANAGER_ROLE, msg.sender) &&
            !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)
        ) revert NotAuthorized();
        if (manager == address(0)) revert InvalidAddress();
        if (manager == msg.sender) revert CannotRemoveSelf();

        _revokeRole(MANAGER_ROLE, manager);
        
        // Remove manager from _managers array
        for (uint256 i = 0; i < _managers.length; i++) {
            if (_managers[i] == manager) {
                // Replace the element to remove with the last element
                _managers[i] = _managers[_managers.length - 1];
                // Remove the last element
                _managers.pop();
                break;
            }
        }
        
        emit ManagerRemoved(manager);
    }

    /**
     * @dev Returns whether an address is an admin or manager
     * @param account Address to check
     * @return bool True if the address is either a super admin or a manager
     */
    function isManager(address account) external view returns (bool) {
        return
            hasRole(DEFAULT_ADMIN_ROLE, account) ||
            hasRole(MANAGER_ROLE, account);
    }

    /**
     * @dev Returns all addresses assigned the MANAGER_ROLE
     */
    function getAllManagers() external view returns (address[] memory) {
        return _managers;
    }

    /**
     * @dev Reduces an allocation amount
     * @param allocationId ID of the allocation to reduce
     * @param amount Amount to reduce by
     * @return success Whether the reduction was successful
     */
    function reduceAllocation(
        uint256 allocationId,
        uint256 amount
    ) external nonReentrant returns (bool) {
        if (
            !hasRole(MANAGER_ROLE, msg.sender) &&
            !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)
        ) revert NotAuthorized();
        if (allocationId == 0 || allocationId > _allocationCounter)
            revert InvalidAllocationId();
        if (amount == 0) revert InvalidAmount();

        Allocation storage allocation = allocations[allocationId];
        if (allocation.revoked) revert AllocationAlreadyRevoked();
        if (amount > allocation.amount) revert InvalidAmount();

        // Reduce allocation amount
        allocation.amount -= amount;

        emit AllocationRevoked(
            allocation.beneficiary,
            amount,
            allocationId
        );

        return true;
    }
}
