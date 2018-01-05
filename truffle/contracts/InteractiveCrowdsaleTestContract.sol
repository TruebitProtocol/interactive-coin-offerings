pragma solidity ^0.4.15;

/****************
*
*  Test contract for tesing libraries on networks
*
*****************/

import "./InteractiveCrowdsaleLib.sol";
import "./CrowdsaleToken.sol";

contract InteractiveCrowdsaleTestContract {
  using InteractiveCrowdsaleLib for InteractiveCrowdsaleLib.InteractiveCrowdsaleStorage;

  InteractiveCrowdsaleLib.InteractiveCrowdsaleStorage sale;

  function InteractiveCrowdsaleTestContract(
    address owner,
    uint256[] saleData,
    uint256 fallbackExchangeRate,
    uint256 minimumRaise,
    uint256 endWithdrawalTime,
    uint256 endTime,
    uint8 percentBurn,
    CrowdsaleToken token) public
  {
  	sale.init(owner, saleData, fallbackExchangeRate, minimumRaise, endWithdrawalTime, endTime, percentBurn, token);
  }

  // fallback function can be used to buy tokens
  function () public payable {
    //receivePurchase();
  }

  function submitBid(uint256 _personalValuation, uint256 _listPredict) payable public returns (bool) {
    return sale.submitBid(msg.value, _personalValuation, _listPredict);
  }

  function withdrawBid() public returns (bool) {
    return sale.withdrawBid();
  }

  function withdrawTokens() public returns (bool) {
    return sale.withdrawTokens();
  }

  function withdrawLeftoverWei() public returns (bool) {
    return sale.withdrawLeftoverWei();
  }

  function withdrawOwnerEth() public returns (bool) {
  	return sale.withdrawOwnerEth();
  }

  function crowdsaleActive() public view returns (bool) {
  	return sale.crowdsaleActive();
  }

  function crowdsaleEnded() public view returns (bool) {
  	return sale.crowdsaleEnded();
  }

  function setTokenExchangeRate(uint256 _exchangeRate) public returns (bool) {
    return sale.setTokenExchangeRate(_exchangeRate);
  }

  function setTokens() public returns (bool) {
    return sale.setTokens();
  }

  function getOwner() public view returns (address) {
    return sale.base.owner;
  }

  function getTokensPerEth() public view returns (uint256) {
    return sale.base.tokensPerEth;
  }

  function getExchangeRate() public view returns (uint256) {
    return sale.base.exchangeRate;
  }

  function getStartTime() public view returns (uint256) {
    return sale.base.startTime;
  }

  function getEndTime() public view returns (uint256) {
    return sale.base.endTime;
  }

  function getEndWithdrawlTime() public view returns (uint256) {
    return sale.endWithdrawalTime;
  }

  function getCommittedCapital() public view returns (uint256) {
    return sale.valueCommitted;
  }

  function getContribution(address _buyer) public view returns (uint256) {
    return sale.base.hasContributed[_buyer];
  }

  function getTokenPurchase(address _buyer) public view returns (uint256) {
    return sale.base.withdrawTokensMap[_buyer];
  }

  function getLeftoverWei(address _buyer) public view returns (uint256) {
    return sale.base.leftoverWei[_buyer];
  }

  function getPersonalCap(address _bidder) public view returns (uint256) {
    return sale.getPersonalCap(_bidder);
  }

  function getSaleData(uint256 timestamp) public view returns (uint256[3]) {
    return sale.getSaleData(timestamp);
  }

  function getTokensSold() public view returns (uint256) {
    return sale.getTokensSold();
  }

  function getPercentBurn() public view returns (uint256) {
    return sale.base.percentBurn;
  }

  function getCurrentBucket() public view returns (uint256) {
    return sale.currentBucket;
  }

  function getTotalValuation() public view returns (uint256) {
    return sale.totalValuation;
  }
}
