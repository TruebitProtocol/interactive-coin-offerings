 /**
 *  @title Arbitrable Blacklist
 *  @author Clément Lesaege - <clement@lesaege.com>
 *  This code hasn't undertaken bug bounty program yet.
 *  This code requires truffle tests.
 */

pragma solidity ^0.4.18;


import "../arbitration/Arbitrable.sol";
import "./PermissionInterface.sol";

/**
 *  @title Arbitrable Blacklist
 *  This is a arbitrator curated blacklist registry. Anyone can post an item with a deposit. If no one complains within a defined time period, the item is added to the blacklist registry.
 *  Someone can complain and also post a deposit, if, someone does, a dispute is created. The winner of the dispute gets the deposit of the other party and the item is added or removed accordingly.
 *  During the time of the dispute, the item is shown as blacklisted unless it already won a dispute before. This follows the philosophy that it is better to show the user a warning about a potentially harmless listing than to take the risk of the user to be scammed or exposed to inappropriate content without warning.
 *  To make a request, parties have to deposit a stake and the arbitration fees. If the arbitration fees change between the submitter payment and the challenger payment, a part of the submitter stake can be used as an arbitration fee deposit.
 *  In case the arbitrator refuses to rule, the item is put in the initial absent status and the balance is split equally between parties.
 *  
 *  Example of uses of this blacklist contract are:
 *    - ENS blacklist: Blacklisted (hash of) names would lead to the user receiving a warning in its UI when trying to interact with one.
 *    - Social Network Safe For Work/Kids sections: Blacklist (hash of) words / sentences refering or leading to NSFW/NSFK content. This may be enforced by voluntary censorship on the UI or make participants violating the SFW/SFK rules lose a deposit.
 *    - Listing blacklist: Blacklist categories of items which are forbiden on a marketplace or market place section (it can be terms refering to weapons or child porn material). The mechanism can be similar to the SFW/SFK example.
 */
