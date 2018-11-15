/**
 *  @title Address Blacklist
 *  @author Clément Lesaege - <clement@lesaege.com>
 */

pragma solidity ^0.4.15;

import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "./AddressWhitelist.sol";

/**
 *  @title Address Blacklist
 *  This is a Blacklist for addresses. The owner contract can Blacklist addresses. 
 */
contract AddressBlacklist is AddressWhitelist {

    
    /** @dev Return true if the address is allowed.
     *  @param _value The address we want to know if allowed.
     *  @return allowed True if the address is allowed, false otherwize.
     */
    function isPermitted(address _value) public returns (bool allowed) {
        return !super.isPermitted(_value);
    }
}