 /**
 *  @title Funding Vault
 *  @author Clément Lesaege - <clement@lesaege.com>
 *  Bug Bounties: This code hasn't undertaken a bug bounty program yet.
 */

pragma solidity ^0.4.15;

import "../Arbitrable.sol";
import "minimetoken/contracts/MiniMeToken.sol";

/** @title Funding Vault
 *  A contract storing the ETH raised in a crowdfunding event.
 *  Funds are delivered when milestones are reached.
 *  The team can claim a milestone is reached. Token holders will have some time to dispute that claim.
 *  When some token holders vote to dispute the claim, extra time is given to other token holders to dispute that claim.
 *  If a sufficient amount of token holders dispute it. A dispute is created and the arbitrator will decide if the milestone has been reached.
 *  When there is a disagreement a vote token is created. Holders should send the voteToken to the Vault to disagree with the milestone.
 *  Token holders can also claim that the team failed to deliver and ask for the remaining ETH to be given back to a different contract.
 *  This contract can be the vault of another team, or a contract to reimburse.
 */
contract FundingVault is Arbitrable {
    address public team;
    MiniMeToken public token;
    address public funder;
    uint public disputeThreshold;
    uint public claimToWithdrawTime;
    uint public additionalTimeToWithdraw;
    uint public timeout;
    struct Milestone {
        uint amount; // The maximum amount which can be unlocked for this milestone.
        uint amountClaimed; // The current amount which is claimed.
        uint claimTime; // The time the current claim was made. Or 0 if it's not currently claimed.
        bool disputed; // True if a dispute has been raised.
        uint feeTeam;  // Arbitration fee paid by the team.
        uint feeHolders; // Arbitration fee paid by token holders.
        MiniMeToken voteToken; // Forked token which will be used to vote.
        uint disputeID; // ID of the dispute if this claim is disputed.
        uint lastTotalFeePayment; // Time of the last total fee payment, useful for timeouts.
        bool lastTotalFeePaymentIsTeam; // True if the last interaction is from the team.
        address payerForHolders; // The address who first paid the arbitration fee and will be refunded in case of victory.
    }
    Milestone[] public milestones;
    mapping(uint => uint) public disputeIDToMilstoneID; // Map (disputeID => milestoneID).
    
    uint8 constant AMOUNT_OF_CHOICES = 2;
    uint8 constant TEAM_WINS = 1;
    uint8 constant HOLDERS_WINS = 2;
    
    /** @dev Constructor. Choose the arbitrator.
     *  @param _arbitrator The arbitrator of the contract.
     *  @param _contractHash Keccak256 hash of the plain text contract.
     *  @param _team The address of the team who will be able to claim milestone completion.
     *  @param _token The token whose holders are able to dispute milestone claims.
     *  @param _funder The party putting funds in the vault.
     *  @param _disputeThreshold The ‱ of tokens required to dispute a milestone.
     *  @param _claimToWithdrawTime The base time in seconds after a claim is considered non-disputed (i.e  if no token holders dispute it).
     *  @param _additionalTimeToWithdraw The time in seconds which is added per ‱ of tokens disputing the claim.
     *  @param _timeout Maximum time to pay arbitration fees after the other side did.
     */
    function FundingVault(Arbitrator _arbitrator, bytes _arbitratorExtraData, bytes32 _contractHash, address _team, address _token, address _funder, uint _disputeThreshold, uint _claimToWithdrawTime, uint _additionalTimeToWithdraw, uint _timeout) public Arbitrable(_arbitrator,_arbitratorExtraData,_contractHash) {
        team=_team;
        token=MiniMeToken(_token);
        funder=_funder;
        disputeThreshold=_disputeThreshold;
        claimToWithdrawTime=_claimToWithdrawTime;
        additionalTimeToWithdraw=_additionalTimeToWithdraw;
        timeout=_timeout;
    }
    
    /** @dev Give the funds for a milestone.
     *  @return milestoneID The ID of the milestone which was created.
     */
    function fundMilestone() public payable returns(uint milestoneID) {
        require(msg.sender==funder);
        
        return milestones.push(Milestone({
                amount:msg.value,
                amountClaimed:0,
                claimTime:0,
                disputed:false,
                feeTeam:0,
                feeHolders:0,
                voteToken:MiniMeToken(0x0),
                disputeID:0,
                lastTotalFeePayment:0,
                lastTotalFeePaymentIsTeam:false,
                payerForHolders:0x0
            }))-1;
    }

    
    /** @dev Claim funds of a milestone.
     *  @param _milestoneID The ID of the milestone.
     *  @param _amount The amount claim. Note that the team can claim less than the amount of a milestone. This allows partial completion claims.
     */
    function claimMilestone(uint _milestoneID, uint _amount) public {
        Milestone storage milestone=milestones[_milestoneID];
        require(msg.sender==team);
        require(milestone.claimTime==0); // Verify another claim is not active.
        require(milestone.amount<=_amount);
        
        milestone.claimTime=now;
    }
    
    /** @dev Make a forked token to dispute a claim.
     *  This avoid creating a token all the time, since most milestones should not be disputed.
     *  @param _milestoneID The ID of the milestone.
     */
    function makeVoteToken(uint _milestoneID) public {
        Milestone storage milestone=milestones[_milestoneID];
        require(milestone.claimTime!=0); // The milestone is currently claimed by the team.
        require(address(milestone.voteToken)==0x0); // Token has not already been made.
        
        milestone.voteToken=MiniMeToken(token.createCloneToken(
                "",
                token.decimals(),
                "",
                block.number,
                true
                ));
    }
    
    /** @dev Pay fee to dispute a milestone. To be called by parties claiming the milestone was not completed.
     *  The first party to pay the fee entirely will be reimbursed if the dispute is won.
     *  Note that holders can make a smart contract to crowdfund the fee.
     *  In the rare event the arbitrationCost is increased, anyone can pay the extra, but it is always the first payer who can be reimbursed.
     *  @param _milestoneID The milestone which is disputed.
     */
    function payDisputeFeeByHolders(uint _milestoneID) public payable {
        Milestone storage milestone=milestones[_milestoneID];
        uint arbitrationCost = arbitrator.arbitrationCost(arbitratorExtraData);
        require(!milestone.disputed); // The milestone is not already disputed.
        require(milestone.voteToken.balanceOf(this) >= (disputeThreshold*milestone.voteToken.totalSupply())/1000); // There is enough votes.
        require(milestone.feeHolders<arbitrationCost); // Fee has not be paid before.
        require(milestone.feeHolders+msg.value>=arbitrationCost); // Enough is paid.
        require(!milestone.disputed); // A dispute has not been created yet.
        
        milestone.feeHolders+=msg.value;
        
        if (milestone.payerForHolders==0x0)
            milestone.payerForHolders=msg.sender;
        
        if (milestone.feeTeam>=arbitrationCost) { // Enough has been paid by all sides.
            createDispute(_milestoneID,arbitrationCost);
        } else if (milestone.lastTotalFeePayment==0) { // First time the fee is paid.
            milestone.lastTotalFeePayment=now;
        } else if(milestone.lastTotalFeePaymentIsTeam) { // The team was the last one who had paid entirely.
            milestone.lastTotalFeePaymentIsTeam=false;
            milestone.lastTotalFeePayment=now;
        }
    }
    
    /** @dev Pay fee to for a milestone dispute. To be called by the team when the holders have enough votes and fee paid.
     *  @param _milestoneID The milestone which is disputed.
     */
    function payDisputeFeeByTeam(uint _milestoneID) public payable {
        Milestone storage milestone=milestones[_milestoneID];
        uint arbitrationCost = arbitrator.arbitrationCost(arbitratorExtraData);
        require(msg.sender==team);
        require(!milestone.disputed); // A dispute has not been created yet.
        require(milestone.voteToken.balanceOf(this) >= (disputeThreshold*milestone.voteToken.totalSupply())/1000); // There is enough votes.
        require(milestone.feeTeam+msg.value>=arbitrationCost); // Make sure enough is paid. Team can't pay partially.
        
        
        milestone.feeTeam+=msg.value;
        if (milestone.feeHolders>=arbitrationCost) { // Enough has been paid by all sides.
                createDispute(_milestoneID,arbitrationCost);
        }
        else if (milestone.lastTotalFeePayment==0) { // First time the fee is paid.
            milestone.lastTotalFeePayment=now;
            milestone.lastTotalFeePaymentIsTeam=true;
        } else if(!milestone.lastTotalFeePaymentIsTeam) { // The holders were the last ones who had paid entirely.
            milestone.lastTotalFeePaymentIsTeam=true;
            milestone.lastTotalFeePayment=now;
        }
    }
    
    /** @dev Create a dispute.
     *  @param _milestoneID The milestone which is disputed.
     *  @param _arbitrationCost The amount which should be paid to the arbitrator.
     */
    function createDispute(uint _milestoneID, uint _arbitrationCost) internal {
        Milestone storage milestone=milestones[_milestoneID];
        milestone.disputed=true;
        milestone.feeTeam-=_arbitrationCost; // Remove the fee from the team pool for accounting. Note that at this point it does not matter which fee variable we decrement.
        milestone.disputeID=arbitrator.createDispute(AMOUNT_OF_CHOICES,arbitratorExtraData);
        disputeIDToMilstoneID[milestone.disputeID]=_milestoneID;
    }
    
    /** @dev Withdraw the money claimed in a milestone.
     *  To be called when a dispute has not been created within the time limit.
     *  @param _milestoneID The milestone which is disputed.
     */
    function withdraw(uint _milestoneID) public {
        Milestone storage milestone=milestones[_milestoneID];
        require(msg.sender==team);
        require(!milestone.disputed);
        require(milestone.voteToken.balanceOf(this) < (disputeThreshold*milestone.voteToken.totalSupply())/1000); // There is not enough votes.
        require((now-milestone.claimTime) > claimToWithdrawTime+(additionalTimeToWithdraw*milestone.voteToken.balanceOf(this))/(1000*milestone.voteToken.totalSupply()));

        team.transfer(milestone.amountClaimed+milestone.feeTeam+milestone.feeHolders); // Pay the amount claimed and the unused fees.
        milestone.amount-=milestone.amountClaimed;
        milestone.amountClaimed=0;
        milestone.claimTime=0;
        milestone.feeTeam=0;
        milestone.feeHolders=0;
        
    }
    
    // TODO: Timeouts
    /** @dev Timeout to use when the holders don't pay the fee.
     *  @param _milestoneID The milestone which is disputed.
     */
    function timeoutByTeam(uint _milestoneID) public {
        Milestone storage milestone=milestones[_milestoneID];
        require(msg.sender==team);
        require(milestone.lastTotalFeePaymentIsTeam);
        require(now-milestone.lastTotalFeePayment > timeout);
        
        team.transfer(milestone.amountClaimed+milestone.feeTeam+milestone.feeHolders); // Pay the amount claimed and the unused fees to the team.
        milestone.amount-=milestone.amountClaimed;
        milestone.amountClaimed=0;
        milestone.claimTime=0;
        milestone.feeTeam=0;
        milestone.feeHolders=0;
        milestone.voteToken=MiniMeToken(0x0);
        milestone.lastTotalFeePayment=0;
        milestone.lastTotalFeePaymentIsTeam=false;
        milestone.payerForHolders=0x0;        
    }
    
    /** @dev Timeout to use whe the team don't pay the fee.
     *  @param _milestoneID The milestone which is disputed.
     */
    function timeoutByHolders(uint _milestoneID) public {
        Milestone storage milestone=milestones[_milestoneID];
        require(!milestone.lastTotalFeePaymentIsTeam);
        require(now-milestone.lastTotalFeePayment > timeout);
        
        milestone.payerForHolders.transfer(milestone.feeTeam+milestone.feeHolders); // Pay the unused fees to the payer for holders.
        milestone.amountClaimed=0;
        milestone.claimTime=0;
        milestone.disputed=false;
        milestone.feeTeam=0;
        milestone.feeHolders=0;
        milestone.voteToken=MiniMeToken(0x0);
        milestone.lastTotalFeePayment=0;
        milestone.payerForHolders=0x0;
    }
    
    /** @dev Appeal an appealable ruling.
     *  Transfer the funds to the arbitrator.
     *  @param _milestoneID The milestone which is disputed.
     */
    function appeal(uint _milestoneID) public payable {
        Milestone storage milestone=milestones[_milestoneID];
        arbitrator.appeal.value(msg.value)(milestone.disputeID,arbitratorExtraData);
    }

    /** @dev Execute a ruling of a dispute.
     *  @param _disputeID ID of the dispute in the Arbitrator contract.
     *  @param _ruling Ruling given by the arbitrator. Note that 0 is reserved for "Not able/wanting to make a decision".
     */
    function executeRuling(uint _disputeID, uint _ruling) internal{
        Milestone storage milestone=milestones[disputeIDToMilstoneID[_disputeID]];
        require(milestone.voteToken.balanceOf(this) >= (disputeThreshold*milestone.voteToken.totalSupply())/1000); // Make sure there is enough votes to protect against a malicious arbitrator.
        
        if (_ruling==TEAM_WINS) {
            team.transfer(milestone.amountClaimed+milestone.feeTeam+milestone.feeHolders); // Pay the amount claimed and the unused fees to the team.
            milestone.amount-=milestone.amountClaimed;
            milestone.amountClaimed=0;
            milestone.claimTime=0;
            milestone.disputed=false;
            milestone.feeTeam=0;
            milestone.feeHolders=0;
            milestone.voteToken=MiniMeToken(0x0);
            milestone.disputeID=0; 
            milestone.lastTotalFeePayment=0;
            milestone.lastTotalFeePaymentIsTeam=false;
            milestone.payerForHolders=0x0;
        } else if (_ruling==HOLDERS_WINS) {
            milestone.payerForHolders.transfer(milestone.feeTeam+milestone.feeHolders); // Pay the unused fees to the payer for holders.
            milestone.amountClaimed=0;
            milestone.claimTime=0;
            milestone.disputed=false;
            milestone.feeTeam=0;
            milestone.feeHolders=0;
            milestone.voteToken=MiniMeToken(0x0);
            milestone.disputeID=0; 
            milestone.lastTotalFeePayment=0;
            milestone.lastTotalFeePaymentIsTeam=false;
            milestone.payerForHolders=0x0;
        }
    }
    // TODO: Make a mechanism to send everything back to another contract.


}







