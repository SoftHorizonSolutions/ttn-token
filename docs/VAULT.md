# TokenVault Documentation

## Overview
The TokenVault contract serves as the primary token management system for TTNToken. It handles token allocations, airdrops, and serves as the main interface for token distribution and management.

## Core Components

### Role System
The vault implements a comprehensive role-based access control system with the following roles:

1. **DEFAULT_ADMIN_ROLE**
   - Manages all roles
   - Controls pause/unpause functionality
   - Sets vesting manager address

2. **ALLOCATOR_ROLE**
   - Creates token allocations
   - Revokes existing allocations
   - Manages individual token distributions

3. **AIRDROP_ROLE**
   - Executes batch token distributions
   - Manages airdrop operations

4. **UPGRADER_ROLE**
   - Controls contract upgrades
   - Manages implementation changes

### State Management
The vault maintains several key state variables:

1. **Allocation Tracking**
```solidity
struct Allocation {
    uint256 amount;
    address beneficiary;
    bool revoked;
}
```
- Tracks individual token allocations
- Maintains allocation status
- Links beneficiaries to amounts

2. **Counters**
- `_allocationCounter`: Tracks total allocations
- `_airdropCounter`: Tracks total airdrops

3. **Mappings**
```solidity
mapping(uint256 => Allocation) public allocations;
mapping(address => uint256[]) public beneficiaryAllocations;
```
- Links allocation IDs to allocation data
- Tracks all allocations per beneficiary

## Key Functions

### Allocation Management

1. **Create Allocation**
```solidity
function createAllocation(address beneficiary, uint256 amount) external returns (uint256)
```
- Creates new token allocation
- Mints tokens to beneficiary or vesting manager
- Returns unique allocation ID
- Emits `AllocationCreated` event

2. **Revoke Allocation**
```solidity
function revokeAllocation(uint256 allocationId) external returns (bool)
```
- Revokes existing allocation
- Updates allocation status
- Emits `AllocationRevoked` event

### Airdrop Management

1. **Execute Airdrop**
```solidity
function executeAirdrop(address[] calldata beneficiaries, uint256[] calldata amounts) external returns (uint256)
```
- Distributes tokens to multiple addresses
- Creates individual allocations
- Returns unique airdrop ID
- Emits `AirdropExecuted` event

### System Management

1. **Vesting Manager**
```solidity
function setVestingManager(address _vestingManager) external
```
- Sets vesting manager address
- Controls token distribution flow
- Emits `VestingManagerSet` event

2. **Pause Control**
```solidity
function pause() external
function unpause() external
```
- Controls system pause state
- Affects allocation and airdrop operations

## Events

1. **Allocation Events**
```solidity
event AllocationCreated(address indexed beneficiary, uint256 amount, uint256 allocationId)
event AllocationRevoked(address indexed beneficiary, uint256 amount, uint256 allocationId)
```

2. **Airdrop Events**
```solidity
event AirdropExecuted(address[] beneficiaries, uint256[] amounts, uint256 airdropId)
```

3. **System Events**
```solidity
event VestingManagerSet(address indexed vestingManager)
```

## Error Handling

### Custom Errors
```solidity
error ZeroAddress(string param)
error InvalidAmount()
error InvalidAllocationId()
error AllocationAlreadyRevoked()
error EmptyBeneficiariesList()
error ArraysLengthMismatch()
error InvalidBeneficiary()
error InvalidAmountInBatch()
```

## Security Features

### Access Control
- Role-based access control
- Function-level permission checks
- Admin-controlled role management

### Safety Mechanisms
1. **Reentrancy Protection**
   - NonReentrant modifier on critical functions
   - Prevents reentrant attacks

2. **Pausable Operations**
   - Emergency pause functionality
   - Controlled by admin

3. **Input Validation**
   - Address validation
   - Amount validation
   - Array length checks

## Integration Guidelines

### Best Practices

1. **Error Handling**
   - Check for role requirements
   - Validate inputs before calls
   - Handle revert scenarios

2. **Event Monitoring**
   - Listen for relevant events
   - Update UI based on events
   - Track transaction status

3. **Gas Optimization**
   - Batch operations when possible
   - Estimate gas before transactions
   - Handle gas price fluctuations

## Common Use Cases

### Managing Allocations
1. Creating new allocations
2. Revoking existing allocations
3. Querying allocation status
4. Tracking beneficiary allocations

### Executing Airdrops
1. Preparing beneficiary lists
2. Validating amounts
3. Executing batch distributions
4. Monitoring airdrop status

### System Administration
1. Managing roles
2. Controlling pause state
3. Setting vesting manager
4. Monitoring system status

