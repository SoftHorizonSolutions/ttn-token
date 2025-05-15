# TTNToken Admin Dashboard Requirements

## System Overview
The TTNToken system consists of three main components that need to be managed through the dashboard:
1. **TTNToken**: The core ERC20 token contract
2. **TokenVault**: The token management and distribution system
3. **VestingManager**: The vesting schedule management system

## Access Control System and Features

### User Roles & Features
The system has only the admin roles that need to be managed through the dashboard:

1. **ADMIN ROLE**
   - Highest level of access
   - Can manage all other roles
   - Can pause/unpause contracts
   - Can set the vesting manager address
   - Can manage other admins:
     - Parameters for admin management:
       - `account` (address): Address to grant/revoke admin role
     - Interface requirements:
       - Admin management section in dashboard
       - List of current admins with their addresses
       - Add admin button with address input
       - Remove admin button by only a super admin with confirmation dialog
       - Tranfer super admin ownership role to just admin

2. **FEATURES**
     - **CREATE ALLOCATION**: Only Admin can create
       - Parameters for allocation creation:
         - `beneficiary` (address): Address to receive the allocation
         - `amount` (uint256): Amount of tokens to allocate (in wei, 18 decimals)
         - If not an admin, throw an error
     - **REVOKE ALLOCATION**: Only Admin can revoke allocations
       - Parameters for allocation revocation:
         - `allocationId` (uint256): ID of the allocation to revoke
         - If not an admin or it has already been revoked or already revoked, throw an error
  
     - **GET ALLOCATION**: getAllocationsForBeneficiary
       - Parameters for viewing allocations:
         - `beneficiary` (address): Address to check allocations for
         - returns an array of what is allocated to the beneficiary in numbers.
       - Interface requirements:
         - Beneficiary address input with validation
         - Amount input with unit conversion helper
         - List view of all allocations
         - Revocation button with confirmation dialog
         - Transaction status tracking
         - Allocation Explorer Section:
           - Search bar for beneficiary address
           - Table view showing all allocations with columns:
             - Allocation ID
             - Amount
             - Creation Date
             - Status (Active/Revoked)
             - Actions (Revoke button for active allocations)
           - Filtering options:
             - By status (Active/Revoked)
             - By date range
             - By amount range
           - Sorting capabilities:
             - By Allocation ID
             - By Amount
             - By Date
           - Export functionality (CSV/Excel)
           - Pagination for large datasets
  

     - **EXECUTE AIRDROP**: Only Admin can execute airdrops
        - Parameters for airdrop:
          - `beneficiaries` (address[]): Array of addresses to receive tokens
          - `amounts` (uint256[]): Array of token amounts for each beneficiary
          - If not an admin or vault has been paused, throw an error
        - Interface requirements:
          - Bulk upload interface (CSV/Excel)
          - Manual entry option for small batches
          - Preview of airdrop distribution
          - Gas estimation for batch transaction
          - Progress tracking for large airdrops
  
     - **CREATE VESTING**: Only Admin can create vesting schedules
        - Parameters for vesting creation:
          - `beneficiary` (address): Address to receive the vested tokens
          - `totalAmount` (uint256): Total amount of tokens to be vested
          - `startTime` (uint256): Unix timestamp when vesting begins
          - `cliffDuration` (uint256): Duration of cliff period in seconds
          - `duration` (uint256): Total duration of vesting in seconds
          - `allocationId` (uint256): ID of the allocation to vest
        - Error conditions:
          - If not an admin, throw an error
          - If contract is paused, throw an error
          - If beneficiary is zero address, throw an error
          - If amounts or durations are invalid, throw an error
     
     - **MANUAL UNLOCK**: Only Admin can manually unlock vested tokens
         - Parameters for manual unlock:
           - `scheduleId` (uint256): ID of the vesting schedule
           - `amount` (uint256): Amount of tokens to unlock
           - Returns boolean.
         - Error conditions:
           - If not an admin, throw an error
           - If schedule doesn't exist, throw an error
           - If amount exceeds available tokens, throw an error
           - If reentrancy is detected, throw an error
         - Interface requirements:
           - Schedule ID selector from existing schedules
           - Amount input with validation
           - Confirmation dialog showing:
             - Schedule details
             - Amount to unlock
             - Beneficiary address
             - Current vesting progress
           - Success/failure notifications
  
     - **REVOKE SCHEDULE**: Only Admin can revoke vesting schedules
        - Parameters for schedule revocation:
          - `scheduleId` (uint256): ID of the vesting schedule to revoke
          - returns the remaining tokens in the schedule
        - Error conditions:
          - If not an admin, throw an error
          - If schedule doesn't exist, throw an error
          - If schedule is already revoked, throw an error
          - If reentrancy is detected, throw an error
        - Interface requirements:
          - Schedule ID selector from existing schedules
          - Warning message about revocation consequences
          - Double confirmation requirement for revocation.
          - Success/failure notifications with returned amount
  
     - **GET SCHEDULES FOR BENEFICIARY**: View function to get  all vesting schedules for a beneficiary.
        - Parameters:
          - `beneficiary` (address): Address to check schedules for
          - Returns an array of schedule IDs associated with the beneficiary.
  
     - **GET SCHEDULE FOR SCHEDULE-ID**: View function to get details of a specific vesting schedule
        - Parameters:
          - `scheduleId` (uint256): ID of the schedule to query
          - Returns a VestingSchedule struct containing:
            - totalAmount: Total tokens in the schedule
            - startTime: When vesting begins (timestamp)
            - cliffDuration: Length of cliff period
            - duration: Total vesting duration
            - releasedAmount: Tokens already released
            - createdAt: Schedule creation timestamp
            - allocationId: ID of the associated allocation
            - beneficiary: Address of recipient
            - revoked: Whether schedule is revoked
        - Interface requirements:
          - Schedule ID input field
          - Display all schedule details in a clear format.
  
     - **GET VESTING-INFO**: View function to get detailed vesting information for a schedule
         - Parameters:
           - `scheduleId` (uint256): ID of the schedule to query
         - Returns:
           - totalAmount (uint256): Total tokens in the schedule
           - releasedAmount (uint256): Amount of tokens already released
           - releasableAmount (uint256): Amount that can be released now
           - remainingAmount (uint256): Tokens still locked
           - nextUnlockTime (uint256): Timestamp of next token unlock
         - Interface requirements:
           - Schedule ID input field
           - Display vesting information in a clear format showing:
             - Total allocation amount
             - Already released tokens
             - Currently available for release
             - Still locked amount
             - Time until next unlock





