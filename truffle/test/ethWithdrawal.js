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

  it("Calculates withdraw amount correctly", async () => {
    const contrib = 1000000000000000000
    await increaseTimeTo(startTime);
    await sale.submitBid(100000000000000000000, 0, {from: accounts[1], value: contrib});

    const firstPrice = await sale.getPrice(accounts[1]);
    assert.equal(firstPrice.toNumber(), 1200000000000000000000, 'Accounts[1] should receive a 20% bonus');

    await increaseTimeTo(latestTime() + duration.days(4));
    const percentMultiplier = Math.ceil(((latestTime() - startTime)/(endWithdrawlTime - startTime)*100));

    await sale.withdrawBid({from:accounts[1]});
    const newContrib = await sale.getContribution(accounts[1]);
    assert.equal(Math.ceil((newContrib.toNumber()/contrib)*100), percentMultiplier,
                  'The new contribution is the amount committed to the sale after withdraw and this should be the same percent of the initial contribution as time left to withdraw lock.')

    const leftover = await sale.getLeftoverWei(accounts[1]);
    assert.equal(contrib - newContrib.toNumber(), leftover.toNumber(), 'LeftoverWei should equal the original contribution minus the amount committed')
  })

  it("Adjusts the purchase price after withdrawal penalty correctly", async () => {
    const contrib = 50000000000;
    await sale.submitBid(150000000000000000000, 100000000000000000000, {from: accounts[2], value: contrib});

    const firstPrice = await sale.getPrice(accounts[2]);
    assert.equal(firstPrice.toNumber(), 1090000000000000000000, 'Price paid by accounts[2] should be 9% bonus');

    await increaseTimeTo(latestTime() + duration.days(1));
    await sale.withdrawBid({from: accounts[2]})
    
    const secondPrice = await sale.getPrice(accounts[2]);
    assert.equal(secondPrice.toNumber(), 1060000000000000000000, 'Bonus should be reduced by 1/3 to 6% bonus');
  })

})
