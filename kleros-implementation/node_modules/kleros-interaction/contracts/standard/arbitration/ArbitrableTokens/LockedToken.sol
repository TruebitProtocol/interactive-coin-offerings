/**
 *  @title Locked Token
 *  @author Clément Lesaege - <clement@lesaege.com>
 *  Bug Bounties: This code hasn't undertaken a bug bounty program yet.
 */


pragma solidity ^0.4.15;
import "zeppelin-solidity/contracts/token/ERC20/MintableToken.sol";


/** @title Locked Token
 *  @dev A token when created coins are locked and unlock accross time.
 *  Note that we use steps for one month. In the future, when float are available, we could use law of exponential decay to avoid steps and have a smoothed unlocking.
 */
contract LockedToken is MintableToken {
    uint public lockMultiplierPerMillionPerMonth; // The amount we must multiply the locked balance each month.
    uint constant LOCK_DIVISOR = 1E6;
    mapping (address => uint) public lastUnlock; // Last time tokens were unlocked.
    mapping (address => uint) public amountLocked; // The amount of tokens locked.
    
    /** @dev Constructor.
     *  @param _lockMultiplierPerMillionPerMonth The amount we must multiply the locked portion each month.
     *  It is (1-unlockRatioPerYear)^(1/12) * 1E6. Note that we should compute that offchain to avoid integer rounding.
     *  So for 10% unlock per year, it is 991258.
     */
    function LockedToken(uint _lockMultiplierPerMillionPerMonth) public {
        lockMultiplierPerMillionPerMonth=_lockMultiplierPerMillionPerMonth;
    }
    
    /** @dev Mint tokens.
     *  @param _to The address that will receive the minted tokens.
     *  @param _amount The amount of tokens to mint.
     *  @return A boolean that indicates if the operation was successful.
     */
    function mint(address _to, uint256 _amount) public returns (bool) {
        unlock(_to);
        assert(super.mint(_to,_amount));
        amountLocked[_to].add(_amount);
        return true;
    }
    
    /** @dev Unlock the tokens which can. 
     *  Note that this function is O(log(t)) where t is the last time of unlock.
     *  You can call partiallUnlock with a maxUnlock to avoid gas issues.
     *  But note that it is likely to never be necessary as the cost of this function, if not high even for multiple years.
     *  @param _to The address to unlock tokens from.
     */
    function unlock(address _to) public {
        partialUnlock(_to,uint(-1));
    }
    
    /** @dev Unlock the tokens which can. 
     *  This function is O(_maxUnlock). You may need to call it multiple times.
     *  @param _to The address to unlock tokens from.
     */
    function partialUnlock(address _to, uint _maxUnlock) public {
        if (lastUnlock[_to].add(4 weeks) <= now && amountLocked[_to]!=0) {
            uint amountOfMonths = now.sub(lastUnlock[_to]) / (4 weeks);
            amountOfMonths = amountOfMonths < _maxUnlock ? amountOfMonths : _maxUnlock;
            lastUnlock[_to]=lastUnlock[_to].add(amountOfMonths.mul(4 weeks)); // Update last unlock date.
            uint newLocked=amountLocked[_to];
            for (uint i=0;i<amountOfMonths;++i)
                newLocked=newLocked.mul(lockMultiplierPerMillionPerMonth).div(LOCK_DIVISOR);
            amountLocked[_to]=newLocked;
        }
    }
    
    /** @dev Transfer token for a specified address.
     *  @param _to The address to transfer to.
     *  @param _value The amount to be transferred.
     */
    function transfer(address _to, uint256 _value) public returns (bool) {
        unlock(msg.sender);
        require(balances[msg.sender].sub(amountLocked[msg.sender])>=_value);
        
        assert(super.transfer(_to,_value));
        return true;
    }
    
    /** @dev Transfer tokens from one address to another
     *  @param _from address The address which you want to send tokens from
     *  @param _to address The address which you want to transfer to
     *  @param _value uint256 the amount of tokens to be transferred
     */
    function transferFrom(address _from, address _to, uint256 _value) public returns (bool) {
        unlock(_from);
        require(balances[_from].sub(amountLocked[_from])>=_value);
        
        assert(super.transferFrom(_from,_to,_value));
        return true;
    }
    
}


