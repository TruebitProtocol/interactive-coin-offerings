pragma solidity ^0.4.15;

/**
 *  @title ExperimentalProxy
 *  @author Enrique Piqueras - <epiquerass@gmail.com>
 *  @notice An experimental base proxy contract that forwards all calls to the 'implementation' contract and optionally keeps all storage.
 */
contract ExperimentalProxy {
    /* Storage */

    bool public storageIsEternal;
    address public implementation;

    /* Constructor */

    /**
     * @notice Constructs the proxy with the eternal storage flag and an initial 'implementation' contract address.
     * @param _storageIsEternal Wether this contract should store all storage. I.e. Use 'delegatecall'.
     * @param _implementation The initial 'implementation' contract address.
     */
    function ExperimentalProxy(bool _storageIsEternal, address _implementation) public {
        storageIsEternal = _storageIsEternal;
        implementation = _implementation;
    }

    /* Fallback */

    /**
     * @notice The fallback function that forwards calls to the 'implementation' contract.
     * @return The result of calling the requested function on the 'implementation' contract.
     */
    function () payable external {
        require(implementation != address(0)); // Make sure address is valid

        // Store necessary data for assembly in local memory
        bool _storageIsEternal = storageIsEternal;
        bytes memory _data = msg.data;
        address _implementation = getImplementation(msg.sig, _data);

        // Return data
        bytes memory _retData;

        assembly {
            // Start of payload raw data (skip over size slot)
            let _dataPtr := add(_data, 0x20)
            
            // Payload's size
            let _dataSize := mload(_data)

            // Figure out what OPCODE to use and forward call
            let _result
            switch _storageIsEternal
            case 0 { // Not eternal, use implementation's storage
                _result := call(gas, _implementation, callvalue, _dataPtr, _dataSize, 0, 0)
            }
            default { // Eternal, use current contract's storage
                _result := delegatecall(gas, _implementation, _dataPtr, _dataSize, 0, 0)
            }

            // Size of the returned data
            let _retSize := returndatasize

            let _retPtr := mload(0x40) // Start of free memory
            let _retDataPtr := add(_retPtr, 0x20) // Make space for 'bytes' size
    
            // Build `_retData` 'bytes'
            mstore(_retPtr, _retSize) // Copy size
            returndatacopy(_retDataPtr, 0, _retSize) // Copy returned data
    
            // Figure out wether to revert or continue with the returned data
            switch _result
            case 0 { // Error
                revert(_retDataPtr, _retSize)
            }
            default { // Success
                _retData := _retPtr
            }
        }

        // Call on-chain handler
        handleProxySuccess(msg.sig, _data, _retData);

        assembly {
            return(add(_retData, 0x20), mload(_retData)) // Return returned data
        }
    }

    /* Private */

    /**
     * @notice On-chain handler that gets called with call data and the 'implementation' contract's return data after a call is successfully proxied.
     * @dev Overwrite this function to handle the results of proxied calls in this contract.
     * @param _sig The function signature of the called function.
     * @param _data The data passed into the call.
     * @param _retData The return data of the 'implementation' contract for the proxied call.
     */
    function handleProxySuccess(bytes4 _sig, bytes _data, bytes _retData) private {}

    /* Private Views */

    /**
     * @notice Function for dynamically getting the 'implementation' contract address.
     * @dev Overwrite this function to implement custom resolving logic based on the function being called and the data passed in.
     * @param _sig The function signature of the called function.
     * @param _data The data passed into the call.
     * @return The resolved 'implementation' contract address.
     */
    function getImplementation(bytes4 _sig, bytes _data) private view returns(address _implementation) { return implementation; }
}
