/**
 *  @title Address Whitelist
 *  @author Clément Lesaege - <clement@lesaege.com>
 */

pragma solidity ^0.4.15;

import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "./AddressPermissionInterface.sol";

/**
 *  @title Address Whitelist
 *  This is a Whitelist for addresses. The owner contract can Whitelist addresses. 
 */
contract AddressWhitelist is Ownable, AddressPermissionInterface {
    
    mapping(address => bool) registred; // True if the address is registred.
    
    function add(address _value) onlyOwner {
        registred[_value]=true;
    }
    
    function remove(address _value) onlyOwner {
        registred[_value]=false;
    }
    
    /** @dev Return true is the address is allowed.
     *  @param _value The address we want to know if allowed.
     *  @return allowed True if the address is allowed, false otherwize.
     */
    function isPermitted(address _value) public returns (bool allowed) {
        return registred[_value];
    }
}