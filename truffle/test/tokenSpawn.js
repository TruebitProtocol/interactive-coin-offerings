import {advanceBlock} from './helpers/advanceToBlock'
import {increaseTimeTo, duration} from './helpers/increaseTime'
import latestTime from './helpers/latestTime'
const { should } = require('./helpers/utils')
const CrowdsaleToken = artifacts.require("CrowdsaleToken");
const InteractiveCrowdsaleTestContract = artifacts.require("InteractiveCrowdsaleTestContract");

contract("Withdrawing ETH", (accounts) => {
  let sale, startTime, endWithdrawlTime, endTime, afterEndTime;

  before(async function () {
    startTime = latestTime() + duration.weeks(7) + duration.hours(4);
    endWithdrawlTime = startTime + duration.weeks(1)
    endTime = startTime + duration.weeks(4)
    afterEndTime = endTime + duration.seconds(1)

    var purchaseData =[startTime,1000000000000000000000,0];

    sale = await InteractiveCrowdsaleTestContract.new(accounts[0],
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

  it("submits 100 ETH", async () => {
    const contrib = 10000000000000000000
    await increaseTimeTo(startTime);
    await sale.submitBid(200000000000000000000, 0, {from: accounts[1], value: contrib});

    for(var i = 2; i < 12; i++){
      await sale.submitBid(200000000000000000000, 200000000000000000000, {from: accounts[i], value: contrib})
    }

    const committed = sale.getTotalValuation();
    console.log(committed.toNumber())
  })

})
