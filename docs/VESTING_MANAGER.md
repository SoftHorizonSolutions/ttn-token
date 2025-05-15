# Vesting Manager Documentation

## Overview
The Vesting Manager is a smart contract that handles token vesting schedules for TTNToken allocations. It manages the gradual distribution of tokens to beneficiaries according to predefined vesting schedules.

## Core Components

### Vesting Schedule
```solidity
struct VestingSchedule {
    uint256 totalAmount;      // Total amount of tokens to be vested
    uint256 startTime;        // Start time of the vesting period
    uint256 duration;         // Duration of the vesting period
    uint256 cliffDuration;    // Duration of the cliff period
    uint256 releasedAmount;   // Amount of tokens already released
    bool revocable;          // Whether the schedule can be revoked
    bool revoked;            // Whether the schedule has been revoked
}
```

### State Management
1. **Schedule Tracking**
   - Maps beneficiaries to their vesting schedules
   - Tracks released amounts
   - Manages revocation status

2. **Time Management**
   - Handles vesting start times
   - Manages cliff periods
   - Calculates vesting durations

## Key Functions

### Schedule Management

1. **Create Vesting Schedule**
```solidity
function createVestingSchedule(
    address beneficiary,
    uint256 startTime,
    uint256 cliffDuration,
    uint256 duration,
    uint256 totalAmount,
    bool revocable
) external
```
- Creates new vesting schedule
- Sets up vesting parameters
- Assigns tokens to schedule

2. **Release Vested Tokens**
```solidity
function release() external
```
- Releases available vested tokens
- Calculates vested amount
- Transfers tokens to beneficiary

3. **Revoke Schedule**
```solidity
function revokeSchedule(address beneficiary) external
```
- Revokes vesting schedule
- Returns unvested tokens
- Updates schedule status

### View Functions

1. **Get Vesting Schedule**
```solidity
function getVestingSchedule(address beneficiary) external view returns (VestingSchedule memory)
```
- Returns schedule details
- Shows vesting progress
- Displays release status

2. **Calculate Vested Amount**
```solidity
function calculateVestedAmount(address beneficiary) external view returns (uint256)
```
- Computes currently vested amount
- Considers time elapsed
- Accounts for cliff period

## Events

1. **Schedule Events**
```solidity
event VestingScheduleCreated(
    address indexed beneficiary,
    uint256 startTime,
    uint256 duration,
    uint256 totalAmount
)
event TokensReleased(
    address indexed beneficiary,
    uint256 amount
)
event ScheduleRevoked(
    address indexed beneficiary,
    uint256 returnedAmount
)
```

## Security Features

### Access Control
1. **Role Management**
   - Admin controls
   - Schedule creation permissions
   - Revocation rights

2. **Safety Checks**
   - Schedule existence validation
   - Amount validation
   - Time parameter checks

### Protection Mechanisms
1. **Reentrancy Guards**
   - Protected release function
   - Secure revocation process

2. **Time Validation**
   - Future start time validation
   - Cliff period checks
   - Duration validation

## Integration Guidelines


### Best Practices

1. **Schedule Creation**
   - Validate parameters
   - Consider timezone differences
   - Use appropriate durations

2. **Token Release**
   - Check vested amounts first
   - Handle failed releases
   - Track release history

3. **Revocation**
   - Verify revocation rights
   - Calculate returned amounts
   - Update beneficiary status


## Common Use Cases

### Managing Vesting Schedules
1. Creating employee token allocations
2. Setting up advisor vesting
3. Managing investor token distribution
4. Handling team token vesting

### Token Release Management
1. Automated releases
2. Manual release triggers
3. Release amount calculations
4. Release history tracking

### Schedule Administration
1. Schedule revocation
2. Parameter updates
3. Status monitoring
4. Compliance tracking

## Error Handling

### Common Errors
1. Invalid schedule parameters
2. Insufficient tokens
3. Unauthorized access
4. Invalid timing

### Best Practices
1. Validate inputs
2. Check permissions
3. Handle edge cases
4. Provide clear error messages 