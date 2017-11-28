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
    uint256 capAmountInCents,
    uint256 valuationGranularity,
    uint256 endWithdrawalTime,
    uint256 endTime,
    uint8 percentBurn,
    CrowdsaleToken token)
  {
  	sale.init(owner, saleData, fallbackExchangeRate, minimumRaise, capAmountInCents, endWithdrawalTime, endTime, percentBurn, token);
  }

  // fallback function can be used to buy tokens
  function () payable {
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

  function withdrawOwnerEth() returns (bool) {
  	return sale.withdrawOwnerEth();
  }

  function crowdsaleActive() constant returns (bool) {
  	return sale.crowdsaleActive();
  }

  function crowdsaleEnded() constant returns (bool) {
  	return sale.crowdsaleEnded();
  }

  function setTokenExchangeRate(uint256 _exchangeRate) returns (bool) {
    return sale.setTokenExchangeRate(_exchangeRate);
  }

  function setTokens() returns (bool) {
    return sale.setTokens();
  }

  function getOwner() constant returns (address) {
    return sale.base.owner;
  }

  function getMinimumRaise() constant returns (uint256) {
    return sale.minimumRaise;
  }

  function getTokensPerEth() constant returns (uint256) {
    return sale.base.tokensPerEth;
  }

  function getExchangeRate() constant returns (uint256) {
    return sale.base.exchangeRate;
  }

  function getCapAmount() constant returns (uint256) {
    return sale.base.capAmount;
  }

  function getStartTime() constant returns (uint256) {
    return sale.base.startTime;
  }

  function getEndTime() constant returns (uint256) {
    return sale.base.endTime;
  }

  function getEndWithdrawlTime() constant returns (uint256) {
    return sale.endWithdrawalTime;
  }

  function getTotalValuation() constant returns (uint256) {
    return sale.valueCommitted;
  }

  function getContribution(address _buyer) constant returns (uint256) {
    return sale.base.hasContributed[_buyer];
  }

  function getTokenPurchase(address _buyer) constant returns (uint256) {
    return sale.base.withdrawTokensMap[_buyer];
  }

  function getLeftoverWei(address _buyer) constant returns (uint256) {
    return sale.base.leftoverWei[_buyer];
  }

  function getPersonalCap(address _bidder) constant returns (uint256) {
    return sale.getPersonalCap(_bidder);
  }

  function getSaleData(uint256 timestamp) constant returns (uint256[3]) {
    return sale.getSaleData(timestamp);
  }

  function getTokensSold() constant returns (uint256) {
    return sale.getTokensSold();
  }

  function getPercentBurn() constant returns (uint256) {
    return sale.base.percentBurn;
  }
}
