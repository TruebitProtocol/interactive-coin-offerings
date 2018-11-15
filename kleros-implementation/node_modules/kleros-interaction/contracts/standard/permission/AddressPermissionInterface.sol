/**
 *  @title Address Permission Interface
 *  @author Clément Lesaege - <clement@lesaege.com>
 */

pragma solidity ^0.4.15;

/**
 *  @title Address Permission Interface
 *  This is a permission interface for addresses.
 */
interface AddressPermissionInterface{
    /** @dev Return true is the address is allowed.
     *  @param _value The address we want to know if allowed.
     *  @return allowed True if the address is allowed, false otherwise.
     */
    function isPermitted(address _value) public returns (bool allowed);
}
