/**
 *  @title Blacklist
 *  @author Clément Lesaege - <clement@lesaege.com>
 */

pragma solidity ^0.4.15;

import "./Whitelist.sol";

/**
 *  @title Address Blacklist
 *  This is a Blacklist for arbitrary values. The owner contract can Blacklist addresses. 
 */
contract Blacklist is Whitelist {

    
    /** @dev Return true is the address is allowed.
     *  @param _value The address we want to know if allowed.
     *  @return allowed True if the address is allowed, false otherwize.
     */
    function isPermitted(bytes32 _value) public returns (bool allowed) {
        return !super.isPermitted(_value);
    }
}