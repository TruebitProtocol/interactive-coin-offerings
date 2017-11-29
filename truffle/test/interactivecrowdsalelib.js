import {advanceBlock} from './helpers/advanceToBlock'
import {increaseTimeTo, duration} from './helpers/increaseTime'
import latestTime from './helpers/latestTime'
const { should } = require('./helpers/utils')
const CrowdsaleToken = artifacts.require("CrowdsaleToken");
const InteractiveCrowdsaleTestContract = artifacts.require("InteractiveCrowdsaleTestContract");

// can also set sale as a global up here and carry it throughout
// var sale;
contract('InteractiveCrowdsaleTestContract', function (accounts) {
    let sale
    let startTime

    // before(async function() {
    //     //sale = await InteractiveCrowdsaleTestContract.deployed()
    //     //Advance to the next block to correctly read time in the solidity "now" function interpreted by testrpc
    //     await advanceBlock()
    // })

    beforeEach(async function () {
      startTime = latestTime() + duration.weeks(7)
      this.endTime =   this.startTime + duration.years(2)
      this.afterEndTime = this.endTime + duration.seconds(1)


      sale = await InteractiveCrowdsaleTestContract.deployed()

      //this.token = CrowdsaleToken.at(await sale.token())
    })

    // beforeEach(async () => {
    //   sale = await InteractiveCrowdsaleTestContract.deployed()
    // })

    it('can throw an error using a try catch block', async () => {
      let err = false;
      try{
          await sale.submitBid({ value: 40000000000000000000, from: accounts[1] });
        } catch(e) {
        err = true;
      }
      assert.isTrue(err, "should give an error message since sale has not started");
    });


    it('has the correct owner', async () => {
      const owner = await sale.getOwner()
      owner.should.be.equal(accounts[5])
    })

    it('has the correct exchange rate', async () => {
      const rate = await sale.getExchangeRate()
      rate.should.be.bignumber.equal(29000)
    })

    it('has the correct minimum raise', async () => {
      const raise = await sale.getMinimumRaise()
      raise.should.be.bignumber.equal(10000000)
    })

    it('has the correct cap Amount', async () => {
      const amount = await sale.getCapAmount()
      amount.should.be.bignumber.equal(5.8621e+22)
    })

    it('has the correct endWithdrawalTime', async () => {
      const gran = await sale.getEndWithdrawlTime()
      gran.should.be.bignumber.equal(1530000000)
    })

    /// CHECK THE REST OF THE INITIALIZATION


    it('should accept a bid', async () => {
        await increaseTimeTo(startTime)
        await sale.submitBid(100000000,0,{from:accounts[0],value:1000000})
        const cont = sale.getContribution(accounts[0])
        cont.should.be.bignumber.equal(1000000)
    })


});


