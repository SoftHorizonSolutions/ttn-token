# Post-Audit Contract Changes


## Planned Changes to TTNToken Contract

### 1. Add Total Minted Function
```solidity
function getTotalMinted() external view returns (uint256) {
    return totalSupply();
}
```

### 2. Add Token Balance Function
```solidity
function getTokenBalance(address walletAddress) external view returns (uint256) {
    return balanceOf(walletAddress);
}
```

## Planned Changes to Access Control

### 3. Add New Admin Function
```solidity
function addAdmin(address newAdmin) external onlyAdmin {
    require(newAdmin != address(0), "Invalid admin address");
    _grantRole(ADMIN_ROLE, newAdmin);
    emit AdminAdded(newAdmin);
}
```

### 4. Remove Admin Function
```solidity
function removeAdmin(address admin) external onlyAdmin {
    require(admin != msg.sender, "Cannot remove self");
    require(getRoleMemberCount(ADMIN_ROLE) > 1, "Cannot remove last admin");
    _revokeRole(ADMIN_ROLE, admin);
    emit AdminRemoved(admin);
}
```

### 5. Access Control Simplification
- Remove all specific role names (VESTING_ADMIN_ROLE, MANUAL_UNLOCK_ROLE, etc.)
- Replace with single ADMIN_ROLE
- Update all function modifiers to use onlyAdmin
- Update role checks in all functions

### 6. Get All Admins Function
```solidity
function getAllAdmins() external view returns (address[] memory) {
    uint256 adminCount = getRoleMemberCount(ADMIN_ROLE);
    address[] memory admins = new address[](adminCount);
    
    for(uint256 i = 0; i < adminCount; i++) {
        admins[i] = getRoleMember(ADMIN_ROLE, i);
    }
    
    return admins;
}
```

### Implementation Notes
1. All new functions will be added to the appropriate contracts
2. Access control changes will require careful testing to ensure no functionality is broken
3. Events will be added for admin management functions.
4. Documentation will be updated to reflect these changes
5. New tests will be written for all new functions

### Security Considerations
1. Admin removal should prevent removal of the last admin
2. Admin addition should include proper validation
3. Role changes should be properly tested for access control
4. All changes should maintain existing security measures. 


## New Feature: Merkle Airdrop System

### Overview
Implementation of a gas-efficient Merkle tree-based airdrop system for $TTN tokens.


### Implementation Requirements
1. Integration with existing TTNToken contract.
2. Gas-efficient Merkle proof verification
3. Prevention of double claims
4. Admin controls for merkle root updates
5. Event emission for tracking claims

### Security Considerations
1. Proper validation of merkle proofs
2. Protection against double claims
3. Access control for merkle root updates
4. Gas optimization for claim function
5. Proper error handling and events

### Testing Requirements
1. Merkle tree generation and verification
2. Claim functionality
3. Double claim prevention
4. Admin controls
5. Gas usage optimization 