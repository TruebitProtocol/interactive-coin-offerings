/* eslint-disable no-undef */ // Avoid the linter considering truffle elements as undef.
const { expectThrow, increaseTime } = require('kleros-interaction/helpers/utils')
const MintableToken = artifacts.require('zeppelin-solidity/MintableToken.sol')
const IICO = artifacts.require('IICO.sol')

contract('IICO', function (accounts) {
  let owner = accounts[0]
  let beneficiary = accounts[1]
  let buyerA = accounts[2]
  let buyerB = accounts[3]
  let buyerC = accounts[4]
  let buyerD = accounts[5]
  let buyerE = accounts[6]
  let buyerF = accounts[7]
  let gasPrice = 5E3 // almost free, so many transactions

  let timeBeforeStart = 1000
  let fullBonusLength = 5000
  let partialWithdrawalLength = 2500
  let withdrawalLockUpLength = 2500
  let maxBonus = 2E8

  let tooManyBids = 5000;

  it('Should gracefull handle situation with many participants (over the block gas limit)', async function() {

    this.timeout(6000000); // Test takes too long to load, need increase default timeout: https://stackoverflow.com/a/35398816/775359

    let startTestTime = web3.eth.getBlock('latest').timestamp
    let iico = await IICO.new(startTestTime+timeBeforeStart,fullBonusLength,partialWithdrawalLength, withdrawalLockUpLength,maxBonus,beneficiary,{from: owner})
    let head = await iico.bids(0)
    let tailID = head[1]
    let tail = await iico.bids(head[1])
    let token = await MintableToken.new({from: owner})
    await token.mint(iico.address,100E18,{from: owner}) // We will use a 100 PNK sale for the example.
    await iico.setToken(token.address,{from: owner})

    increaseTime(1000) // Full bonus period.

    var totalValueContributed = 0;
    var gasUsed = 0;

    for (var i=0; i<tooManyBids; i++) {
      var value = 1E16;
      totalValueContributed += value;
      tx = await iico.searchAndBid(i * 1E17, 0, {from: buyerA, value: value, gasPrice: gasPrice })
      gasUsed += tx.receipt.gasUsed * gasPrice;

      ///////////////// OPTIONAL LOGGING
      if (i%50 === 0) console.log(i + " " + (gasUsed / 1E18) + " " + web3.eth.getBalance(buyerA).toNumber() );
      /////////////////

      increaseTime(1);
    }    

    increaseTime(1E5) // End of sale.
    
    let beneficiaryBalanceAtTheEndOfSale = web3.eth.getBalance(beneficiary).toNumber()
    let buyerABalanceAtTheEndOfSale = web3.eth.getBalance(buyerA).toNumber()

    console.log("before first - too many - should throw");
    // Should run out of gas
    await expectThrow(iico.finalize(tooManyBids));


    console.log("after first - it did throw indeed");
    // Finalize in multiple steps
    await iico.finalize(2000); console.log("2000");
    await iico.finalize(2000); console.log("4000");
    await iico.finalize(2000); console.log("6000");

    await expectThrow(iico.finalize(2000));
    console.log("finalising too many threw too");

    let beneficiaryBalanceAfterFinalising = web3.eth.getBalance(beneficiary).toNumber()
    assert.closeTo(beneficiaryBalanceAfterFinalising, beneficiaryBalanceAtTheEndOfSale + (45 * 1E18), 0.5 * 1E18, "beneficiary didn't get the correct amount");


    for (var i=0; i<tooManyBids; i++) {
      await iico.redeem(i)
      ///////////////// OPTIONAL LOGGING
      if (i%50 === 0) console.log("Redeeming: " + i);
      /////////////////      
    }

    let buyerABalanceAfterFinalising = web3.eth.getBalance(buyerA).toNumber()
    assert.closeTo(web3.eth.getBalance(buyerA).toNumber(), buyerABalanceAtTheEndOfSale + (5 * 1E18), 0.5 * 1E18, 'The buyer A has been refunded 3.5 ETH of bids below')

    var tokensRedeemed = (await token.balanceOf(buyerA)).toNumber()
    assert.closeTo(tokensRedeemed, 100E18, 0.1 * 1E18,  'The buyer A has not been given the right amount of tokens')
    
  })
  
})