//
// /*************************************************************************
//
//
//
// **************************************************************************/
//
// contract('TimeInteractiveCrowdsaleTestContract', (accounts) => {
//   it("should initialize the interactive crowdsale contract data", async () => {
//     const c = await TimeInteractiveCrowdsaleTestContract.deployed();
//     const owner = await c.getOwner.call();
//     const tokensPerEth = await c.getTokensPerEth.call();
//     const capAmount = await c.getCapAmount.call();
//     const startTime = await c.getStartTime.call();
//     const endTime = await c.getEndTime.call();
//     const exchangeRate = await c.getExchangeRate.call();
//     const totalValuation = await c.getTotalValuation.call();
//     const percentBurn = await c.getPercentBurn.call();
//     const endWithdrawlTime = await c.getEndWithdrawlTime.call();
//
//     assert.equal(owner.valueOf(), accounts[5], "Owner should be set to accounts[5].");
//     assert.equal(tokensPerEth.valueOf(), 206, "Symbol should be set to TST.");
//     assert.equal(capAmount.valueOf(), 5.8621e+22, "capAmount should be 5.8621e+22");
//     assert.equal(startTime.valueOf(), 105, "Start time should be 105");
//     assert.equal(endTime.valueOf(),125, "end time should be 125");
//     assert.equal(exchangeRate.valueOf(),29000, "exchangeRate should be 29000");
//     assert.equal(totalValuation.valueOf(), 0, "total valuation of the crowdsale should be zero");
//     assert.equal(percentBurn.valueOf(), 50, "Percentage of Tokens to burn after the crowdsale should be 50!");
//     assert.equal(endWithdrawlTime.valueOf(), 120, "Time to end manual bid withdrawls should be 120!");
//
//   });
//
//
//   it("should deny non-owner transactions pre-crowdsale, set exchange rate", async () => {
//     const c = await TimeInteractiveCrowdsaleTestContract.deployed();
//
//     const t = await CrowdsaleToken.deployed();
//
//     await t.transfer(c.contract.address,12000000000000000000000000,{from:accounts[5]});
//     var tokenbalance = await t.balanceOf.call(c.contract.address);
//     assert.equal(tokenbalance.valueOf(), 12000000000000000000000000,  "crowdsale's token balance should be 20000000000000000000000000!");
//
//     var exch_succ = await c.setTokenExchangeRate(30000,103, {from:accounts[5]});
//     assert.equal(exch_succ.logs[0].args.Msg, "Owner has sent the exchange Rate and tokens bought per ETH!", "Should give success message that the exchange rate was set.");
//
//     exch_succ = await c.setTokenExchangeRate(30000,101, {from:accounts[5]});
//     assert.equal(exch_succ.logs[0].args.Msg, 'Owner can only set the exchange rate once up to three days before the sale!', "Should give an error message that timing for setting the exchange rate is wrong.");
//
//     var exchange = await c.getExchangeRate.call();
//     assert.equal(exchange.valueOf(), 30000, "exchangeRate should have been set to 30000!");
//
//     var tokensPerEth = await c.getTokensPerEth.call();
//     assert.equal(tokensPerEth.valueOf(), 213, "tokensPerEth should have been set to 213!");
//
//     ret = await c.getTokenPurchase.call(accounts[0]);
//     assert.equal(ret.valueOf(), 0, "accounts0 token purchase should be 0!");
//
//   });
//
//   it("should accept bids during the sale, place them in a sorted list, and allow manual withdrawls", async () => {
//     const c = await TimeInteractiveCrowdsaleTestContract.deployed();
//
//     await c.submitBid(1e22,0, 106, {from:accounts[0], value: 1e20});
//
//     var token_purchase = await c.getTokenPurchase.call(accounts[0]);
//     assert.equal(token_purchase.valueOf(), 2.13e22, "accounts0 token purchase should be 2.13e22!");
//
//     var leftoverWei = await c.getLeftoverWei.call(accounts[0]);
//     assert.equal(leftoverWei.valueOf(), 0, "accounts0 leftoverWei should be 0!");
//
//     var valuation = await c.getPersonalCap.call(accounts[0]);
//     assert.equal(valuation.valueOf(), 1e22, "accounts[0]'s personal valuation should be 1e22");
//
//     var atVal = await c.isBidderAtValuation.call(1e22,accounts[0]);
//     assert.equal(atVal,true, "accounts[0] should be listed at the 1e22 personal valuation");
//
//     var totalVal = await c.getTotalValuation.call();
//     assert.equal(totalVal.valueOf(),1e20, "The total valuation of the sale should be 1e20");
//
//     await c.withdrawBid(107, {from:accounts[0]});
//
//     leftoverWei = await c.getLeftoverWei.call(accounts[0]);
//     assert.equal(leftoverWei.valueOf(), 9.8E19, "accounts0 leftoverWei should be 1E19!");
//
//     var token_purchase = await c.getTokenPurchase.call(accounts[0]);
//     assert.equal(token_purchase.valueOf(), 4.26E20, "accounts0 token purchase should be 4.26E20!");
//
//     var valuation = await c.getpersonalCap.call(accounts[0]);
//     assert.equal(valuation.valueOf(), 0, "accounts[0]'s personal valuation should be 0");
//
//     var atVal = await c.isBidderAtValuation.call(1e22,accounts[0]);
//     assert.equal(atVal,false, "accounts[0] should not be listed at the 1e22 personal valuation");
//
//     var totalVal = await c.getTotalValuation.call();
//     assert.equal(totalVal.valueOf(),2E18, "The total valuation of the sale should be 2E18");
//
//
//   });
//
//   it("should accept bids during the sale, place them in a sorted list, and automatically remove minimal personal valuations", async () => {
//     const c = await TimeInteractiveCrowdsaleTestContract.deployed();
//
//     //await c.submitBid(1e22,0, 121, {from:accounts[0], value: 1e20});
//
//     // var token_purchase = await c.getTokenPurchase.call(accounts[0]);
//     // assert.equal(token_purchase.valueOf(), 2.13e22, "accounts0 token purchase should be 2.13e22!");
//
//     // var valuation = await c.getpersonalCap.call(accounts[0]);
//     // assert.equal(valuation.valueOf(), 1e22, "accounts[0]'s personal valuation should be 1e22");
//
//     // var atVal = await c.isBidderAtValuation.call(1e22,accounts[0]);
//     // assert.equal(atVal,true, "accounts[0] should be listed at the 1e22 personal valuation");
//
//     // var totalVal = await c.getTotalValuation.call();
//     // assert.equal(totalVal.valueOf(),1e20, "The total valuation of the sale should be 1e20");
//
//     await c.submitBid(2e22,0, 121, {from:accounts[1], value: 5e21});
//
//     // token_purchase = await c.getTokenPurchase.call(accounts[1]);
//     // assert.equal(token_purchase.valueOf(), 1.065E24, "accounts1 token purchase should be 1.065E24!");
//
//     valuation = await c.getpersonalCap.call(accounts[1]);
//     assert.equal(valuation.valueOf(), 2e22, "accounts[1]'s personal valuation should be 2e22");
//
//     atVal = await c.isBidderAtValuation.call(2e22,accounts[1]);
//     assert.equal(atVal,true, "accounts[1] should be listed at the 2e22 personal valuation");
//
//     totalVal = await c.getTotalValuation.call();
//     assert.equal(totalVal.valueOf(),5.002E21, "The total valuation of the sale should be 5.002E21");
//
//     await c.submitBid(2e22, 0, 121, {from:accounts[2], value: 6e21});
//
//     valuation = await c.getpersonalCap.call(accounts[2]);
//     assert.equal(valuation.valueOf(), 2e22, "accounts[2]'s personal valuation should be 2e22");
//
//     atVal = await c.isBidderAtValuation.call(2e22,accounts[2]);
//     assert.equal(atVal,true, "accounts[2] should be listed at the 2e22 personal valuation");
//
//     totalVal = await c.getTotalValuation.call();
//     assert.equal(totalVal.valueOf(),1.1002E22, "The total valuation of the sale should be 1.1002E22");
//
//     await c.submitBid(2.5e22,0, 121, {from:accounts[3], value: 2e21});
//
//     valuation = await c.getpersonalCap.call(accounts[3]);
//     assert.equal(valuation.valueOf(), 2.5e22, "accounts[3]'s personal valuation should be 2.5e22");
//
//     atVal = await c.isBidderAtValuation.call(2.5e22,accounts[3]);
//     assert.equal(atVal,true, "accounts[3] should be listed at the 2.5e22 personal valuation");
//
//     totalVal = await c.getTotalValuation.call();
//     assert.equal(totalVal.valueOf(),1.3002E22, "The total valuation of the sale should be 1.3002E22");
//
//     await c.submitBid(3e22,0, 121, {from:accounts[4], value: 4e21});
//
//     valuation = await c.getpersonalCap.call(accounts[4]);
//     assert.equal(valuation.valueOf(), 3e22, "accounts[4]'s personal valuation should be 3e22");
//
//     atVal = await c.isBidderAtValuation.call(3e22,accounts[4]);
//     assert.equal(atVal,true, "accounts[3] should be listed at the 3e22 personal valuation");
//
//     totalVal = await c.getTotalValuation.call();
//     assert.equal(totalVal.valueOf(),1.7002e22, "The total valuation of the sale should be 1.7002e22");
//
//   //   //await c.submitBid(27000000000000000000000,0, 122, {from:accounts[0], value: 5e21});
//
//   //   valuation = await c.getpersonalCap.call(accounts[0]);
//   //   assert.equal(valuation.valueOf(), 2.7e22, "accounts[0]'s personal valuation should be 2.7e22");
//
//   //   atVal = await c.isBidderAtValuation.call(2.7e22,accounts[0]);
//   //   assert.equal(atVal,true, "accounts[0] should be listed at the 2.7e22 personal valuation");
//
//   //   totalVal = await c.getTotalValuation.call();
//   //   assert.equal(totalVal.valueOf(),1.991E22, "The total valuation of the sale should be 1.991e22");
//
//   //   var contribution = await c.getContribution.call(accounts[1]);
//   //   assert.equal(contribution.valueOf(),4.05E21, "accounts1's contribution should have been decreased!");
//
//   //   contribution = await c.getContribution.call(accounts[2]);
//   //   assert.equal(contribution.valueOf(),4.86E21, "accounts2's contribution should have been decreased!");
//   });
// });
//
//
