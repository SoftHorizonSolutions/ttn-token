// SPDX-License-Identifier: MIT
/**
 * @title ABCVestingManager
 * @author https://github.com/spikeyrock
 * @dev Manages vesting schedules, locking, unlocking, and claiming of ABC tokens
 * - Create vesting schedules for beneficiaries
 * - Lock tokens according to vesting schedules
 * - Unlock tokens based on schedule or manually
 * - Allow beneficiaries to claim unlocked tokens
 * - UUPS upgradeable pattern
 */

pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "../interfaces/ITTNToken.sol";
import "../interfaces/ITokenVault.sol";

contract ABCVestingManager is Initializable, 
    AccessControlUpgradeable, 
    UUPSUpgradeable, 
    PausableUpgradeable,
    ReentrancyGuardUpgradeable {

    // State variables
    ITTNToken public abcToken;
    ITokenVault public tokenVault;

    // Vesting schedule structure
    struct VestingSchedule {
        uint256 totalAmount;
        uint256 startTime;
        uint256 cliffDuration;
        uint256 duration;
        uint256 releasedAmount;
        uint256 createdAt;
        uint256 allocationId;
        address beneficiary;
        bool revoked;
    }

    // Vesting schedule counter
    uint256 private _vestingScheduleCounter;

    // Mapping from schedule ID to VestingSchedule
    mapping(uint256 => VestingSchedule) public vestingSchedules;
    
    // Mapping from beneficiary to their schedule IDs
    mapping(address => uint256[]) public beneficiarySchedules;


    // Storage gap for future upgrades
    uint256[50] private __gap;

    // Events
    event VestingScheduleCreated(
        uint256 indexed scheduleId,
        address indexed beneficiary,
        uint256 totalAmount,
        uint256 startTime,
        uint256 cliffDuration,
        uint256 duration,
        uint256 allocationId
    );
    event TokensReleased(
        uint256 indexed scheduleId,
        address indexed beneficiary,
        uint256 amount
    );
    event ScheduleRevoked(
        uint256 indexed scheduleId, 
        address indexed beneficiary, 
        uint256 remainingAmount
    );
    event ManualUnlock(
        uint256 indexed scheduleId,
        address indexed beneficiary,
        uint256 amount,
        address indexed unlockInitiator
    );

   
    
    event ManagerAssigned(address indexed manager);
    
    // Custom errors
    error ZeroAddress(string param);
    error InvalidAmount();
    error InvalidDuration();
    error InvalidCliffDuration();
    error InvalidStartTime();
    error InvalidScheduleId();
    error NotBeneficiary();
    error NoTokensDue();
    error TransferFailed();
    error ScheduledRevoked();
    error AmountExceedsRemaining();
    error NoTokensToRevoke();
    error NotAuthorized();
    error NotAllocated();
    error InvalidVestingId();
    error VestingAlreadyRevoked();
    error EmptyBeneficiariesList();
    error ArraysLengthMismatch();
    error InvalidBeneficiary();
    error InvalidAmountInBatch();
    error InvalidAddress();
    error CannotRemoveSelf();
    error CannotAddSelf();

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
     * @param _abcToken Address of the ABCToken contract
     * @param _tokenVault Address of the TokenVault contract
     * @param _admin Address of the admin
     * @notice Can only be called once
     */
    function initialize(address _abcToken, address _tokenVault, address _admin) external initializer {

        // Validate input parameters
        if (_abcToken == address(0)) revert ZeroAddress("token");
        if (_tokenVault == address(0)) revert ZeroAddress("vault");
        if (_admin == address(0)) revert ZeroAddress("admin");

        // Initialize inherited contracts
        __AccessControl_init();
        __UUPSUpgradeable_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        
        // Set contract addresses
        abcToken = ITTNToken(_abcToken);
        tokenVault = ITokenVault(_tokenVault);
        
        // Grant admin roles to specified admin
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        
        // Initialize counters
        _vestingScheduleCounter = 0;
    }

    /**
     * @dev Creates a vesting schedule for a beneficiary
     * @param beneficiary Address to receive vested tokens
     * @param totalAmount Total amount of tokens to vest
     * @param startTime Unix timestamp when vesting begins
     * @param cliffDuration Duration in seconds until first tokens unlock
     * @param duration Total duration of vesting in seconds
     * @param allocationId ID of the allocation in TokenVault
     * @return scheduleId Unique identifier for the vesting schedule
     */
    function createVestingSchedule(
        address beneficiary,
        uint256 totalAmount,
        uint256 startTime,
        uint256 cliffDuration,
        uint256 duration,
        uint256 allocationId
    ) 
        external 
        whenNotPaused
        nonReentrant
        returns (uint256) 
    {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender) && !tokenVault.isManager(msg.sender)) {
            revert NotAuthorized();
        }

        if (beneficiary == address(0)) revert ZeroAddress("beneficiary");
        if (totalAmount == 0) revert InvalidAmount();
        if (duration == 0) revert InvalidDuration();
        if (duration < cliffDuration) revert InvalidCliffDuration();
        if (startTime < block.timestamp) revert InvalidStartTime();

        // Check allocation exists and has enough amount only if allocationId is not 0
        if (allocationId != 0) {
            (uint256 allocatedAmount, address allocationBeneficiary, bool revoked) = tokenVault.getAllocationById(allocationId);
            if (allocationBeneficiary != beneficiary) revert NotBeneficiary();
            if (revoked) revert NotAllocated();
            if (allocatedAmount < totalAmount) revert InvalidAmount();
        }
        
        // Increment vesting schedule counter
        _vestingScheduleCounter++;
        
        // Create new vesting schedule
        vestingSchedules[_vestingScheduleCounter] = VestingSchedule({
            beneficiary: beneficiary,
            totalAmount: totalAmount,
            startTime: startTime,
            cliffDuration: cliffDuration,
            duration: duration,
            releasedAmount: 0,
            revoked: false,
            createdAt: block.timestamp,
            allocationId: allocationId
        });
        
        // Add schedule ID to beneficiary's list
        beneficiarySchedules[beneficiary].push(_vestingScheduleCounter);
        
        emit VestingScheduleCreated(
            _vestingScheduleCounter,
            beneficiary,
            totalAmount,
            startTime,
            cliffDuration,
            duration,
            allocationId
        );
        
        return _vestingScheduleCounter;
    }

    /**
     * @dev Calculates the amount of tokens that can be released from a schedule
     * @param scheduleId ID of the vesting schedule
     * @return The amount of tokens that can be released
     */
    function computeReleasableAmount(uint256 scheduleId) internal view returns (uint256) {
        if (scheduleId == 0 || scheduleId > _vestingScheduleCounter) revert InvalidScheduleId();
        
        VestingSchedule storage schedule = vestingSchedules[scheduleId];
        
        // If schedule is revoked, nothing can be released
        if (schedule.revoked) {
            return 0;
        }
        
        // If current time is before cliff, nothing can be released
        if (block.timestamp < schedule.startTime + schedule.cliffDuration) {
            return 0;
        }
        
        // If vesting has finished, all remaining tokens can be released
        if (block.timestamp >= schedule.startTime + schedule.duration) {
            return schedule.totalAmount - schedule.releasedAmount;
        }
        
        // Calculate linear vesting amount
        uint256 timeFromStart = block.timestamp - schedule.startTime;
        uint256 vestedAmount = (schedule.totalAmount * timeFromStart) / schedule.duration;
        
        return vestedAmount - schedule.releasedAmount;
    }

    /**
     * @dev Allows beneficiary to claim released tokens from a schedule
     * @param scheduleId ID of the vesting schedule
     * @return The amount of tokens claimed
     */
    function claimVestedTokens(uint256 scheduleId) 
        external 
        whenNotPaused
        nonReentrant
        returns (uint256) 
    {
        if (scheduleId == 0 || scheduleId > _vestingScheduleCounter) revert InvalidScheduleId();
        
        VestingSchedule storage schedule = vestingSchedules[scheduleId];
        if (schedule.revoked) revert ScheduledRevoked();
        if (msg.sender != schedule.beneficiary) revert NotBeneficiary();
        
        uint256 releasableAmount = computeReleasableAmount(scheduleId);
        if (releasableAmount == 0) revert NoTokensDue();
        
        // Update released amount
        schedule.releasedAmount += releasableAmount;
        
    
        
        // Mint tokens to beneficiary
        abcToken.mint(schedule.beneficiary, releasableAmount);
        
        // Reduce the allocated amount in TokenVault if allocationId is set
        if (schedule.allocationId > 0) {
            (uint256 allocatedAmount, , bool revoked) = tokenVault.getAllocationById(schedule.allocationId);
            if (!revoked && allocatedAmount >= releasableAmount) {
                tokenVault.reduceAllocation(schedule.allocationId, releasableAmount);
            }
        }

        // Mark schedule as revoked if all tokens are claimed
        if (schedule.releasedAmount >= schedule.totalAmount) {
            schedule.revoked = true;
        }
        
        emit TokensReleased(scheduleId, schedule.beneficiary, releasableAmount);
        
        return releasableAmount;
    }

    /**
     * @dev Manually unlocks tokens from a vesting schedule
     * @param scheduleId ID of the vesting schedule
     * @param amount Amount of tokens to unlock
     * @return success Whether the manual unlock was successful
     */
    function manualUnlock(uint256 scheduleId, uint256 amount) 
        external
        nonReentrant
        returns (bool) 
    {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender) && !tokenVault.isManager(msg.sender)) {
            revert NotAuthorized();
        }
        if (scheduleId == 0 || scheduleId > _vestingScheduleCounter) revert InvalidScheduleId();
        if (amount == 0) revert InvalidAmount();
        
        VestingSchedule storage schedule = vestingSchedules[scheduleId];
        if (schedule.revoked) revert ScheduledRevoked();
        
        uint256 remainingAmount = schedule.totalAmount - schedule.releasedAmount;
        if (amount > remainingAmount) revert AmountExceedsRemaining();
        
        // Update released amount
        schedule.releasedAmount += amount;
        
        // Mint tokens to beneficiary
        abcToken.mint(schedule.beneficiary, amount);

        // Reduce the allocated amount in TokenVault if allocationId is set
        if (schedule.allocationId > 0) {
            (uint256 allocatedAmount, , bool revoked) = tokenVault.getAllocationById(schedule.allocationId);
            if (!revoked && allocatedAmount >= amount) {
                tokenVault.reduceAllocation(schedule.allocationId, amount);
            }
        }
        
        emit ManualUnlock(scheduleId, schedule.beneficiary, amount, msg.sender);
        
        return true;
    }

    /**
     * @dev Revokes a vesting schedule
     * @param scheduleId ID of the vesting schedule to revoke
     * @return The amount of assigned tokens revoked.
     */
    function revokeSchedule(uint256 scheduleId) 
        external 
        nonReentrant
        returns (uint256) 
    {
         if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender) && !tokenVault.isManager(msg.sender)) {
            revert NotAuthorized();
        }
        if (scheduleId == 0 || scheduleId > _vestingScheduleCounter) revert InvalidScheduleId();
        
        VestingSchedule storage schedule = vestingSchedules[scheduleId];
        if (schedule.revoked) revert ScheduledRevoked();
        
        // Calculate unvested amount
        uint256 unvestedAmount = schedule.totalAmount - schedule.releasedAmount;
        
        // Ensure there are tokens to revoke
        if (unvestedAmount == 0) revert NoTokensToRevoke();
        
        // Mark schedule as revoked
        schedule.revoked = true;
        
        // Revoke allocation in TokenVault if allocationId is set
        if (schedule.allocationId > 0) {
            tokenVault.revokeAllocation(schedule.allocationId);
        }
        
        emit ScheduleRevoked(scheduleId, schedule.beneficiary, unvestedAmount);
        
        return unvestedAmount;
    }

    /**
     * @dev Returns all vesting schedules for a beneficiary
     * @param beneficiary Address to check schedules for
     * @return scheduleIds Array of schedule IDs for the beneficiary
     */
    function getSchedulesForBeneficiary(address beneficiary) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return beneficiarySchedules[beneficiary];
    }

    /**
     * @dev Returns vesting schedule details
     * @param scheduleId ID of the vesting schedule
     * @return VestingSchedule structure with all details
     */
    function getVestingSchedule(uint256 scheduleId) 
        external 
        view 
        returns (VestingSchedule memory) 
    {
        if (scheduleId == 0 || scheduleId > _vestingScheduleCounter) revert InvalidScheduleId();
        return vestingSchedules[scheduleId];
    }

    /**
     * @dev Returns vesting info for a schedule
     * @param scheduleId ID of the vesting schedule
     * @return totalAmount Total amount of tokens in the schedule
     * @return releasedAmount Amount of tokens already released
     * @return releasableAmount Amount of tokens currently releasable
     * @return remainingAmount Amount of tokens still locked
     * @return nextUnlockTime Unix timestamp of next unlock (or 0 if fully vested)
     */
    function getVestingInfo(uint256 scheduleId) 
        external 
        view 
        returns (
            uint256 totalAmount,
            uint256 releasedAmount,
            uint256 releasableAmount,
            uint256 remainingAmount,
            uint256 nextUnlockTime
        ) 
    {
        if (scheduleId == 0 || scheduleId > _vestingScheduleCounter) revert InvalidScheduleId();
        
        VestingSchedule storage schedule = vestingSchedules[scheduleId];
        releasableAmount = computeReleasableAmount(scheduleId);
        
        totalAmount = schedule.totalAmount;
        releasedAmount = schedule.releasedAmount;
        remainingAmount = schedule.totalAmount - schedule.releasedAmount - releasableAmount;
        
        // Calculate next unlock time
        if (block.timestamp < schedule.startTime + schedule.cliffDuration) {
            // Cliff hasn't been reached yet
            nextUnlockTime = schedule.startTime + schedule.cliffDuration;
        } else if (block.timestamp >= schedule.startTime + schedule.duration) {
            // Fully vested
            nextUnlockTime = 0;
        } else {
            // Linear vesting in progress
            nextUnlockTime = block.timestamp + 1 days; // Next day for linear vesting
        }
    }

    /**
     * @dev Pauses vesting operations
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @dev Unpauses vesting operations
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
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}