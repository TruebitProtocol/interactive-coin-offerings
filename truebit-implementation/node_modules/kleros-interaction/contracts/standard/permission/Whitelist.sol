/**
 *  @title Whitelist
 *  @author Clément Lesaege - <clement@lesaege.com>
 */

pragma solidity ^0.4.15;

import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "./PermissionInterface.sol";

/**
 *  @title Whitelist
 *  This is a Whitelist for arbitrary values. The owner contract can whitelist values. 
 */
contract Whitelist is Ownable, PermissionInterface {
    
    mapping(bytes32 => bool) registred; // True if the address is registered.
    
    function add(bytes32 _value) onlyOwner {
        registred[_value]=true;
    }
    
    function remove(bytes32 _value) onlyOwner {
        registred[_value]=false;
    }
    
    /** @dev Return true if the value is allowed.
     *  @param _value The value we want to know if allowed.
     *  @return allowed True if the value is allowed, false otherwise.
     */
    function isPermitted(bytes32 _value) public returns (bool allowed) {
        return registred[_value];
    }
}