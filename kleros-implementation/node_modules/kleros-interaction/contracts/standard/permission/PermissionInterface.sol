/**
 *  @title Permission Interface
 *  @author Clément Lesaege - <clement@lesaege.com>
 */

pragma solidity ^0.4.15;

/**
 *  @title Permission Interface
 *  This is a permission interface for arbitrary values. The values can be cast to the required types.
 */
interface PermissionInterface{
    /** @dev Return true is the value is allowed.
     *  @param _value The value we want to know if allowed.
     *  @return allowed True if the value is allowed, false otherwise.
     */
    function isPermitted(bytes32 _value) public returns (bool allowed);
}
