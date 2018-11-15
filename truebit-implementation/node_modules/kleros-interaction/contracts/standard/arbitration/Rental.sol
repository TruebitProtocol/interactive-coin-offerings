/**
 *  @title Rental
 *  @author Clément Lesaege - <clement@lesaege.com>
 *  Bug Bounties: This code hasn't undertaken a bug bounty program yet.
 */


pragma solidity ^0.4.15;
import "./TwoPartyArbitrable.sol";

/** @title Rental
 *  This is a a contract for rental agreement.
 *  This can be used to rent objects or properties.
 *  Party A is the renter. Party B is the owner.
 *  Party A put a deposit. If everything goes well, it will be given back. 
 *  Otherwize parties can claim an amount of damages. If they disagree, the arbitrator will have to solve this dispute.
 */
 contract Rental is TwoPartyArbitrable {
    string constant RULING_OPTIONS = "Rule for party A (renter);Rule for Party B (owner)";
    
    uint public amount; // Amount sent by party A.
    uint public damagesClaimedByPartyA; // The amount party A agrees to pay to compensate damages.
    uint public damagesClaimedByPartyB; // The amount party B claims to compensate damages.
    
    /** @dev Constructor. Choose the arbitrator. Should be called by party A (the payer).
     *  @param _arbitrator The arbitrator of the contract.
     *  @param _hashContract Keccak hash of the plain English contract.
     *  @param _timeout Time after which a party automatically loose a dispute.
     *  @param _partyB The owner.
     *  @param _arbitratorExtraData Extra data for the arbitrator.
     */
    function Rental(Arbitrator _arbitrator, bytes32 _hashContract, uint _timeout, address _partyB, bytes _arbitratorExtraData) public TwoPartyArbitrable(_arbitrator,_hashContract,_timeout,_partyB,_arbitratorExtraData) payable {
        amount+=msg.value;
    }

    /** @dev Claim an amount of damages.
     *  Must be called before the dispute is created.
     *  If the amount agreed is the same for both, pay it.
     *  @param _damages The amount asked or agreed to be paid.
     */
    function claimDamages(uint _damages) public onlyParty {
        require(status<Status.DisputeCreated); // Make sure that parties can't change when a dispute already started.
        require(_damages!=0); // Needed to avoid claiming 0 first and triggering an agreement. Use forfeitDeposit and unlockDeposit for the cases where 0 is claimed.
        require(_damages<=amount); // Make sure not to claim more than the contract has.
        
        if (msg.sender==partyA)
            damagesClaimedByPartyA=_damages;
        else
            damagesClaimedByPartyB=_damages;
            
        if (damagesClaimedByPartyA==damagesClaimedByPartyB) { // If there is an agreement.
            partyA.send((amount-damagesClaimedByPartyB)+partyAFee);
            partyB.send(damagesClaimedByPartyB+partyBFee);
            damagesClaimedByPartyA=0;
            damagesClaimedByPartyB=0;
            partyAFee=0;
            partyBFee=0;
            amount=0;
            status=Status.Resolved;
        }
    }
    

    

    /** @dev Forfeit the deposit to party B.
     *  To be called if the good has been completely broken or that the property damages exceed the deposit.
     */
    function forfeitDeposit() public onlyPartyA {
        partyB.transfer(amount);
        amount=0;
    }
    
    /** @dev Unlock party A deposit. To be called if the good or property has been returned without damages.
     */
    function unlockDeposit() public onlyPartyB {
        partyA.transfer(amount);
        amount=0;
    }
    
    /** @dev Execute a ruling of a dispute. It reimburse the fee to the winning party.
     *  This need to be extended by contract inheriting from it.
     *  @param _disputeID ID of the dispute in the Arbitrator contract.
     *  @param _ruling Ruling given by the arbitrator. 1 : Rule for party A (renter). 2 : Rule for Party B (owner).
     */
    function executeRuling(uint _disputeID, uint _ruling) internal {
        super.executeRuling(_disputeID,_ruling);
        if (_ruling==PARTY_A_WINS) {
            partyA.send(amount-damagesClaimedByPartyA);
            partyB.send(damagesClaimedByPartyA);
        }
        else if (_ruling==PARTY_B_WINS) {
            partyA.send(amount-damagesClaimedByPartyB);
            partyB.send(damagesClaimedByPartyB);
        }
        
        amount=0;
        damagesClaimedByPartyA=0;
        damagesClaimedByPartyB=0;
    }
    
    
 }
 
