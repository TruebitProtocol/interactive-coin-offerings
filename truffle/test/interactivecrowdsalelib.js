import {advanceBlock} from './helpers/advanceToBlock'
import {increaseTimeTo, duration} from './helpers/increaseTime'
import latestTime from './helpers/latestTime'
const { should } = require('./helpers/utils')
const CrowdsaleToken = artifacts.require("CrowdsaleToken");
const InteractiveCrowdsaleTestContract = artifacts.require("InteractiveCrowdsaleTestContract");

// can also set sale as a global up here and carry it throughout
// var sale;
contract('InteractiveCrowdsaleTestContract', function (accounts) {


    let sale, startTime, endWithdrawlTime, endTime, afterEndTime;

    context("Intializing the contract", async () => {
        before(async function () {
            startTime = latestTime() + duration.weeks(15) + duration.hours(4);
            endWithdrawlTime = startTime + duration.weeks(100)
            endTime =  startTime + duration.years(2)
            afterEndTime = endTime + duration.seconds(1)

            var purchaseData =[startTime,1000000000000000000000,0];

            sale = await InteractiveCrowdsaleTestContract.new(accounts[5],
                                                             purchaseData,
                                                             20,
                                                             2000, // minimum in terms of wei
                                                             endWithdrawlTime,
                                                             endTime,
                                                             50,
                                                             "Jason Token",
                                                             "TBT",
                                                             18,
                                                             false);
      })

      it('has the correct owner', async () => {
        const owner = await sale.getOwner()
        owner.should.be.equal(accounts[5])
      })

      it('has the correct minimum raise', async () => {
        const raise = await sale.getMinimumRaise()
        raise.should.be.bignumber.equal(2000)
      })

      it('has the correct endWithdrawalTime', async () => {
        const gran = await sale.getEndWithdrawlTime()
        gran.should.be.bignumber.equal(endWithdrawlTime)
      })

      it('has the correct endTime', async () => {
        const gran = await sale.getEndTime()
        gran.should.be.bignumber.equal(endTime)
      })

      it('initializes with zeroed valuation', async () => {
        const valuation = await sale.getTotalValuation()
        assert.equal(valuation, 0);
      })

      it('initializes with no tokens sold', async () => {
        const sold = await sale.getTokensSold();
        assert.equal(sold, 0);
      })

      it('has the correct burn percentage', async () => {
        const percentSold = await sale.getPercentBeingSold();
        assert.equal(percentSold.toNumber(), 50);
      })

      it('has the correct active status', async () => {
        const active = await sale.crowdsaleActive();
        assert.isFalse(active, "current sale is starting with past time");
      })

    }) //context

    context("Testing bid submission", async() => {

      before(async function () {
        startTime = latestTime() + duration.weeks(15) + duration.hours(4)
        endWithdrawlTime = startTime + duration.weeks(100)
        endTime =  startTime + duration.years(2)
        afterEndTime = endTime + duration.seconds(1)

        var purchaseData =[startTime,1000000000000000000000,0];

        sale = await InteractiveCrowdsaleTestContract.new(accounts[5],
                                                         purchaseData,
                                                         20,
                                                         1000000000000000000, // minimum in terms of wei
                                                         endWithdrawlTime,
                                                         endTime,
                                                         50,
                                                         "Jason Token",
                                                         "TBT",
                                                         18,
                                                         false);
      })

      it("'Can't submit bid if sale hasn't started", async () => {
        let err = false;
        try{
            await sale.submitBid(100000000,0,{from:accounts[2],value:1000000});
          } catch(e) {
          err = true;
        }
        assert.isTrue(err, "should give an error message since sale has not started");
      });

      it('should accept a bid', async () => {
          await increaseTimeTo(startTime)
          await sale.submitBid(100000000,0,{from:accounts[0],value:1000000});
          const cont = await sale.getContribution(accounts[0])
          cont.should.be.bignumber.equal(1000000)
      })

      it("'Can't submit bid if bidder already bidded", async () => {
        let err = false;
        try{
            await sale.submitBid(200000000,0,{from:accounts[0],value:2000000});
          } catch(e) {
          err = true;
        }
        assert.isTrue(err, "should give an error message since bidder already suubmited");
      });

    })
});
