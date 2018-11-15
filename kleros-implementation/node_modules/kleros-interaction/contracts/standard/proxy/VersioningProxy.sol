pragma solidity ^0.4.15;

import "./Proxy.sol";

/**
 *  @title VersioningProxy
 *  @author Enrique Piqueras - <epiquerass@gmail.com>
 *  @notice A base contract derived from Proxy for managing the deployment of versions of another contract, the managed contract.
 */
contract VersioningProxy is Proxy {
    /* Structs */

    struct Deployment {
        bytes32 tag;
        address _address;
    }

    /* Events */

    /**
     * @notice Called whenever 'stable' changes for off-chain handling.
     * @param _prevTag The previous 'stable' managed contract version tag.
     * @param _prevAddress The previous 'stable' managed contract address.
     * @param _nextTag The next 'stable' managed contract version tag.
     * @param _nextAddress The next 'stable' managed contract address.
     */
    event OnStableChange(bytes32 _prevTag, address _prevAddress, bytes32 _nextTag, address _nextAddress);

    /* Storage */

    // Owner and Creation Metadata
    address public owner = msg.sender;
    uint256 public creationTime = now;

    // Deployments
    bytes32[] public tags; // We keep this so we can iterate over versions
    mapping (bytes32 => address) public addresses;
    Deployment public stable;

    /* Modifiers */

    /**
     *  @dev Makes a function only callable by the owner of this contract.
     */
    modifier onlyOwner {
        require(owner == msg.sender);
        _;
    }

    /* Constructor */

    /**
     *  @notice Constructs the versioning proxy with the proxy eternal storage flag and the first version of the managed contract, `firstTag`, at `firstAddress`.
     *  @param _firstTag The version tag of the first version of the managed contract.
     *  @param _firstAddress The address of the first verion of the managed contract.
     */
    function VersioningProxy(bytes32 _firstTag, address _firstAddress) Proxy(_firstAddress) public {
        publish(_firstTag, _firstAddress);
    }

    /* External */

    /**
     * @notice Rolls back 'stable' to the previous deployment, and returns true, if one exists, returns false otherwise.
     * @return True if there was a previous version and the rollback succeeded, false otherwise.
     */
    function rollback() external onlyOwner returns(bool _success) {
        uint256 tagsLen = tags.length;
        if (tagsLen <= 2) // We don't have a previous deployment, return false
            return false;

        // Roll back and return true
        bytes32 prevTag = tags[tagsLen - 2];
        setStable(prevTag);
        return true;
    }

    /* External Views */

    /**
     * @notice Returns all deployed version tags.
     * @return All of the deployed version tags.
     */
    function allTags() external view returns(bytes32[] _tags) {
        return tags;
    }

    /* Public */

    /**
     *  @notice Publishes the next version of the managed contract, `nextTag`, at `nextAddress`.
     *  @param _nextTag The next version tag.
     *  @param _nextAddress The next address of the managed contract.
     */
    function publish(bytes32 _nextTag, address _nextAddress) public onlyOwner {
        // Publish
        tags.push(_nextTag); // Push next tag
        addresses[_nextTag] = _nextAddress; // Set next address

        // Set 'stable'
        setStable(_nextTag);
    }

    /**
     *  @notice Sets the value of 'stable' to the address of `nextTag`.
     *  @param _nextTag The already published version tag.
     */
    function setStable(bytes32 _nextTag) public onlyOwner {
        // Make sure this version has already been published
        address nextAddress = addresses[_nextTag];
        require(nextAddress != address(0));

        // Save current tag and address for handlers
        bytes32 prevTag = stable.tag;
        address prevAddress = stable._address;
    
        // Set 'stable'
        stable = Deployment({tag: _nextTag, _address: nextAddress});

        // Call handler and fire event
        handleStableChange(prevTag, prevAddress, _nextTag, nextAddress); // on-chain
        OnStableChange(prevTag, prevAddress, _nextTag, nextAddress); // off-chain

        // Change proxy target
        implementation = nextAddress;
    }

    /* Private */

    /**
     * @notice Called whenever 'stable' changes for on-chain handling.
     * @dev Overwrite this function to handle 'stable' changes on-chain.
     * @param _prevTag The previous 'stable' managed contract version tag.
     * @param _prevAddress The previous 'stable' managed contract address.
     * @param _nextTag The next 'stable' managed contract version tag.
     * @param _nextAddress The next 'stable' managed contract address.
     */
    function handleStableChange(bytes32 _prevTag, address _prevAddress, bytes32 _nextTag, address _nextAddress) private {}
}
