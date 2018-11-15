/**
 *  @title Arbitrable Transaction
 *  @author Clément Lesaege - <clement@lesaege.com>
 *  Bug Bounties: This code hasn't undertaken a bug bounty program yet.
 */


pragma solidity ^0.4.15;
import "./TwoPartyArbitrable.sol";

/** @title Arbitrable Transaction
 *  This is a a contract for an arbitrated transaction which can be reversed by the arbitrator.
 *  This can be used for buying goods, services and for paying freelancers.
 *  Party A is the payer. Party B is the payee.
 */
 contract ArbitrableTransaction is TwoPartyArbitrable {
    string constant RULING_OPTIONS = "Reimburse partyA;Pay partyB";
    
    uint public amount; // Amount sent by party A.
    
    
    /** @dev Constructor. Choose the arbitrator. Should be called by party A (the payer).
     *  @param _arbitrator The arbitrator of the contract.
     *  @param _hashContract Keccak hash of the plain English contract.
     *  @param _timeout Time after which a party automatically loose a dispute.
     *  @param _partyB The recipient of the transaction.
     *  @param _arbitratorExtraData Extra data for the arbitrator.
     */
    function ArbitrableTransaction(Arbitrator _arbitrator, bytes32 _hashContract, uint _timeout, address _partyB, bytes _arbitratorExtraData) TwoPartyArbitrable(_arbitrator,_hashContract,_timeout,_partyB,_arbitratorExtraData) payable {
        amount+=msg.value;
    }

    /** @dev Pay the party B. To be called when the good is delivered or the service rendered.
     */
    function pay() onlyPartyA {
        partyB.transfer(amount);
        amount=0;
    }
    
    /** @dev Reimburse party A. To be called if the good or service can't be fully provided.
     *  @param _amountReimbursed Amount to reimburse in wei.
     */
    function reimburse(uint _amountReimbursed) onlyPartyB {
        require(_amountReimbursed<=amount);
        partyA.transfer(_amountReimbursed);
        amount-=_amountReimbursed;
    }
    
    /** @dev Execute a ruling of a dispute. It reimburse the fee to the winning party.
     *  This need to be extended by contract inheriting from it.
     *  @param _disputeID ID of the dispute in the Arbitrator contract.
     *  @param _ruling Ruling given by the arbitrator. 1 : Reimburse the partyA. 2 : Pay the partyB.
     */
    function executeRuling(uint _disputeID, uint _ruling) internal {
        super.executeRuling(_disputeID,_ruling);
        if (_ruling==PARTY_A_WINS)
            partyA.send(amount);
        else if (_ruling==PARTY_B_WINS)
            partyB.send(amount);
            
        amount=0;
    }
    
    
 }
 
