import {advanceBlock} from './helpers/advanceToBlock'
import {increaseTimeTo, duration} from './helpers/increaseTime'
import latestTime from './helpers/latestTime'
const { should } = require('./helpers/utils')
const CrowdsaleToken = artifacts.require("CrowdsaleToken");
const InteractiveCrowdsaleTestContract = artifacts.require("InteractiveCrowdsaleTestContract");

contract("Launching the token", (accounts) => {
  let sale, startTime, endWithdrawlTime, endTime, afterEndTime, token;

  before(async function () {
    startTime = latestTime() + duration.years(3);
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

    for(var i = 2; i < 11; i++){
      await sale.submitBid(200000000000000000000, 200000000000000000000, {from: accounts[i], value: contrib})
    }

    const committed = await sale.getTotalValuation();
    assert.equal(committed.toNumber(), 100000000000000000000, 'Sale value should be 100 ETH')
  })

  it("Should not have a token yet", async () => {
    const tokenAddress = await sale.getTokenAddress();
    assert.equal(tokenAddress, '0x0000000000000000000000000000000000000000', 'Token should have address 0 before finalizing the sale.')
  })

  it("Launches the new token when finalized", async () => {
    await increaseTimeTo(afterEndTime);
    await sale.finalizeSale();

    const tokenAddress = await sale.getTokenAddress();
    token = CrowdsaleToken.at(tokenAddress);
    const tokenName = await token.name();
    assert.equal(tokenName, "Jason Token", 'Tokens should be created after the sale is finalized');
  })

  it("Launches the correct amount of tokens", async () => {
    // 100 ETH sale value divided by 50% of total tokens sold + bonus tokens
    const calculatedTokens = '220000000000000000000000';

    const initSupply = await token.initialSupply();
    assert.equal(initSupply.toNumber(), calculatedTokens, 'The appropriate number of tokens should be created')
  })

  it("Gives the correct amount of tokens to the owner", async () => {
    const calcOwnerBalance = '100000000000000000000000';
    const ownerBalance = await token.balanceOf(accounts[0]);
    assert.equal(ownerBalance.toNumber(), calcOwnerBalance, 'The owner should be sent the appropriate number of tokens')
  })

  it("Gives the correct amount of tokens to the contract", async () => {
    const calcContractBalance = '120000000000000000000000';
    const contractBalance = await token.balanceOf(sale.address);
    assert.equal(contractBalance.toNumber(), calcContractBalance, 'The contract should have the appropriate number of tokens');
  })

})