## Technical Integration Requirements FOR DEVS

### Smart Contract Integration

1. **Token Contract Functions**
```solidity
function mint(address to, uint256 amount)
function pause()
function unpause()
function grantRole(bytes32 role, address account)
function revokeRole(bytes32 role, address account)
```

2. **Vault Contract Functions**
```solidity
function createAllocation(address beneficiary, uint256 amount)
function revokeAllocation(uint256 allocationId)
function executeAirdrop(address[] calldata beneficiaries, uint256[] calldata amounts)
function setVestingManager(address _vestingManager)
```

3. **Vesting Contract Functions**
```solidity
function createVestingSchedule(
    address beneficiary,
    uint256 startTime,
    uint256 cliffDuration,
    uint256 duration,
    uint256 totalAmount,
    bool revocable
)
function release()
function revokeSchedule(address beneficiary)
```


## UI/UX Requirements

### 1. Layout and Navigation
- Clean, modern interface
- Responsive design
- Intuitive navigation between sections
- Role-based menu visibility
- Quick access to common functions


### 2. Forms and Inputs
- Real-time validation
- Error messaging



## Security Requirements


### 1. Data Validation
- Input sanitization
- Address validation
- Amount verification
- Schedule parameter validation

## Error Handling

### 1. Contract Errors
- Zero address inputs
- Invalid amounts
- Unauthorized access
- Failed transactions
- Reverted operations

### 2. UI Error States
- Loading states
- Error messages
- Recovery flows
- Fallback displays


## Integration Guidelines

### 1. Web3 Integration
- Connect wallet support
- Network handling
- Transaction management
