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

  // FEE needs to be tested to see if it's too much or too little. This fee
  // will incentivize a caller to set the value pointer at withdrawal lock.
  uint256 constant FEE = 63000000000000;

  // This limit will need to be adjusted, it is used to determine when we should
  // break out of the loop that initially sets the value pointer at withdrawal lock.
  uint256 constant LOWGASLIMIT = 31000;

  struct InteractiveCrowdsaleStorage {

    CrowdsaleLib.CrowdsaleStorage base; // base storage from CrowdsaleLib

    // List of personal valuations, sorted from smallest to largest (from LinkedListLib)
    LinkedListLib.LinkedList valuationsList;
    // Keep track of first and last node to avoid iterating for it
    uint256 highestValue;
    uint256 lowestValue;

    uint256 endWithdrawalTime;   // time when manual withdrawals are no longer allowed

    // flags
    bool pointerSet;
    bool allBucketsPoked;

    // temp holder for pointer iteration
    uint256 currentBucket;

    // pointer to the lowest personal cap that can remain in the sale
    uint256 valuationPointer;
    // amount of value committed at this valuation
    uint256 valueCommitted;

    mapping (address => uint256) pricePurchasedAt;      // shows the price that the address purchased tokens at

    // mapping of valuation 'buckets' with total amount committed as personal
    // minimum and total committed as personal cap
    // 0-index is total committed as personal minimum
    // 1-index is total committed as personal cap
    // 2-index is the accumulated number of fees in this bucket
    mapping (uint256 => uint256[3]) valueMinAndCap;

    // index-0 is the personal minimum and index-1 is the personal cap
    mapping (address => uint256[2]) personalMinAndCap;
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
  /// index-2 is address purchase cap at that time, should be 0 for this sale
  /// @param _fallbackExchangeRate Exchange rate of cents/ETH
  /// @param _capAmountInCents Total to be raised in cents
  /// @param _endWithdrawalTime Time when withdrawal lock kicks in
  /// @param _endTime Timestamp of sale end time
  /// @param _percentBurn Percentage of extra tokens to burn
  /// @param _token Token being sold
  function init(InteractiveCrowdsaleStorage storage self,
                address _owner,
                uint256[] _saleData,
                uint256 _fallbackExchangeRate,
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

    // set the lowest value in the linked list to start at the cap and it will
    // move down as lower values are set on the linked list
    self.lowestValue = self.base.capAmount;
    self.endWithdrawalTime = _endWithdrawalTime;
  }

  /// @dev calculates the number of digits in a given number
  /// @param _number the number for which we're caluclating digits
  /// @return _digits the number of digits in _number
  function numDigits(uint256 _number) constant returns (uint256) {
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
  /// @return _numTokens the number of tokens purchased
  /// @return _remainder  any remaining wei leftover from integer division
  function calculateTokenPurchase(InteractiveCrowdsaleStorage storage self,
                                  uint256 _amount,
                                  uint256 _price)
                                  constant returns (uint256,uint256)
  {
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

  /// @dev When the value pointer is activated, it will read each valuation bucket
  ///      to determine where equilibrium is. Each bucket needs to be set such that
  ///      the pointer knows how much has been committed to this bucket as a personal
  ///      cap and how much has been committed at the personal minimum.
  ///      Since these two indicators have an exact opposite impact on the
  ///      pointer, we merely need to calculate these impacts in the same bucket.
  ///      Therefore, for each bid, we determine how much is being committed to
  ///      this value as a personal cap, find the value bucket, and increase the
  ///      personal cap value in this bucket. Then, find the valuation bucket
  ///      for the personal minimum and increase the personal minimum value in
  ///      that bucket.
  /// @param _amount The amount being bid
  /// @param _personalCap The personal cap for this bid
  /// @param _personalMinimum The personal minimum for this bid
  /// @param _withdraw True if this is a withdrawal, false otherwise
  function setBucketValue(InteractiveCrowdsaleStorage storage self,
                                uint256 _amount,
                                uint256 _personalCap,
                                uint256 _personalMinimum,
                                bool _withdraw)
                                internal returns (bool)
  {
    if(!_withdraw){

      // First we add the bid amount to the bucket in the indicated personal minimum bucket
      self.valueMinAndCap[_personalMinimum][0] += _amount;

      // Then do the same for the personal cap bucket
      self.valueMinAndCap[_personalCap][1] += _amount;

    } else {
      // First we add the bid amount to the bucket in the indicated personal minimum bucket
      self.valueMinAndCap[_personalMinimum][0] -= _amount;

      // Then do the same for the personal cap bucket
      self.valueMinAndCap[_personalCap][1] -= _amount;
    }

    return true;
  }

  /// @dev Called when an address wants to submit bid to the sale
  /// @param self Stored crowdsale from crowdsale contract
  /// @param _amount amound of wei that the buyer is sending
  /// @param _personalCap the total crowdsale valuation (wei) that the bidder is comfortable with
  /// @param _valuePredict prediction of where the valuation will go in the linked list
  /// @param _personalMinimum the crowdsale minimum (wei) that the bidder is comfortable with
  /// @param _minPredict prediction of where the minimum valuation will go in the linked list
  /// @return true on succesful bid
  function submitBid(InteractiveCrowdsaleStorage storage self,
                     uint256 _amount,
                     uint256 _personalCap,
                     uint256 _valuePredict,
                     uint256 _personalMinimum,
                     uint256 _minPredict) returns (bool) {
    require(msg.sender != self.base.owner);
    require(self.base.validPurchase());
    // bidder can't have already bid
    require(self.personalMinAndCap[msg.sender][1] == 0 &&
            self.base.hasContributed[msg.sender] == 0);

    bool err;
    bool success;

    // Prior to withdrawal lock fees are collected to calculate pointer at withdrawal lock.
    // Need to check for bonus price changes, and _personalCap only needs to
    // be greater than the bid amount.
    if(now < endWithdrawalTime){
      // Fee is 63 Szabo calculated as follows:
      // fee pays for pointer to add or subtract bid value to/from the value
      // pointer, clears fee, and moves to the next bucket. Gas is +3 for add/subtract
      // +3 for gas check +1 for loop +5,000 for sstore change = 5,007 - half for sstore non-zero
      // to zero refund = 2,503. Round up to 3,000 for incentive premium to caller
      // for setting value pointer. 3,000 * 21 Gwei = 63 Szabo
      // this fee is probably high because multiple bids will accumulate in the same
      // bucket and should be adjusted as testing moves along
      (err, _amount) = _amount.minus(FEE);
      require(!err);
      // collect the fee into the valuation bucket
      self.valueMinAndCap[_personalCap][2]++;

      require(_personalCap > _amount);

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
    } else {
      // The personal valuation submitted must be greater than the current valuation plus the bid
      require(_personalCap >= self.valuationPointer + _amount);

      // No personal minimum can be set after withdrawal lock
      require(_personalMinimum == 0);
    }

    // personal valuation and minimum should be set to the proper granularity, only
    // three most significant values can be non-zero
    uint256 digits = numDigits(_personalCap);
    if(digits > 3)
      require((_personalCap % (10**(digits - 3))) == 0);

    digits = numDigits(_personalMinimum);
    if(digits > 3)
      require((_personalMinimum % (10**(digits - 3))) == 0);

    // add the bid to the sorted valuations list
    uint256 _listSpot;
    if(!self.valuationsList.nodeExists(_personalCap)){
      _listSpot = self.valuationsList.getSortedSpot(_valuePredict,_personalCap,NEXT);
      self.valuationsList.insert(_listSpot,_personalCap,PREV);
      if(_personalCap > self.highestValue) self.highestValue = _personalCap;
    }

    if(!self.valuationsList.nodeExists(_personalMinimum)){
      _listSpot = self.valuationsList.getSortedSpot(_minPredict,_personalMinimum,NEXT);
      self.valuationsList.insert(_listSpot,_personalMinimum,PREV);
      if(_personalMinimum < self.lowestValue) self.lowestValue = _personalMinimum;
    }

    // add the minimum and valuation to the address => [minimum, valuation] mapping
    self.personalMinAndCap[msg.sender][0] = _personalMinimum;
    self.personalMinAndCap[msg.sender][1] = _personalCap;

    // add the bid to bidder's contribution amount.  can't overflow because it is under the cap
    self.base.hasContributed[msg.sender] += _amount;
    self.pricePurchasedAt[msg.sender] = self.base.tokensPerEth;

    success = self.setBucketValue(_amount, _personalCap, _personalMinimum, false);
    assert(success);
    // if we are prior to the withdrawal lock
    if(now >= endWithdrawalTime){
      // the pointer has to be set after withdrawal lock before sale can proceed
      require(self.allBucketsPoked);

      // bid must not exceed the total raise cap of the sale
      // **Could change this to add up to capAmount and provide change for last bidder
      require((self.valueCommitted + _amount) <= self.base.capAmount);
      // We now caluculate the value pointer as bids come in since there are no more withdrawals.

      uint256 _proposedCommit;
      uint256 _currentBucket;
      // since no personal minimum after the withdrawal lock, all bids are committed
      self.valueCommitted += _amount;

      // prepare to move the pointer by subtracting the current valuation bucket's
      // personal cap bids. The reason being that these bids will be eliminated
      // from the sale if the pointer moves up in valuation.
      _proposedCommit = self.valueCommitted - self.valueMinAndCap[_self.valuationPointer][1];

      // move the pointer up to the next bucket
      _currentBucket = self.valuationsList.getAdjacent(self.valuationPointer, NEXT);

      // add the minimums in this bucket
      _proposedCommit = _proposedCommit + self.valueMinAndCap[_currentBucket][0];

      // test to see if we can move up in valuation
      while(_currentBucket < _proposedCommit){
        self.valuationPointer = _currentBucket;
        self.valueCommitted = _proposedCommit;

        _proposedCommit = self.valueCommitted - self.valueMinAndCap[_currentBucket][1];
        _currentBucket = self.valuationsList.getAdjacent(self.valuationPointer, NEXT);
        _proposedCommit = _proposedCommit + self.valueMinAndCap[_currentBucket][0];
      }
    }

    LogBidAccepted(msg.sender, _amount, _personalCap, _personalMinimum);

    return true;
  }


  /// @dev Called when an address wants to manually withdraw their bid from the sale.
  ///      puts their wei in the LeftoverWei mapping
  /// @param self Stored crowdsale frowithdrawalm crowdsale contract
  /// @return true on succesful
  function withdrawBid(InteractiveCrowdsaleStorage storage self) public returns (bool) {
    // The sender has to have already bid on the sale
    require(self.personalMinAndCap[msg.sender][1] > 0);

    uint256 _refundWei;
    // cannot withdraw after compulsory withdraw period is over unless the bid's valuation is below the cutoff
    if (now >= self.endWithdrawalTime) {
      require(self.personalMinAndCap[msg.sender][1] < self.valuationPointer);

      _refundWei = self.base.hasContributed[msg.sender];

    } else {
      uint256 multiplierPercent = (100*((self.endWithdrawalTime+self.base.milestoneTimes[0]) - now))/self.endWithdrawalTime;
      _refundWei = (multiplierPercent*self.base.hasContributed[msg.sender])/100;
    }

    // Put the sender's contributed wei into the leftoverWei mapping for later withdrawal
    self.base.leftoverWei[msg.sender] += _refundWei;

    // subtract the bidder's refund from its total contribution
    self.base.hasContributed[msg.sender] -= _refundWei;

    // remove this bid from the buckets
    bool success = self.setBucketValue(_refundWei,
                                       self.personalMinAndCap[msg.sender][1],
                                       self.personalMinAndCap[msg.sender][0],
                                       true);
    assert(success);

    return true;
  }

  /// @dev The function that will set the value pointer. This will be callable
  ///      at withdrawal lock and until all buckets have been poked.
  /// @param self Stored crowdsale frowithdrawalm crowdsale contract
  /// @return true on succesful
  function setPointer(InteractiveCrowdsaleStorage storage self) public returns (bool){
    require((!self.allBucketsPoked) && (now >= self.endWithdrawalTime));

    // use memory to save on sstore costs on every loop
    uint256 _currentBucket = self.currentBucket;
    uint256 _totalCommit = self.valueCommitted;

    if(_currentBucket == 0){
      _currentBucket = self.highestValue;

      // spend the 20,000 gas now to allow for lower predictable cost when low on gas
      self.currentBucket = 1;
      self.totalCommit = 1;
    }

    // while we have enough gas, waterfall down all buckets to find value equilibrium
    while(msg.gas > LOWGASLIMIT){

      if(!self.pointerSet){
        _totalCommit += self.valueMinAndCap[_currentBucket][1];

        if(_totalCommit < _currentBucket){
          _totalCommit -= self.valueMinAndCap[_currentBucket][0];
        } else {
          self.valuationPointer = _currentBucket;
          self.valueCommitted = _totalCommit;
          self.pointerSet = true;
        }
      }

      // collect the fee from this bucket
      self.base.leftoverWei[msg.sender] += (FEE*self.valueMinAndCap[_currentBucket][2]);

      // once we've reached the lowest bucket break out of the loop
      if(_currentBucket == self.lowestValue) break;

      _currentBucket = self.valuationsList.getAdjacent(_currentBucket, PREV);
    }

    // if we made it through all buckets
    if(_currentBucket == self.lowestValue){
      self.currentBucket = 0;
      self.allBucketsPoked = true;
      return true;
    } else {
      // we're low on gas, store and save
      self.currentBucket = _currentBucket;
      self.valueCommitted = _totalCommit;
      return true;
    }
  }

  /// @dev This should be called once the sale is over to commit all bids into
  ///      the owner's bucket.
  function finalizeSale(InteractiveCrowdsaleStorage storage self) public returns (bool) {
    require(now >= self.base.endTime);

    self.base.ownerBalance = self.valueCommitted;
  }

  /// @dev If the address' personal valuation is below the valuationPointer or
  ///      personal minimum is more than the minimumCutoff, refund them all of their ETH.
  ///      If it is above the cutoff, calculate tokens purchased and refund leftover ETH
  /// @param self Stored crowdsale from crowdsale contract
  /// @return bool success if the contract runs successfully
  function retreiveFinalResult(InteractiveCrowdsaleStorage storage self) internal returns (bool) {
    require(now > self.base.endTime);
    require(self.base.hasContributed[msg.sender] > 0);

    uint256 numTokens;
    uint256 remainder;
    bool err;

    if ((self.personalMinAndCap[msg.sender][1] < self.valuationPointer) ||
        (self.personalMinAndCap[msg.sender][0] > self.valuationPointer)) {

      self.base.leftoverWei[msg.sender] += self.base.hasContributed[msg.sender];
    } else if (self.personalMinAndCap[msg.sender][1] == self.valuationPointer) {
      uint256 q;

      // calculate the fraction of each minimal valuation bidders ether and tokens to refund
      q = (100*(self.base.ownerBalance - self.valuationPointer)/(self.valueMinAndCap[self.valuationPointer][1])) + 1;

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
    return self.personalMinAndCap[_bidder][1];
  }

  function getSaleData(InteractiveCrowdsaleStorage storage self, uint256 _timestamp) internal constant returns (uint256[3]) {
    return self.base.getSaleData(_timestamp);
  }

  function getTokensSold(InteractiveCrowdsaleStorage storage self) internal constant returns (uint256) {
    return self.base.getTokensSold();
  }

}
