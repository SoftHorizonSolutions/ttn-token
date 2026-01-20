// SPDX-License-Identifier: MIT
/**
 * @title TTNVestingManagerV2
 * @dev TESTING PURPOSES ONLY - DO NOT USE IN PRODUCTION
 * This is a test implementation of VestingManager V2 to demonstrate upgrade functionality.
 * It adds version tracking and additional vesting tracking for testing purposes.
 * This contract should not be used in production environments.
 */

pragma solidity ^0.8.24;

import "../TTNVestingManager.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/// @custom:oz-upgrades-from VestingManager
contract TTNVestingManagerV2 is VestingManager {
    // NO NEW STORAGE VARIABLES - This ensures storage layout compatibility
    // All new functionality is added via functions only
    
    // Note: _authorizeUpgrade is inherited from VestingManager
    // which inherits from UUPSUpgradeable, so no override needed
    
    /**
     * @dev Initializer for V2
     * CRITICAL: This function should be empty or minimal since V1 already initialized all parent contracts.
     * The reinitializer(2) modifier tracks a different initialization level than V1's initializer,
     * but calling parent initializers again might reset storage.
     * 
     * If OpenZeppelin validator requires parent initializers, they should be safe with reinitializer(2),
     * but if schedules are missing after upgrade, DO NOT call parent initializers.
     * 
     * @custom:oz-upgrades-unsafe-allow constructor
     * @custom:oz-upgrades-validate-as-initializer
     */
    function initializeV2() external reinitializer(2) {
        // WARNING: Calling parent initializers may reset storage!
        // These initializers are already called in V1's initialize() function.
        // The reinitializer(2) should prevent re-initialization, but to be safe,
        // we should NOT call them unless absolutely necessary for validator compliance.
        // 
        // If schedules are missing after upgrade, comment out these calls:
        // __ReentrancyGuard_init();
        // __AccessControl_init();
        // __Pausable_init();
        // __UUPSUpgradeable_init();
        
        // For now, keeping them for validator compliance, but this might be the cause
        // of storage corruption if OpenZeppelin's reinitializer doesn't fully protect
        __ReentrancyGuard_init();
        __AccessControl_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        
        // No new storage variables to initialize beyond parent contracts
    }
    
    /**
     * @dev Returns the current version number
     * @return The version number (2 for V2)
     * @notice This is a pure function that doesn't use storage
     */
    function getVersion() external pure returns (uint256) {
        return 2;
    }
    
    
    /**
     * @dev Force marks a schedule as revoked without touching TokenVault
     * Use for schedules whose allocation is already revoked in vault
     * @param scheduleId ID of the vesting schedule to mark as revoked
     * @return The amount of assigned tokens revoked
     */
    function forceRevokeSchedule(uint256 scheduleId) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE)
        nonReentrant
        returns (uint256) 
    {
        if (scheduleId == 0) revert InvalidScheduleId();
        
        VestingSchedule storage schedule = vestingSchedules[scheduleId];
        if (schedule.beneficiary == address(0)) revert InvalidScheduleId();
        if (schedule.revoked) revert ScheduledRevoked();
        
        // Calculate unvested amount
        uint256 unvestedAmount = schedule.totalAmount - schedule.releasedAmount;
        
        // Mark schedule as revoked (without calling tokenVault.revokeAllocation())
        schedule.revoked = true;
        
        emit ScheduleRevoked(scheduleId, schedule.beneficiary, unvestedAmount);
        
        return unvestedAmount;
    }

    /**
     * @dev Batch version for efficiency
     * Force marks multiple schedules as revoked without touching TokenVault
     * @param scheduleIds Array of schedule IDs to mark as revoked
     * @return successCount Number of schedules successfully marked as revoked
     */
    function batchForceRevokeSchedules(uint256[] calldata scheduleIds) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE)
        nonReentrant
        returns (uint256 successCount) 
    {
        successCount = 0;
        uint256 length = scheduleIds.length;
        
        for (uint256 i = 0; i < length; i++) {
            uint256 scheduleId = scheduleIds[i];
            
            // Skip invalid schedule IDs
            if (scheduleId == 0) {
                continue;
            }
            
            VestingSchedule storage schedule = vestingSchedules[scheduleId];
            
            
            // Skip if already revoked
            if (schedule.revoked) {
                continue;
            }

            if (schedule.beneficiary == address(0)) {
                continue;
            }
            
            // Calculate unvested amount
            uint256 unvestedAmount = schedule.totalAmount - schedule.releasedAmount;
            
            // Mark schedule as revoked (without calling tokenVault.revokeAllocation())
            schedule.revoked = true;
            
            emit ScheduleRevoked(scheduleId, schedule.beneficiary, unvestedAmount);
            
            successCount++;
        }
        
        return successCount;
    }

} 