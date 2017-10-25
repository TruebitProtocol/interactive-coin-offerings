pragma solidity ^0.4.15;

/****************
*
*  Test contract for tesing libraries on networks
*
*****************/

//import "./TestCrowdsaleLib.sol";
import "./TestInteractiveCrowdsaleLib.sol";
import "./CrowdsaleToken.sol";

contract TimeInteractiveCrowdsaleTestContract {
  using TestInteractiveCrowdsaleLib for TestInteractiveCrowdsaleLib.InteractiveCrowdsaleStorage;

  TestInteractiveCrowdsaleLib.InteractiveCrowdsaleStorage sale;

  function TimeInteractiveCrowdsaleTestContract(
    address owner,
    uint256[] saleData,
    uint256 fallbackExchangeRate,
    uint256 capAmountInCents,
    uint256 valuationGranularity,
    uint256 endWithdrawlTime,
    uint256 endTime,
    uint8 percentBurn,
    CrowdsaleToken token)
  {
  	sale.init(owner, saleData, fallbackExchangeRate, capAmountInCents, valuationGranularity, endWithdrawlTime, endTime, percentBurn, token);
  }

  // fallback function can be used to buy tokens
  function () payable {
    //receivePurchase();
  }

  function submitBid(uint256 _personalValuation, uint256 _listPredict, uint256 _currtime) payable public returns (bool) {
    return sale.submitBid(msg.value, _personalValuation, _listPredict, _currtime);
  }

  function withdrawBid(uint256 _currtime) public returns (bool) {
    return sale.withdrawBid(_currtime);
  }

  function withdrawTokens(uint256 _currtime) public returns (bool) {
    return sale.withdrawTokens(_currtime);
  }

  function withdrawLeftoverWei() public returns (bool) {
    return sale.withdrawLeftoverWei();
  }

  function withdrawOwnerEth(uint256 _currtime) returns (bool) {
  	return sale.withdrawOwnerEth(_currtime);
  }

  function crowdsaleActive(uint256 _currtime) constant returns (bool) {
  	return sale.crowdsaleActive(_currtime);
  }

  function crowdsaleEnded(uint256 _currtime) constant returns (bool) {
  	return sale.crowdsaleEnded(_currtime);
  }

  function setTokenExchangeRate(uint256 _exchangeRate, uint256 _currtime) returns (bool) {
    return sale.setTokenExchangeRate(_exchangeRate, _currtime);
  }

  function setTokens() returns (bool) {
    return sale.setTokens();
  }

  function getOwner() constant returns (address) {
    return sale.base.owner;
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
    return sale.endWithdrawlTime;
  }

  function getTotalValuation() constant returns (uint256) {
    return sale.base.ownerBalance;
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

  function getPersonalValuation(address _bidder) constant returns (uint256) {
    return sale.getPersonalValuation(_bidder);
  }

  function isBidderAtValuation(uint256 _valuation, address _bidder) constant returns (bool) {
    return sale.isBidderAtValuation(_valuation,_bidder);
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
