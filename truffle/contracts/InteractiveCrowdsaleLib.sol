pragma solidity ^0.4.18;

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

  struct InteractiveCrowdsaleStorage {

    CrowdsaleLib.CrowdsaleStorage base; // base storage from CrowdsaleLib

    // List of personal valuations, sorted from smallest to largest (from LinkedListLib)
    LinkedListLib.LinkedList valuationsList;

    uint256 endWithdrawalTime;   // time when manual withdrawals are no longer allowed

    // pointer to the lowest personal valuation that can remain in the sale
    uint256 valuationPointer;
    // amount of value committed at this valuation, cannot rely on owner balance
    // due to fluctations in commitment calculations needed after owner withdraws
    uint256 valueCommitted;
    bool ownerHasWithdrawnETH;

    // minimim amount that the sale needs to make to be successfull
    uint256 minimumRaise;

    // shows the price that the address purchased tokens at
    mapping (address => uint256) pricePurchasedAt;

    // the sums of bids at each valuation
    mapping (uint256 => uint256) valuationSums;

    // the number of active bids at a certain valuation cap
    mapping (uint256 => uint256) numBidsAtValuation;

    // the valuation cap that each address has submitted
    mapping (address => uint256) personalCaps;
  }

  // Indicates when a bidder submits a bid to the crowdsale
  event LogBidAccepted(address indexed bidder, uint256 amount, uint256 personalValuation);

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
                uint256 _minimumRaise,
                uint256 _capAmountInCents,
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
    require(_minimumRaise > 0);
    require(_minimumRaise < _capAmountInCents);
    self.minimumRaise = _minimumRaise;
    self.endWithdrawalTime = _endWithdrawalTime;
  }

  /// @dev calculates the number of digits in a given number
  /// @param _number the number for which we're caluclating digits
  /// @return _digits the number of digits in _number
  function numDigits(uint256 _number) public pure returns (uint256) {
    uint256 _digits = 0;
    while (_number != 0) {
      _number /= 10;
      _digits++;
    }
    return _digits;
  }

  /// @dev calculates the number of tokens purchased based on the amount of wei
  ///      spent and the price of tokens
  /// @param self Stored crowdsale from crowdsale contract
  /// @param _amount amound of wei that the buyer sent
  /// @param _price price of tokens in the sale, in tokens/ETH
  /// @return uint256 numTokens the number of tokens purchased
  /// @return remainder  any remaining wei leftover from integer division
  function calculateTokenPurchase(InteractiveCrowdsaleStorage storage self,
                                  uint256 _amount,
                                  uint256 _price)
                                  internal
                                  view
                                  returns (uint256,uint256)
  {
    uint256 zeros; //for calculating token
    uint256 remainder = 0; //temp calc holder for division remainder for leftover wei

    bool err;
    uint256 result;
    uint256 numTokens;
    uint256 weiTokens; //temp calc holder
    uint256 leftoverWei; //wei change for purchaser

    // Find the number of tokens as a function in wei
    (err,weiTokens) = _amount.times(_price);
    require(!err);

    numTokens = weiTokens / 1000000000000000000;
    remainder = weiTokens % 1000000000000000000;
    remainder = remainder / _price;
    leftoverWei = leftoverWei + remainder;

    // make sure there are enough tokens available to satisfy the bid
    assert(numTokens <= self.base.token.balanceOf(this));

    return (numTokens,remainder);
  }

  /// @dev Called when an address wants to submit bid to the sale
  /// @param self Stored crowdsale from crowdsale contract
  /// @param _amount amound of wei that the buyer is sending
  /// @param _personalCap the total crowdsale valuation (wei) that the bidder is comfortable with
  /// @param _valuePredict prediction of where the valuation will go in the linked list
  /// @return true on succesful bid
  function submitBid(InteractiveCrowdsaleStorage storage self,
                      uint256 _amount,
                      uint256 _personalCap,
                      uint256 _valuePredict) public returns (bool)
  {
    require(msg.sender != self.base.owner);
    require(self.base.validPurchase());
    // bidder can't have already bid
    require(self.personalCaps[msg.sender] == 0 && self.base.hasContributed[msg.sender] == 0);
    if (now < self.endWithdrawalTime) {
      require(_personalCap > _amount);
    } else {
      // The personal valuation submitted must be greater than the current
      // valuation plus the bid
      require(_personalCap >= self.valuationPointer + _amount);
    }

    // if the token price increase interval has passed, update the current day
    // and change the token price
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

    // personal valuation and minimum should be set to the proper granularity,
    // only three most significant values can be non-zero
    uint256 digits = numDigits(_personalCap);
    if(digits > 3)
      require((_personalCap % (10**(digits - 3))) == 0);

    // add the bid to the sorted valuations list
    uint256 _listSpot;
    if(!self.valuationsList.nodeExists(_personalCap)){
        _listSpot = self.valuationsList.getSortedSpot(_valuePredict,_personalCap,NEXT);
        self.valuationsList.insert(_listSpot,_personalCap,PREV);
    }

    // add the bid to the address => cap mapping
    self.personalCaps[msg.sender] = _personalCap;

    // add the bid to the sum of bids at this valuation
    self.valuationSums[_personalCap] += _amount;
    self.numBidsAtValuation[_personalCap] += 1;

    // add the bid to bidder's contribution amount.  can't overflow because it
    // is under the cap
    self.base.hasContributed[msg.sender] += _amount;
    self.valueCommitted += _amount;

    uint256 proposedCommit;
    uint256 currentBucket;
    // prepare to move the pointer by subtracting the current valuation bucket's
    // personal cap bids. The reason being that these bids will be eliminated
    // from the sale if the pointer moves up in valuation.
    proposedCommit = self.valueCommitted - self.valuationSums[self.valuationPointer];

    // move the pointer up to the next bucket
    currentBucket = self.valuationsList.getAdjacent(self.valuationPointer, NEXT);

    // test to see if we can move up in valuation
    while(currentBucket < proposedCommit){
      self.valuationPointer = currentBucket;
      self.valueCommitted = proposedCommit;

      proposedCommit = self.valueCommitted - self.valuationSums[currentBucket];
      currentBucket = self.valuationsList.getAdjacent(self.valuationPointer, NEXT);
    }
    self.pricePurchasedAt[msg.sender] = self.base.tokensPerEth;
    LogBidAccepted(msg.sender, _amount, _personalCap);

    return true;
  }


  /// @dev Called when an address wants to manually withdraw their bid from the
  ///      sale. puts their wei in the LeftoverWei mapping
  /// @param self Stored crowdsale frowithdrawalm crowdsale contract
  /// @return true on succesful
  function withdrawBid(InteractiveCrowdsaleStorage storage self) public returns (bool) {
    // The sender has to have already bid on the sale
    require(self.personalCaps[msg.sender] > 0);

    uint256 refundWei;
    // cannot withdraw after compulsory withdraw period is over unless the bid's
    // valuation is below the cutoff
    if (now >= self.endWithdrawalTime) {
      require(self.personalCaps[msg.sender] < self.valuationPointer);

      refundWei = self.base.hasContributed[msg.sender];

    } else {
      uint256 multiplierPercent = (100*((self.endWithdrawalTime+self.base.milestoneTimes[0]) - now))/self.endWithdrawalTime;
      refundWei = (multiplierPercent*self.base.hasContributed[msg.sender])/100;
    }

    // Put the sender's contributed wei into the leftoverWei mapping for later withdrawal
    self.base.leftoverWei[msg.sender] += refundWei;

    // subtract the bidder's refund from its total contribution
    self.base.hasContributed[msg.sender] -= refundWei;

    // subtract the bid from the sum of bids at this valuation
    self.valuationSums[self.personalCaps[msg.sender]] -= refundWei;
    self.numBidsAtValuation[self.personalCaps[msg.sender]] -= 1;

    self.valueCommitted -= refundWei;

    uint256 proposedCommit;
    uint256 currentBucket;

    // prepare to move the pointer by adding the previous valuation bucket's
    // personal cap bids. The reason being that these bids will be added
    // back to the sale if the pointer moves down in valuation.
    // move the pointer up to the next bucket
    currentBucket = self.valuationsList.getAdjacent(self.valuationPointer, PREV);

    proposedCommit = self.valueCommitted + self.valuationSums[currentBucket];

    // test to see if we need to move down in valuation
    while(currentBucket > proposedCommit){
      self.valuationPointer = currentBucket;
      self.valueCommitted = proposedCommit;

      currentBucket = self.valuationsList.getAdjacent(self.valuationPointer, PREV);
      proposedCommit = self.valueCommitted + self.valuationSums[currentBucket];
    }

    // remove the entry for this personal cap if it is the last bid at this
    // valuation to be finalized
    if (self.numBidsAtValuation[self.personalCaps[msg.sender]] == 0) {
      // Removing the entry from the linked list returns the key of the removed
      // entry, so make sure that was succesful
      assert(self.valuationsList.remove(self.personalCaps[msg.sender]) == self.personalCaps[msg.sender]);
    }

    LogBidWithdrawn(msg.sender, self.base.hasContributed[msg.sender], self.personalCaps[msg.sender]);

  }

  /// @dev This should be called once the sale is over to commit all bids into
  ///      the owner's bucket.
  function finalizeSale(InteractiveCrowdsaleStorage storage self) public returns (bool) {
    require(now >= self.base.endTime);
    require(!self.ownerHasWithdrawnETH);

    self.ownerHasWithdrawnETH = true;
    self.base.ownerBalance = self.valueCommitted;
  }

  /// @dev If the address' personal cap is below the pointer, refund them all their ETH.
  ///      if it is above the pointer, calculate tokens purchased and refund leftoever ETH
  /// @param self Stored crowdsale from crowdsale contract
  /// @return bool success if the contract runs successfully
  function retreiveFinalResult(InteractiveCrowdsaleStorage storage self) internal returns (bool) {
    require(now > self.base.endTime);
    require(self.base.hasContributed[msg.sender] > 0);

    uint256 numTokens;
    uint256 remainder;
    bool err;

    if (self.valueCommitted < self.minimumRaise) {
      self.base.leftoverWei[msg.sender] += self.base.hasContributed[msg.sender];
      return true;
    }

    if (self.personalCaps[msg.sender] < self.valuationPointer) {

      self.base.leftoverWei[msg.sender] += self.base.hasContributed[msg.sender];
      return true;

    } else if (self.personalCaps[msg.sender] == self.valuationPointer) {
      uint256 q;

      // calculate the fraction of each minimal valuation bidders ether and tokens to refund
      q = (100*(self.valueCommitted - self.valuationPointer)/(self.valuationSums[self.valuationPointer])) + 1;

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

  function getPersonalCap(InteractiveCrowdsaleStorage storage self, address _bidder) internal constant returns (uint256) {
    return self.personalCaps[_bidder];
  }

  function getSaleData(InteractiveCrowdsaleStorage storage self, uint256 _timestamp) internal constant returns (uint256[3]) {
    return self.base.getSaleData(_timestamp);
  }

  function getTokensSold(InteractiveCrowdsaleStorage storage self) internal constant returns (uint256) {
    return self.base.getTokensSold();
  }

}