contract ArbitrableBlacklist is PermissionInterface, Arbitrable {
    
    Arbitrator public arbitrator;
    bytes public arbitratorExtraData;
    uint public stake;
    uint public timeToChallenge;
    enum ItemStatus {
        Absent,                      // The item has never been submitted.
        Cleared,                     // The item has been submitted and the dispute resolution process determined it was not forbidden. Or a clearing request has been submitted and not contested.
        Resubmitted,                 // The item has been cleared but someone has resubmitted a blacklist request.
        Blacklisted,                 // The item has been submitted and the dispute resolution process determined it was forbidden. Or a blacklist request has been submitted and not contested.
        Submitted,                   // There is a blacklist request for this item.
        ClearingRequested,           // The item is blacklisted but someone has submitted a clearing request.
        PreventiveClearingRequested  // The item has never been blacklisted but someone asked to clear it preventively to avoid it being shown as not permitted during the dispute process.
    }
    struct Item {
        ItemStatus status;       // Status of the item.
        uint lastAction;         // Time of the last action.
        address submitter;       // Address of the submitter if any.
        address challenger;      // Address of the challenger if any.
        uint balance;            // The total amount of funds to be given to the winner of a potential dispute. Include stake and reimbursement of arbitration fee.
        bool disputed;           // True if a dispute is taking place.
        uint disputeID;          // ID of the dispute, if any.
    }
    mapping(bytes32 => Item) public items;           // Return True if the item is in the list.
    mapping(uint => bytes32) public disputeIDToItem; // Give the item from the disputeID.  
    
    uint8 constant BLACKLIST = 1;
    uint8 constant CLEAR = 2;
    string constant RULING_OPTIONS = "Blacklist;Clear"; // A plain English of what rulings do.
    
    
    /** @dev Constructor.
     *  @param _stake The amount in weis of deposit required for a submission or a challenge.
     *  @param _timeToChallenge The time in second, others parties have to challenge 
     */
    function ArbitrableBlacklist(Arbitrator _arbitrator, bytes _arbitratorExtraData, uint _stake, uint _timeToChallenge) public {
        arbitrator=_arbitrator;
        arbitratorExtraData=_arbitratorExtraData;
        stake=_stake;
        timeToChallenge=_timeToChallenge;
    }
    
    /** @dev Return true if the item is allowed. We take a conservative approach and return false if the status of the item is contested and it has not won a previous dispute.
     *  @param _value The value of item we want to know if allowed.
     *  @return allowed True if the item is allowed, false otherwise.
     */
    function isPermitted(bytes32 _value) public returns (bool allowed) {
        return items[_value].status<=ItemStatus.Resubmitted || (items[_value].status==ItemStatus.PreventiveClearingRequested && !items[_value].disputed);
    
    }
    
    /** @dev Request an item to be blacklisted. 
     *  @param _value The value of item to blacklist.
     */
    function requestBlacklisting(bytes32 _value) public payable {
        Item storage item=items[_value];
        uint arbitratorCost=arbitrator.arbitrationCost(arbitratorExtraData);
        require(msg.value>=stake+arbitratorCost);
        if (items[_value].status==ItemStatus.Absent) 
            items[_value].status=ItemStatus.Submitted;
        else if (items[_value].status==ItemStatus.Cleared)
            items[_value].status=ItemStatus.Resubmitted;
        else
            revert(); // It the item is neither Absent nor Cleared, it is not possible to request blacklisting.
        
        item.submitter=msg.sender;
        item.balance+=msg.value;
        item.lastAction=now;
    }
    
    /** @dev Request an item to be cleared.
     *  @param _value The value of item to be cleared.
     */
    function requestClearing(bytes32 _value) public payable {
        Item storage item=items[_value];
        uint arbitratorCost=arbitrator.arbitrationCost(arbitratorExtraData);
        require(msg.value>=stake+arbitratorCost);
        if (item.status==ItemStatus.Blacklisted)
            item.status=ItemStatus.ClearingRequested;
        else if (item.status==ItemStatus.Absent)
            item.status=ItemStatus.PreventiveClearingRequested;
        else
            revert();
        item.submitter=msg.sender;
        item.balance+=msg.value;
        item.lastAction=now;
    }
    
    /** @dev Challenge a blacklisting request.
     *  @param _value The value of item subject to the blacklist request.
     */
    function challengeBlacklisting(bytes32 _value) public payable {
       Item storage item=items[_value];
       uint arbitratorCost=arbitrator.arbitrationCost(arbitratorExtraData);
       require(msg.value>=stake+arbitratorCost);
       require(item.status==ItemStatus.Resubmitted || item.status==ItemStatus.Submitted);
       require(!item.disputed);
       
       if (item.balance>=arbitratorCost) { // In the general case, create a dispute.
            item.challenger=msg.sender;
            item.balance+=msg.value-arbitratorCost;
            item.disputed=true;
            item.disputeID=arbitrator.createDispute.value(arbitratorCost)(2,arbitratorExtraData);
            disputeIDToItem[item.disputeID]=_value;
       }
       else { // In the case the arbitration fees would have increased so much that the deposit of the requester is not high enough. Cancel the request.
            if (item.status==ItemStatus.Resubmitted)
                item.status=ItemStatus.Cleared;
            else
                item.status=ItemStatus.Absent;
            item.submitter.send(item.balance); // On purpose use of send in order not to block the contract in case of reverting fallback.
            item.balance=0;
            msg.sender.transfer(msg.value); 
       }
       item.lastAction=now;
    }
    
    /** @dev Challenge a clearing request.
     *  @param _value The value of item subject to the clearing request.
     */
    function challengeClearing(bytes32 _value) public payable {
       Item storage item=items[_value];
       uint arbitratorCost=arbitrator.arbitrationCost(arbitratorExtraData);
       require(msg.value>=stake+arbitratorCost);
       require(item.status==ItemStatus.ClearingRequested || item.status==ItemStatus.PreventiveClearingRequested);
       require(!item.disputed);
       
       if (item.balance>=arbitratorCost) {
            item.challenger=msg.sender;
            item.lastAction=now;
            item.balance+=msg.value-arbitratorCost;
            item.disputed=true;
            item.disputeID=arbitrator.createDispute.value(arbitratorCost)(2,arbitratorExtraData);
            disputeIDToItem[item.disputeID]=_value;
       }
       else { // In the case the arbitration fees would have increased so much that the deposit of the requester is not high enough. Cancel the request.
            if (item.status==ItemStatus.ClearingRequested) 
                item.status=ItemStatus.Blacklisted;
            else
                item.status=ItemStatus.Absent;
            item.submitter.send(item.balance); // On purpose use of send in order not to block the contract in case of reverting fallback.
            item.balance=0;
            msg.sender.transfer(msg.value);
       }
       item.lastAction=now;
    }
    
    /** @dev Execute a request after the time for challenge has passed. Can be called by anyone.
     *  @param _value The value of item to execute the request.
     */
    function executeRequest(bytes32 _value) public {
       Item storage item=items[_value];
       require(now-item.lastAction >=  timeToChallenge);
       if (item.status==ItemStatus.Resubmitted || item.status==ItemStatus.Submitted)
           item.status=ItemStatus.Blacklisted;
       else if (item.status==ItemStatus.ClearingRequested || item.status==ItemStatus.PreventiveClearingRequested)
           item.status=ItemStatus.Cleared;
       else
           revert();
       item.submitter.send(item.balance); // On purpose use of send in order not to block the contract in case of reverting fallback.
    }
    
    /** @dev Appeal. Anyone can appeal to prevent a malicious actor from challenging its own submission and loosing on purpose.
     *  @param _value The value of item to execute the appeal.
     */
    function appeal(bytes32 _value) public payable {
        Item storage item=items[_value];
        arbitrator.appeal.value(msg.value)(item.disputeID,arbitratorExtraData); // Appeal, no need to check anything as the arbitrator does.
    }

    /** @dev Execute a ruling of a dispute.
     *  @param _disputeID ID of the dispute in the Arbitrator contract.
     *  @param _ruling Ruling given by the arbitrator. Note that 0 is reserved for "Not able/wanting to make a decision".
     */
    function executeRuling(uint _disputeID, uint _ruling) internal {
        Item storage item=items[disputeIDToItem[_disputeID]];
        require(item.disputed);
        if (_ruling==BLACKLIST) {
            if (item.status==ItemStatus.Resubmitted || item.status==ItemStatus.Submitted)
                item.submitter.send(item.balance); // The send are on purpose to prevent blocking.
            else
                item.challenger.send(item.balance);
            item.status=ItemStatus.Blacklisted;
        } else if (_ruling==CLEAR) {
            if (item.status==ItemStatus.PreventiveClearingRequested || item.status==ItemStatus.ClearingRequested)
                item.submitter.send(item.balance);
            else
                item.challenger.send(item.balance);
            item.status=ItemStatus.Cleared;
        } else { // Split the balance 50-50 and put the item in the absent initial state.
            item.status=ItemStatus.Absent;
            item.submitter.send(item.balance/2);
            item.challenger.send(item.balance/2);
        }
        item.disputed=false;
        item.balance=0; 
    }
}




























