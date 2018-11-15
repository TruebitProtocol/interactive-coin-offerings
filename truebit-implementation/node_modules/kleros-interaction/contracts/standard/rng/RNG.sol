/**
 *  @title Random Number Generator Standard
 *  @author Clément Lesaege - <clement@lesaege.com>
 *  
 */
 
pragma solidity ^0.4.15;
 
 contract RNG{
     
    /** @dev Contribute to the reward of a random number.
     *  @param _block Block the random number is linked to.
     */
    function contribute(uint _block) payable;
    
    /** @dev Request a random number.
     *  @param _block Block linked to the request.
     */
    function requestRN(uint _block) payable {
        contribute(_block);
    }
    
    /** @dev Get the random number.
     *  @param _block Block the random number is linked to.
     *  @return RN Random Number. If the number is not ready or has not been required 0 instead.
     */
    function getRN(uint _block) public constant returns (uint RN);
    
    /** @dev Get a uncorrelated random number. Act like getRN but give a different number for each sender.
     *  This is to avoid all users having the same number for a block which could pose issues.
     *  @param _block Block the random number is linked to.
     *  @return RN Random Number. If the number is not ready or has not been required 0 instead.
     */
    function getUncorrelatedRN(uint _block) public constant returns (uint RN) {
        uint baseRN=getRN(_block);
        if (baseRN==0)
            return 0;
        else
            return uint(keccak256(msg.sender,baseRN));
    }
    
 }




 
 
