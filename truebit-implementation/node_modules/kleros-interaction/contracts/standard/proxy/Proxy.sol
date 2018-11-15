pragma solidity ^0.4.15;

/**
 *  @title Proxy
 *  @author Enrique Piqueras - <epiquerass@gmail.com>
 *  @notice A base proxy contract.
 */
contract Proxy {
    /* Storage */

    address public implementation;

    /* Constructor */

    /**
     * @notice Constructs the proxy with the initial 'implementation' contract address.
     * @param _implementation The initial 'implementation' contract address.
     */
    function Proxy(address _implementation) public {
        implementation = _implementation;
    }
}
