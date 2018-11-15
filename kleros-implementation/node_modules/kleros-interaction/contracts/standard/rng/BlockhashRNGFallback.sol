/**
 *  @title Random Number Generator using blockhash with fallback.
 *  @author Clément Lesaege - <clement@lesaege.com>
 *  
 *  This contract implement the RNG standard and giving parties incentives in saving the blockhash to avoid it to become unreachable after 256 blocks.
 *  In case no one called it within the 256 blocks, it returns the previous blockhash.
 *  This contract must be used when returning 0 is more problematic than returning another blockhash.
 *  Note that if someone calls it within the timeframe, this contracts acts exactly as BlockHashRNG.
 */
pragma solidity ^0.4.15;
 
import "./BlockHashRNG.sol";

/** Random Number Generator returning the blockhash with a backup behaviour.
 *  Allows saving the random number for use in the future. 
 *  It allows the contract to still access the blockhash even after 256 blocks.
 *  The first party to call the save function gets the reward.
 *  If no one calls the contract within 256 blocks, the contract fallback in returning the blockhash of the previous block.
 */
contract BlockHashRNGFallback is BlockHashRNG {
    
    /** @dev Save the random number for this blockhash and give the reward to the caller.
     *  @param _block Block the random number is linked to.
     */
    function saveRN(uint _block) public {
        if (_block<block.number) {
            uint rewardToSend=reward[_block];
            reward[_block]=0;
            if (block.blockhash(_block)!=0x0) // Normal case.
                randomNumber[_block]=uint(block.blockhash(_block));
            else // The contract was not called in time. Fallback to returning previous blockhash.
                randomNumber[_block]=uint(block.blockhash(block.number-1));
            
            msg.sender.send(rewardToSend); // Note that the use of send is on purpose as we don't want to block in case the msg.sender has a fallback issue.
            
        }
    }
    
}
