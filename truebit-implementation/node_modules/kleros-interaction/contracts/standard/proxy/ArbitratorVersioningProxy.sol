pragma solidity ^0.4.15;

import "../arbitration/Arbitrator.sol";

import "./VersioningProxy.sol";

/**
 *  @title ArbitratorVersioningProxy
 *  @author Enrique Piqueras - <epiquerass@gmail.com>
 *  @notice An Arbitrator proxy that only exposes methods in the Arbitrator spec.
 */
contract ArbitratorVersioningProxy is Arbitrator, VersioningProxy {
     /* Structs */

    struct Dispute {
        address arbitrator;
        uint256 disputeID;
        uint256 choices;
    }

    /* Storage */

    Dispute[] public disputes;

    /* Modifiers */

    /**
     *  @dev Makes a function only callable if the dispute exists.
     *  @param _disputeID The ID of the dispute.
     */
    modifier onlyIfDisputeExists(uint256 _disputeID) {
        require(disputes[_disputeID].arbitrator != address(0));
        _;
    }

    /* Constructor */

    /**
     * @notice Constructs the arbitrator versioning proxy with the first arbitrator contract version address and tags it v0.0.1.
     * @param _firstAddress The address of the first arbitrator contract version.
     */
    function ArbitratorVersioningProxy(address _firstAddress) VersioningProxy("0.0.1", _firstAddress) public {}

    /* Public */

    function createDispute(uint256 _choices, bytes _extraData) public payable returns(uint256 _disputeID) {
        uint256 _arbitratorDisputeID = Arbitrator(implementation).createDispute.value(msg.value)(_choices, _extraData);
        return disputes.push(
            Dispute({
                arbitrator: implementation,
                disputeID: _arbitratorDisputeID,
                choices: _choices
            })
        );
    }

    function appeal(uint256 _disputeID, bytes _extraData) public payable onlyIfDisputeExists(_disputeID) {
        if (disputes[_disputeID].arbitrator != implementation) { // Arbitrator has been upgraded, create a new dispute in the new arbitrator
            uint256 _choices = disputes[_disputeID].choices;
            uint256 _arbitratorDisputeID = Arbitrator(implementation).createDispute.value(msg.value)(_choices, _extraData);
            disputes[_disputeID] = Dispute({ arbitrator: implementation, disputeID: _arbitratorDisputeID, choices: _choices });
        }
        
        Arbitrator(implementation).appeal.value(msg.value)(disputes[_disputeID].disputeID, _extraData);
    }

    /* Public Views */

    function arbitrationCost(bytes _extraData) public view returns(uint256 _fee) {
        return Arbitrator(implementation).arbitrationCost(_extraData);
    }

    function appealCost(uint256 _disputeID, bytes _extraData) public view returns(uint256 _fee) {
        return Arbitrator(implementation).appealCost(disputes[_disputeID].disputeID, _extraData);
    }

    function currentRuling(uint256 _disputeID) public view onlyIfDisputeExists(_disputeID) returns(uint256 _ruling) {
        return Arbitrator(disputes[_disputeID].arbitrator).currentRuling(disputes[_disputeID].disputeID);
    }

    function disputeStatus(uint256 _disputeID) public view onlyIfDisputeExists(_disputeID) returns(Arbitrator.DisputeStatus _status) {
        return Arbitrator(disputes[_disputeID].arbitrator).disputeStatus(disputes[_disputeID].disputeID);
    }
}
