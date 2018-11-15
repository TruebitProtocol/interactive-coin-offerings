/**
 *  @title Random Number Generator based on a trusted party.
 *  @author Clément Lesaege - <clement@lesaege.com>
 *  
 *  This contract implement the RNG standard and rely on a trusted party to give a random number.
 * 
 */
pragma solidity ^0.4.15;
 
import "./RNG.sol";

/** Simple Random Number Generator based on a trusted third party.
 *  The trusted third party determine the random number and get all the contributions.
 */
contract TrustedRNG is RNG {
    
    address public owner=msg.sender; // The operator of this RNG.
    mapping (uint => uint) public randomNumber; // RN[block] is the random number for this block 0 otherwise.
    mapping (uint => uint) public reward; // reward[block] is the amount to be paid to the party w.
    
    modifier onlyOwner() {require(msg.sender==owner); _;}
    
    /** @dev Contribute to the reward of a random number.
     *  @param _block Block the random number is linked to.
     */
    function contribute(uint _block) public payable {
        if (randomNumber[_block]!=0)
            owner.send(msg.value); // The random number has already been given, pay the operator. If send fails it's not an issue.
        else 
            reward[_block]+=msg.value;
    }
    
    /** @dev Give a random number. To be called by the operator.
     *  @param _block Block the random number is linked to.
     *  @param _RN The random number given by the trusted party.
     */
    function giveRN(uint _block, uint _RN) public onlyOwner {
        require(randomNumber[_block]==0); // Prevent the operator from changing a RN.
        
        owner.send(reward[_block]); // If send fails it's not an issue.
        randomNumber[_block]=_RN;
        reward[_block]=0;
    }
    
    /** @dev Get the random number.
     *  @param _block Block the random number is linked to.
     *  @return RN Random Number. If the number is not ready or has not been requested 0 instead.
     */
    function getRN(uint _block) public constant returns (uint RN) {
        return randomNumber[_block];
    }
    
}
