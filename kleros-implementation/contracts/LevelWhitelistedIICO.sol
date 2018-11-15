/** @title Level Whitelisted Interactive Coin Offering
 *  @author Clément Lesaege - <clement@lesaege.com>
 */

pragma solidity ^0.4.23;

import "./IICO.sol";

/** @title Level Whitelisted Interactive Coin Offering
 *  This contract implements an Interactive Coin Offering with two whitelists:
 *  - The base one, with limited contribution.
 *  - The reinforced one, with unlimited contribution.
 */
contract LevelWhitelistedIICO is IICO {
    
    uint public maximumBaseContribution;
    mapping (address => bool) public baseWhitelist; // True if in the base whitelist (has a contribution limit).
    mapping (address => bool) public reinforcedWhitelist; // True if in the reinforced whitelist (does not have a contribution limit).
    address public whitelister; // The party which can add or remove people from the whitelist.
    
    modifier onlyWhitelister{ require(whitelister == msg.sender); _; }
    
    /** @dev Constructor. First contract set up (tokens will also need to be transferred to the contract and then setToken needs to be called to finish the setup).
     *  @param _startTime Time the sale will start in seconds since the Unix Epoch.
     *  @param _fullBonusLength Amount of seconds the sale lasts in the full bonus period.
     *  @param _partialWithdrawalLength Amount of seconds the sale lasts in the partial withdrawal period.
     *  @param _withdrawalLockUpLength Amount of seconds the sale lasts in the withdrawal lockup period.
     *  @param _maxBonus The maximum bonus. Will be normalized by BONUS_DIVISOR. For example for a 20% bonus, _maxBonus must be 0.2 * BONUS_DIVISOR.
     *  @param _beneficiary The party which will get the funds of the token sale.
     *  @param _maximumBaseContribution The maximum contribution for buyers on the base list.
     */
    function LevelWhitelistedIICO(uint _startTime, uint _fullBonusLength, uint _partialWithdrawalLength, uint _withdrawalLockUpLength, uint _maxBonus, address _beneficiary, uint _maximumBaseContribution) IICO(_startTime,_fullBonusLength,_partialWithdrawalLength,_withdrawalLockUpLength,_maxBonus,_beneficiary) public {
        maximumBaseContribution=_maximumBaseContribution;
    }
    
    /** @dev Submit a bid. The caller must give the exact position the bid must be inserted into in the list.
     *  In practice, use searchAndBid to avoid the position being incorrect due to a new bid being inserted and changing the position the bid must be inserted at.
     *  @param _maxValuation The maximum valuation given by the contributor. If the amount raised is higher, the bid is cancelled and the contributor refunded because it prefers a refund instead of this level of dilution. To buy no matter what, use INFINITY.
     *  @param _next The bidID of the next bid in the list.
     */
    function submitBid(uint _maxValuation, uint _next) public payable {
        require(reinforcedWhitelist[msg.sender] || (baseWhitelist[msg.sender] && (msg.value + totalContrib(msg.sender) <= maximumBaseContribution))); // Check if the buyer is in the reinforced whitelist or if it is on the base one and this would not make its total contribution exceed the limit.
        super.submitBid(_maxValuation,_next);
    }
    
    /** @dev Set the whitelister.
     *  @param _whitelister The whitelister.
     */
    function setWhitelister(address _whitelister) public onlyOwner {
        whitelister=_whitelister;
    }
    
    /** @dev Add buyers to the base whitelist.
     *  @param _buyersToWhitelist Buyers to add to the whitelist.
     */
    function addBaseWhitelist(address[] _buyersToWhitelist) public onlyWhitelister {
        for(uint i=0;i<_buyersToWhitelist.length;++i)
            baseWhitelist[_buyersToWhitelist[i]]=true;
    }
    
    /** @dev Add buyers to the reinforced whitelist.
     *  @param _buyersToWhitelist Buyers to add to the whitelist.
     */
    function addReinforcedWhitelist(address[] _buyersToWhitelist) public onlyWhitelister {
        for(uint i=0;i<_buyersToWhitelist.length;++i)
            reinforcedWhitelist[_buyersToWhitelist[i]]=true;
    }
    
    /** @dev Remove buyers from the base whitelist.
     *  @param _buyersToRemove Buyers to remove from the whitelist.
     */
    function removeBaseWhitelist(address[] _buyersToRemove) public onlyWhitelister {
        for(uint i=0;i<_buyersToRemove.length;++i)
            baseWhitelist[_buyersToRemove[i]]=false;
    }
    
    /** @dev Remove buyers from the reinforced whitelist.
     *  @param _buyersToRemove Buyers to remove from the whitelist.
     */
    function removeReinforcedWhitelist(address[] _buyersToRemove) public onlyWhitelister {
        for(uint i=0;i<_buyersToRemove.length;++i)
            reinforcedWhitelist[_buyersToRemove[i]]=false;
    }

}
