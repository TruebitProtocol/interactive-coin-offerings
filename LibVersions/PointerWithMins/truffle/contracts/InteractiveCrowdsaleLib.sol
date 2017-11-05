pragma solidity ^0.4.15;

/**
 * @title InteractiveCrowdsaleLib
 * @author Majoolr.io
 *
 * version 1.0.0
 * Copyright (c) 2017 Majoolr, LLC
 * The MIT License (MIT)
 * https://github.com/Majoolr/ethereum-libraries/blob/master/LICENSE
 *
 * The InteractiveCrowdsale Library provides functionality to create a crowdsale
 * based on the white paper initially proposed by Jason Teutsch and Vitalik
 * Buterin. See https://people.cs.uchicago.edu/~teutsch/papers/ico.pdf for
 * further information.
 *
 * This library was developed in a collaborative effort among many organizations
 * including TrueBit, Majoolr, Zeppelin, and Consensys.
 * For further information: truebit.io, majoolr.io, zeppelin.solutions,
 * consensys.net
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import "./BasicMathLib.sol";
import "./TokenLib.sol";
import "./CrowdsaleLib.sol";
import "./LinkedListLib.sol";

library InteractiveCrowdsaleLib {
  using BasicMathLib for uint256;
  using LinkedListLib for LinkedListLib.LinkedList;
  using CrowdsaleLib for CrowdsaleLib.CrowdsaleStorage;

  uint256 constant NULL = 0;
  uint256 constant HEAD = 0;
  bool constant PREV = false;
  bool constant NEXT = true;

  uint256 constant FEE = 63000000000000;

  struct InteractiveCrowdsaleStorage {

    CrowdsaleLib.CrowdsaleStorage base; // base storage from CrowdsaleLib

    // List of personal valuations, sorted from smallest to largest (from LinkedListLib)
    LinkedListLib.LinkedList valuationsList;

    // List of personal minimums
    LinkedListLib.LinkedList minimumsList;

    uint256 endWithdrawalTime;   // time when manual withdrawals are no longer allowed
    uint256 valuationGranularity;   // the granularity that valuations can be submitted at

    // pointer to the lowest personal valuation that can remain in the sale
    uint256 valuationCutoff;

    // pointer to the highest minimum value obtained
    uint256 minimumCutoff;

    mapping (address => uint256) pricePurchasedAt;      // shows the price that the address purchased tokens at

    mapping (uint256 => uint256) valuationSum;         // the sum of bids at each valuation
    mapping (uint256 => uint256) numBidsAtValuation;    // the number of active bids at a certain valuation
    mapping (uint256 => uint256) minimumSum;           // the sum of bids at this minimum

    // 0-index is the cumulative delta impact on value pointer
    // 1-index is a positive delta if '0' or negative if '1'
    // 2-index is the accumulated number of fees
    mapping (uint256 => uint256[3]) valueDelta;

    // index-0 is the personal minimum and index-1 is the personal valuation
    mapping (address => uint256[2]) personalMinAndValue;
  }

  // Indicates when a bidder submits a bid to the crowdsale
  event LogBidAccepted(address indexed bidder, uint256 amount, uint256 personalValuation, uint256 personalMinimum);

  // Indicates when a bidder manually withdraws their bid from the crowdsale
  event LogBidWithdrawn(address indexed bidder, uint256 amount, uint256 personalValuation);

  // Indicates when a bid is removed by the automated bid removal process
  event LogBidRemoved(address indexed bidder, uint256 personalValuation);

  // Generic Error Msg Event
  event LogErrorMsg(uint256 amount, string Msg);

  // Indicates when the price of the token changes
  event LogTokenPriceChange(uint256 amount, string Msg);


  /// @dev Called by a crowdsale contract upon creation.
  /// @param self Stored crowdsale from crowdsale contract
  /// @param _owner Address of crowdsale owner
  /// @param _saleData Array of 3 item arrays such that, in each 3 element
  /// array index-0 is timestamp, index-1 is price in cents at that time
  /// index-2 is address purchase valuation at that time, 0 if no address valuation
  /// @param _fallbackExchangeRate Exchange rate of cents/ETH
  /// @param _capAmountInCents Total to be raised in cents
  /// @param _endTime Timestamp of sale end time
  /// @param _percentBurn Percentage of extra tokens to burn
  /// @param _token Token being sold
  function init(InteractiveCrowdsaleStorage storage self,
                address _owner,
                uint256[] _saleData,
                uint256 _fallbackExchangeRate,
                uint256 _capAmountInCents,
                uint256 _valuationGranularity,
                uint256 _endWithdrawalTime,
                uint256 _endTime,
                uint8 _percentBurn,
                CrowdsaleToken _token)
  {
    self.base.init(_owner,
                _saleData,
                _fallbackExchangeRate,
                _capAmountInCents,
                _endTime,
                _percentBurn,
                _token);

    require(_endWithdrawalTime < _endTime);
    self.valuationGranularity = _valuationGranularity;
    self.endWithdrawalTime = _endWithdrawalTime;
  }

  /// @dev calculates the number of tokens purchased based on the amount of wei spent and the price of tokens
  /// @param self Stored crowdsale from crowdsale contract
  /// @param _amount amound of wei that the buyer sent
  /// @param _price price of tokens in the sale, in tokens/ETH
  /// @return _numTokens the number of tokens purchased
  /// @return _remainder  any remaining wei leftover from integer division
  function calculateTokenPurchase(InteractiveCrowdsaleStorage storage self, uint256 _amount, uint256 _price) internal returns (uint256,uint256) {
    uint256 _zeros; //for calculating token
    uint256 _remainder; //temp calc holder for division remainder for leftover wei
    uint256 _numTokens;

    bool err;
    uint256 result;

    // Find the number of tokens as a function in wei
    (err,result) = _amount.times(_price);
    require(!err);

    if(self.base.tokenDecimals <= 18){
      _zeros = 10**(18-uint256(self.base.tokenDecimals));
      _numTokens = result/_zeros;
      _remainder = result % _zeros;     // extra wei leftover from the division
    } else {
      _zeros = 10**(uint256(self.base.tokenDecimals)-18);
      (err,_numTokens) = result.times(_zeros);
      require(!err);
    }

    // make sure there are enough tokens available to satisfy the bid
    require(_numTokens <= self.base.withdrawTokensMap[self.base.owner]);

    return (_numTokens,_remainder);
  }

  /// @dev Called when an address wants to submit bid to the sale
  /// @param self Stored crowdsale from crowdsale contract
  /// @param _amount amound of wei that the buyer is sending
  /// @param _personalValuation the total crowdsale valuation (wei) that the bidder is comfortable with
  /// @param _listPredict prediction of where the valuation will go in the linked list
  /// @return true on succesful bid
  function submitBid(InteractiveCrowdsaleStorage storage self,
                     uint256 _amount,
                     uint256 _personalValuation,
                     uint256 _valuePredict,
                     uint256 _personalMinimum,
                     uint256 _minPredict) returns (bool) {
    require(msg.sender != self.base.owner);
    require(self.base.validPurchase());
    // bidder can't have already bid
    require(self.personalMinAndValue[msg.sender][1] == 0 && self.base.hasContributed[msg.sender] == 0);

    bool err;

    // Fee is 63 Szabo calculated as follows:
    // fee pays for pointer to add or subtract bid value to/from the value
    // pointer, clears fee, and moves to the next bucket. Gas is +3 for add/subtract
    // +1 for loop +5,000 for sstore change = 5,004 - half for sstore non-zero
    // to zero refund = 2,502. Round up to 3,000 for incentive premium to caller
    // for setting value pointer. 3,000 * 21 Gwei = 63 Szabo
    // this fee is probably high because multiple bids will accumulate in the same
    // bucket and should be adjusted as testing moves along
    (err, _amount) = _amount.minus(FEE);
    require(!err);

    if (now < self.endWithdrawalTime) {
      require(_personalValuation > _amount);
    } else {
      // The personal valuation submitted must be greater than the current valuation plus the bid
      require(_personalValuation >= self.valuationCutoff + _amount);
    }
    // personal valuations need to be in multiples of whatever the owner sets
    require((_personalValuation % self.valuationGranularity) == 0);

    // bid must not exceed the total raise cap of the sale
    // **Could change this to add up to capAmount and provide change for last bidder
    require((self.base.ownerBalance + _amount) <= self.base.capAmount);

    // if the token price increase interval has passed, update the current day and change the token price
    if ((self.base.milestoneTimes.length > self.base.currentMilestone + 1) &&
        (now > self.base.milestoneTimes[self.base.currentMilestone + 1]))
    {
        while((self.base.milestoneTimes.length > self.base.currentMilestone + 1) &&
              (now > self.base.milestoneTimes[self.base.currentMilestone + 1]))
        {
          self.base.currentMilestone += 1;
        }

        self.base.changeTokenPrice(self.base.saleData[self.base.milestoneTimes[self.base.currentMilestone]][0]);
        LogTokenPriceChange(self.base.tokensPerEth,"Token Price has changed!");
    }

    // add the bid to the sorted valuations list
    uint256 _listSpot;
    if(!self.valuationsList.nodeExists(_personalValuation)){
          _listSpot = self.valuationsList.getSortedSpot(_valuePredict,_personalValuation,NEXT);
          self.valuationsList.insert(_listSpot,_personalValuation,PREV);
    }

    if(!self.valuationsList.nodeExists(_personalMinimum)){
      _listSpot = self.valuationsList.getSortedSpot(_valuePredict,_personalMinimum,NEXT);
      self.valuationsList.insert(_listSpot,_personalMinimum,PREV);
    }

    // add the minimum and valuation to the address => [minimum, valuation] mapping
    self.personalMinAndValue[msg.sender][0] = _personalMinimum;
    self.personalMinAndValue[msg.sender][1] = _personalValuation;

    // add the bid to bidder's contribution amount.  can't overflow because it is under the cap
    self.base.hasContributed[msg.sender] += _amount;

    // We are calculating the change impact each bucket has on the value pointer.
    // In this mechanism, the bid's personal valuation adds to the pointer and
    // the personal minimum subtracts from the pointer. Therefore, the value delta
    // in each bucket will be positive if there are more personal values and negative
    // if more personal minimums. In order to maintain the full uint256 spectrum,
    // each bucket has an indicator if the value in index-0 (the cumulative delta)
    // is positive or negative. If it is an overall negative delta, index-1 will
    // be '1', if it is a positive delta, index-1 will be '0'

    // First we add the bid amount to the delta in the indicated personal valuation bucket

    // if the delta is positive
    if(self.valueDelta[_personalValuation][1] == 0){
      self.valueDelta[_personalValuation][0] += _amount;
    } else {
      // if delta is negative and the new bid exceeds the delta, change the delta to positive
      if(_amount > self.valueDelta[_personalValuation][0]){
        self.valueDelta[_personalValuation][0] = _amount - self.valueDelta[_personalValuation][0];
        self.valueDelta[_personalValuation][1] = 0;
      } else {
        self.valueDelta[_personalValuation][0] -= _amount;
      }
    }

    // Next we subtract the bid amount from the delta in the indicated personal minimum bucket

    // if the delta is negative
    if(self.valueDelta[_personalMinimum][1] == 1){
      self.valueDelta[_personalMinimum][0] += _amount;
    } else {
      // if delta is positive and the new bid exceeds the delta, change the delta to negative
      if(_amount > self.valueDelta[_personalMinimum][0]){
        self.valueDelta[_personalMinimum][0] = _amount - self.valueDelta[_personalMinimum][0];
        self.valueDelta[_personalMinimum][1] = 1;
      } else {
        self.valueDelta[_personalMinimum][0] -= _amount;
      }
    }

    // collect the fee from earlier
    self.valueDelta[_personalValuation][2]++;

    LogBidAccepted(msg.sender, _amount, _personalValuation, _personalMinimum);

    return true;
  }


  /// @dev Called when an address wants to manually withdraw their bid from the sale.
  ///      puts their wei in the LeftoverWei mapping
  /// @param self Stored crowdsale frowithdrawalm crowdsale contract
  /// @return true on succesful
  function withdrawBid(InteractiveCrowdsaleStorage storage self) public returns (bool) {
    // The sender has to have already bid on the sale
    require(self.personalMinAndValue[msg.sender][1] > 0);

    uint256 refundWei;
    // cannot withdraw after compulsory withdraw period is over unless the bid's valuation is below the cutoff
    if (now >= self.endWithdrawalTime) {
      require(self.personalValuations[msg.sender] < self.valuationCutoff);

      refundWei = self.base.hasContributed[msg.sender];

    } else {
      uint256 multiplierPercent = (100*((self.endWithdrawalTime+self.base.milestoneTimes[0]) - now))/self.endWithdrawalTime;
      refundWei = (multiplierPercent*self.base.hasContributed[msg.sender])/100;
    }

    // Put the sender's contributed wei into the leftoverWei mapping for later withdrawal
    self.base.leftoverWei[msg.sender] += refundWei;

    // subtract the bidder's refund from its total contribution
    self.base.hasContributed[msg.sender] -= refundWei;

    // remove this bid from the buckets

    uint256 _personalValuation = self.personalMinAndValue[msg.sender][1];
    uint256 _personalMinimum = self.personalMinAndValue[msg.sender][0];

    // if the delta is negative
    if(self.valueDelta[_personalValuation][1] == 1){
      self.valueDelta[_personalValuation][0] += _amount;
    } else {
      // if delta is positive and the removing bid exceeds the delta, change the delta to negative
      if(_amount > self.valueDelta[_personalValuation][0]){
        self.valueDelta[_personalValuation][0] = _amount - self.valueDelta[_personalValuation][0];
        self.valueDelta[_personalValuation][1] = 1;
      } else {
        self.valueDelta[_personalValuation][0] -= _amount;
      }
    }

    // if the delta is positive
    if(self.valueDelta[_personalMinimum][1] == 0){
      self.valueDelta[_personalMinimum][0] += _amount;
    } else {
      // if delta is negative and the new bid exceeds the delta, change the delta to positive
      if(_amount > self.valueDelta[_personalMinimum][0]){
        self.valueDelta[_personalMinimum][0] = _amount - self.valueDelta[_personalMinimum][0];
        self.valueDelta[_personalMinimum][1] = 0;
      } else {
        self.valueDelta[_personalMinimum][0] -= _amount;
      }
    }
  }

  /// @dev If the address' personal valuation is below the valuationCutoff or
  ///      personal minimum is more than the minimumCutoff, refund them all their ETH.
  ///      If it is above the cutoff, calculate tokens purchased and refund leftoever ETH
  /// @param self Stored crowdsale from crowdsale contract
  /// @return bool success if the contract runs successfully
  function retreiveFinalResult(InteractiveCrowdsaleStorage storage self) internal returns (bool) {
    require(now > self.base.endTime);
    require(self.base.hasContributed[msg.sender] > 0);

    uint256 numTokens;
    uint256 remainder;
    bool err;

    if ((self.personalMinAndValue[msg.sender][1] < self.valuationCutoff) ||
        (sel.f.personalMinAndValue[msg.sender][0] > self.minimumCutoff)) {

      self.base.leftoverWei[msg.sender] += self.base.hasContributed[msg.sender];
    } else if (self.personalMinAndValue[msg.sender][1] == self.valuationCutoff) {
      uint256 q;

      // calculate the fraction of each minimal valuation bidders ether and tokens to refund
      q = (100*(self.base.ownerBalance - self.valuationCutoff)/(self.valuationSums[self.valuationCutoff])) + 1;

      // calculate the portion that this address has to take out of their bid
      uint256 refundAmount = (q*self.base.hasContributed[msg.sender])/100;

      // refund that amount of wei to the address
      self.base.leftoverWei[msg.sender] += refundAmount;

      // subtract that amount the address' contribution
      self.base.hasContributed[msg.sender] -= refundAmount;
    }

    // calculate the number of tokens that the bidder purchased
    (numTokens, remainder) = calculateTokenPurchase(self,self.base.hasContributed[msg.sender],self.pricePurchasedAt[msg.sender]);

    // add tokens to the bidders purchase.  can't overflow because it will be under the cap
    self.base.withdrawTokensMap[msg.sender] += numTokens;

    //subtract tokens from owner's share
    (err,remainder) = self.base.withdrawTokensMap[self.base.owner].minus(numTokens);
    require(!err);
    self.base.withdrawTokensMap[self.base.owner] = remainder;

    return true;
  }



   /*Functions "inherited" from CrowdsaleLib library*/

  function setTokenExchangeRate(InteractiveCrowdsaleStorage storage self, uint256 _exchangeRate) returns (bool) {
    return self.base.setTokenExchangeRate(_exchangeRate);
  }

  function setTokens(InteractiveCrowdsaleStorage storage self) internal returns (bool) {
    return self.base.setTokens();
  }

  function withdrawTokens(InteractiveCrowdsaleStorage storage self) internal returns (bool) {
    require(now > self.base.endTime);

    retreiveFinalResult(self);

    return self.base.withdrawTokens();
  }

  function withdrawLeftoverWei(InteractiveCrowdsaleStorage storage self) internal returns (bool) {
    if (now > self.base.endTime) {
      retreiveFinalResult(self);
    }

    return self.base.withdrawLeftoverWei();
  }

  function withdrawOwnerEth(InteractiveCrowdsaleStorage storage self) internal returns (bool) {
    return self.base.withdrawOwnerEth();
  }

  function crowdsaleActive(InteractiveCrowdsaleStorage storage self) internal constant returns (bool) {
    return self.base.crowdsaleActive();
  }

  function crowdsaleEnded(InteractiveCrowdsaleStorage storage self) internal constant returns (bool) {
    return self.base.crowdsaleEnded();
  }

  function getPersonalValuation(InteractiveCrowdsaleStorage storage self, address _bidder) internal constant returns (uint256) {
    return self.personalValuations[_bidder];
  }

  function getSaleData(InteractiveCrowdsaleStorage storage self, uint256 _timestamp) internal constant returns (uint256[3]) {
    return self.base.getSaleData(_timestamp);
  }

  function getTokensSold(InteractiveCrowdsaleStorage storage self) internal constant returns (uint256) {
    return self.base.getTokensSold();
  }

}
