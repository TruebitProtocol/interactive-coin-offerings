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
  let gasPrice = 5E9

  
  let timeBeforeStart = 1000
  let fullBonusLength = 5000
  let partialWithdrawalLength = 2500
  let withdrawalLockUpLength = 2500
  let maxBonus = 2E8
  let noCap = 120000000E18 // for placing bids with no cap
  testAccount = buyerE
  
  
  // Constructor
  it('Should create the contract with the initial values', async () => {
    let startTestTime = web3.eth.getBlock('latest').timestamp
    let iico = await IICO.new(startTestTime+timeBeforeStart,fullBonusLength,partialWithdrawalLength, withdrawalLockUpLength,maxBonus,beneficiary,{from: owner})
    let head = await iico.bids(0)
    let tailID = head[1]
    let tail = await iico.bids(tailID)
    
    
    assert.equal(await iico.owner(), owner, 'The owner is not set correctly')
    assert.equal(await iico.beneficiary(), beneficiary, 'The beneficiary is not set correctly')
    assert.equal(await iico.lastBidID(), 0, 'The lastBidID is not set correctly')
    assert.equal(await iico.startTime(), startTestTime+1000, 'The startTime is not set correctly')
    assert.equal(await iico.endFullBonusTime(), startTestTime+6000, 'The endFullBonusTime is not set correctly')
    assert.equal(await iico.withdrawalLockTime(), startTestTime+8500, 'The endFullBonusTime is not set correctly')
    assert.equal(await iico.endTime(), startTestTime+11000, 'The endFullBonusTime is not set correctly')
    assert.equal(await iico.maxBonus(), 2E8, 'The maxBonus is not set correctly')
    assert.equal(await iico.finalized(), false, 'The finalized is not set correctly')
    assert.equal((await iico.cutOffBidID()).toNumber(), head[1].toNumber(), 'The cutOffBidID is not set correctly')
    assert.equal(await iico.sumAcceptedContrib(), 0, 'The sumAcceptedContrib is not set correctly')
    assert.equal(await iico.sumAcceptedVirtualContrib(), 0, 'The sumAcceptedVirtualContrib is not set correctly')
  })

  // setToken
  it('Should set the token', async () => {
    let startTestTime = web3.eth.getBlock('latest').timestamp
    let iico = await IICO.new(startTestTime+timeBeforeStart,fullBonusLength,partialWithdrawalLength, withdrawalLockUpLength,maxBonus,beneficiary,{from: owner})
    let token = await MintableToken.new({from: owner})
    await token.mint(iico.address,160E24,{from: owner})
    await expectThrow(iico.setToken(token.address,{from: buyerA})) // Only owner can set.
    await iico.setToken(token.address,{from: owner})

    assert.equal(await iico.token(), token.address, 'The token is not set correctly')
    assert.equal(await iico.tokensForSale(), 160E24, 'The tokensForSale is not set correctly')
  })

  // submitBid
  it('Should submit only valid bids', async () => {
    let startTestTime = web3.eth.getBlock('latest').timestamp
    let iico = await IICO.new(startTestTime+timeBeforeStart,fullBonusLength,partialWithdrawalLength, withdrawalLockUpLength,maxBonus,beneficiary,{from: owner})
    let head = await iico.bids(0)
    let tailID = head[1]
    let tail = await iico.bids(tailID)
    let token = await MintableToken.new({from: owner})
    await token.mint(iico.address,160E24,{from: owner})
    await iico.setToken(token.address,{from: owner})

    await expectThrow(iico.submitBid(1E18, head[1],{from: buyerA, value:0.1E18})) // Should not work before the sale hasn't start yet.
    increaseTime(1010) // Full bonus period.
    await iico.submitBid(1E18, head[1],{from: buyerA, value:0.1E18}) // Bid 1.
    await expectThrow(iico.submitBid(0.5E18, head[1],{from: buyerB, value:0.1E18})) // Should not work because not inserted in the right position.
    await expectThrow(iico.submitBid(0.5E18, 0,{from: buyerB, value:0.1E18}))
    await iico.submitBid(0.5E18, 1,{from: buyerB, value:0.1E18}) // Bid 2.
    
    increaseTime(5000) // Partial bonus period.
    await iico.submitBid(0.8E18, 1,{from: buyerC, value:0.15E18}) // Bid 3.
    increaseTime(2500) // Withdrawal lock period.
    await iico.submitBid(0.7E18, 3,{from: buyerD, value:0.15E18}) // Bid 4.
    increaseTime(2500) // End of sale period.
    await expectThrow(iico.submitBid(0.9E18, 1,{from: buyerE, value:0.15E18}))
  })
  
  
  
  // searchAndBid
  it('Should submit even if not the right position', async () => {
    let startTestTime = web3.eth.getBlock('latest').timestamp
    let iico = await IICO.new(startTestTime+timeBeforeStart,fullBonusLength,partialWithdrawalLength, withdrawalLockUpLength,maxBonus,beneficiary,{from: owner})
    let head = await iico.bids(0)
    let tailID = head[1]
    let tail = await iico.bids(tailID)
    let token = await MintableToken.new({from: owner})
    await token.mint(iico.address,160E24,{from: owner})
    await iico.setToken(token.address,{from: owner})

    increaseTime(1010) // Full bonus period.
    await iico.searchAndBid(1E18, 0,{from: buyerA, value:0.1E18}) // Bid 1.
    await iico.searchAndBid(0.5E18, 1,{from: buyerB, value:0.1E18}) // Bid 2.
    increaseTime(5000) // Partial bonus period.
    await iico.searchAndBid(0.8E18, 2,{from: buyerC, value:0.15E18}) // Bid 3.
    increaseTime(2500) // Withdrawal lock period.
    await iico.searchAndBid(0.7E18, 0,{from: buyerD, value:0.15E18}) // Bid 4.
    await iico.searchAndBid(0.5E18, tailID,{from: buyerE, value:0.1E18}) // Bid 5.
  })  
  
  // withdraw
  it('Should withdraw the proper amount', async () => {
    let startTestTime = web3.eth.getBlock('latest').timestamp
    let iico = await IICO.new(startTestTime+timeBeforeStart,fullBonusLength,partialWithdrawalLength, withdrawalLockUpLength,maxBonus,beneficiary,{from: owner})
    let head = await iico.bids(0)
    let tailID = head[1]
    let tail = await iico.bids(head[1])
    let token = await MintableToken.new({from: owner})
    await token.mint(iico.address,160E24,{from: owner})
    await iico.setToken(token.address,{from: owner})

    increaseTime(1010) // Full bonus period.
    await iico.searchAndBid(1E18, 0,{from: buyerA, value:0.1E18}) // Bid 1.
    let buyerABalanceBeforeReimbursment = web3.eth.getBalance(buyerA)
    await expectThrow(iico.withdraw(1,{from: buyerB})) // Only the contributor can withdraw.
    let tx = await iico.withdraw(1,{from: buyerA, gasPrice: gasPrice})
    let txFee = tx.receipt.gasUsed * gasPrice
    let buyerABalanceAfterReimbursment = web3.eth.getBalance(buyerA)
    assert.equal(buyerABalanceBeforeReimbursment.plus(0.1E18).minus(txFee).toNumber(), buyerABalanceAfterReimbursment.toNumber(), 'The buyer has not been reimbursed completely')
    await expectThrow(iico.withdraw(1,{from: buyerA, gasPrice: gasPrice}))
    
    await iico.searchAndBid(0.8E18, 2,{from: buyerB, value:0.1E18}) // Bid 2.
    increaseTime(5490) // Partial bonus period. Around 20% locked.
    let buyerBBalanceBeforeReimbursment = web3.eth.getBalance(buyerB)
    tx = await iico.withdraw(2,{from: buyerB, gasPrice: gasPrice})
    txFee = tx.receipt.gasUsed * gasPrice
    let buyerBBalanceAfterReimbursment = web3.eth.getBalance(buyerB)
    assert(buyerBBalanceAfterReimbursment.minus(buyerBBalanceBeforeReimbursment.minus(txFee).toNumber()).toNumber()-4*0.1E18/5 <= (4*0.1E18/5)/100, 'The buyer has not been reimbursed correctly') // Allow up to 1% error due to time taken outside of increaseTime.
    await expectThrow(iico.withdraw(2,{from: buyerB, gasPrice: gasPrice})) // You should not be able to withdraw twice.
    
    await iico.searchAndBid(0.5E18, 2,{from: buyerC, value:0.15E18}) // Bid 3.
    increaseTime(2500)
    await expectThrow(iico.withdraw(3,{from: buyerC})) // Not possible to withdraw after the withdrawal lock.
  })
  
  // finalized
  it('Should finalize in one shot', async () => {
    let startTestTime = web3.eth.getBlock('latest').timestamp
    let iico = await IICO.new(startTestTime+timeBeforeStart,fullBonusLength,partialWithdrawalLength, withdrawalLockUpLength,maxBonus,beneficiary,{from: owner})
    let head = await iico.bids(0)
    let tailID = head[1]
    let tail = await iico.bids(head[1])
    let token = await MintableToken.new({from: owner})
    await token.mint(iico.address,160E24,{from: owner})
    await iico.setToken(token.address,{from: owner})

    increaseTime(1010) // Full bonus period.
    await iico.searchAndBid(1E18, 0,{from: buyerA, value:0.1E18}) // Bid 1.
    await iico.searchAndBid(0.5E18, 1,{from: buyerB, value:0.1E18}) // Bid 2.
    increaseTime(5000) // Partial bonus period.
    await iico.searchAndBid(0.8E18, 2,{from: buyerC, value:0.15E18}) // Bid 3.
    increaseTime(2500) // Withdrawal lock period.
    await iico.searchAndBid(0.7E18, 0,{from: buyerD, value:0.15E18}) // Bid 4.
    await iico.searchAndBid(0.5E18, tailID,{from: buyerE, value:0.1E18}) // Bid 5.
    await expectThrow(iico.finalize(1000000000000)) // Should not be able to finalize before the end of the sale.
    increaseTime(2500) // End of sale.
    await iico.finalize(1000000000000)
    assert.equal(await iico.finalized(), true, 'The one shot finalization did not work as expected')
  })
  
  
  it('Should finalize in multiple shots', async () => {
    let startTestTime = web3.eth.getBlock('latest').timestamp
    let iico = await IICO.new(startTestTime+timeBeforeStart,fullBonusLength,partialWithdrawalLength, withdrawalLockUpLength,maxBonus,beneficiary,{from: owner})
    let head = await iico.bids(0)
    let tailID = head[1]
    let tail = await iico.bids(head[1])
    let token = await MintableToken.new({from: owner})
    await token.mint(iico.address,160E24,{from: owner})
    await iico.setToken(token.address,{from: owner})
    
    
    increaseTime(1010) // Full bonus period.
    await iico.searchAndBid(1E18, 0,{from: buyerA, value:0.1E18}) // Bid 1.
    await iico.searchAndBid(0.5E18, 1,{from: buyerB, value:0.1E18}) // Bid 2.
    increaseTime(5000) // Partial bonus period.
    await iico.searchAndBid(0.8E18, 2,{from: buyerC, value:0.4E18}) // Bid 3.
    increaseTime(2500) // Withdrawal lock period.
    await iico.searchAndBid(0.7E18, 0,{from: buyerD, value:0.2E18}) // Bid 4.
    await iico.searchAndBid(0.5E18, tailID,{from: buyerE, value:0.1E18}) // Bid 5.
    increaseTime(2500) // End of sale.
    await iico.finalize(2)
    assert.equal(await iico.finalized(), false, 'The multiple shots finalization finalized while it should have taken longer')
    await iico.finalize(2)
    assert.equal(await iico.finalized(), true, 'The multiple shots finalization did not work as expected')
  })
  

  it('Should give back tokens to accepted bids and refund others. Full last bid', async () => {
    let startTestTime = web3.eth.getBlock('latest').timestamp
    let iico = await IICO.new(startTestTime+timeBeforeStart,fullBonusLength,partialWithdrawalLength, withdrawalLockUpLength,maxBonus,beneficiary,{from: owner})
    let head = await iico.bids(0)
    let tailID = head[1]
    let tail = await iico.bids(head[1])
    let token = await MintableToken.new({from: owner})
    await token.mint(iico.address,70E24,{from: owner})
    await iico.setToken(token.address,{from: owner})
    
    
    increaseTime(1100) // Full bonus period.
    await iico.searchAndBid(1E18, 0,{from: buyerA, value:0.1E18}) // Bid 1.
    await iico.searchAndBid(0.6E18, 1,{from: buyerB, value:0.1E18}) // Bid 2.
    await iico.searchAndBid(0.8E18, 2,{from: buyerC, value:0.4E18}) // Bid 3.
    await iico.searchAndBid(0.7E18, 0,{from: buyerD, value:0.2E18}) // Bid 4.
    await iico.searchAndBid(0.5E18, tailID,{from: buyerE, value:0.15E18}) // Bid 5.
    await iico.searchAndBid(0.5E18, tailID,{from: buyerF, value:0.3E18}) // Bid 6.
    increaseTime(1E4) // End of sale.
    
    let buyerABalanceAtTheEndOfSale = web3.eth.getBalance(buyerA).toNumber()
    let buyerBBalanceAtTheEndOfSale = web3.eth.getBalance(buyerB).toNumber()
    let buyerCBalanceAtTheEndOfSale = web3.eth.getBalance(buyerC).toNumber()
    let buyerDBalanceAtTheEndOfSale = web3.eth.getBalance(buyerD).toNumber()
    let buyerEBalanceAtTheEndOfSale = web3.eth.getBalance(buyerE).toNumber()
    let buyerFBalanceAtTheEndOfSale = web3.eth.getBalance(buyerF).toNumber()
    let beneficiaryBalanceAtTheEndOfSale = web3.eth.getBalance(beneficiary).toNumber()
    
    await iico.finalize(1000)
    
    // Redeem and verify we can't redeem more than once.
    await iico.redeem(1)
    await expectThrow(iico.redeem(1))
    await iico.redeem(2)
    await expectThrow(iico.redeem(2))
    await iico.redeem(3)
    await expectThrow(iico.redeem(3))
    await iico.redeem(4)
    await expectThrow(iico.redeem(4))
    await iico.redeem(5)
    await expectThrow(iico.redeem(5))
    await iico.redeem(6)
    await expectThrow(iico.redeem(6))
    
    // Verify the proper amounts of ETH are refunded.
    assert.equal(web3.eth.getBalance(buyerA).toNumber(), buyerABalanceAtTheEndOfSale, 'The buyer A has been given ETH back while the full bid should have been accepted')
    assert.equal(web3.eth.getBalance(buyerB).toNumber(), buyerBBalanceAtTheEndOfSale+0.1E18, 'The buyer B has not been reimbursed as it should')
    assert.equal(web3.eth.getBalance(buyerC).toNumber(), buyerCBalanceAtTheEndOfSale, 'The buyer C has been given ETH back while the full bid should have been accepted')
    assert.equal(web3.eth.getBalance(buyerD).toNumber(), buyerDBalanceAtTheEndOfSale, 'The buyer D has been given ETH back while the full bid should have been accepted')
    assert.equal(web3.eth.getBalance(buyerE).toNumber(), buyerEBalanceAtTheEndOfSale+0.15E18, 'The buyer E has not been reimbursed as it should')
    assert.equal(web3.eth.getBalance(buyerF).toNumber(), buyerFBalanceAtTheEndOfSale+0.3E18, 'The buyer F has not been reimbursed as it should')
    
    assert.equal(web3.eth.getBalance(beneficiary).toNumber(), beneficiaryBalanceAtTheEndOfSale+0.7E18, 'The beneficiary has not been paid correctly')
    
    // Verify that the tokens are correctly distributed.
    assert.equal((await token.balanceOf(buyerA)).toNumber(), 10E24, 'The buyer A has not been given the right amount of tokens')
    assert.equal((await token.balanceOf(buyerB)).toNumber(), 0, 'The buyer B got some tokens despite having its bid refunded')
    assert.equal((await token.balanceOf(buyerC)).toNumber(), 40E24, 'The buyer C has not been given the right amount of tokens')
    assert.equal((await token.balanceOf(buyerD)).toNumber(), 20E24, 'The buyer D has not been given the right amount of tokens')
    assert.equal((await token.balanceOf(buyerE)).toNumber(), 0, 'The buyer E got some tokens despite having its bid refunded')
    assert.equal((await token.balanceOf(buyerF)).toNumber(), 0, 'The buyer F got some tokens despite having its bid refunded')
  })

  it('Should give back tokens to accepted bids and refund others. Non full last bid', async () => {
    let startTestTime = web3.eth.getBlock('latest').timestamp
    let iico = await IICO.new(startTestTime+timeBeforeStart,fullBonusLength,partialWithdrawalLength, withdrawalLockUpLength,maxBonus,beneficiary,{from: owner})
    let head = await iico.bids(0)
    let tailID = head[1]
    let tail = await iico.bids(head[1])
    let token = await MintableToken.new({from: owner})
    await token.mint(iico.address,70E24,{from: owner})
    await iico.setToken(token.address,{from: owner})
    
    
    increaseTime(1100) // Full bonus period.
    await iico.searchAndBid(1E18, 0,{from: buyerA, value:0.1E18}) // Bid 1.
    await iico.searchAndBid(0.6E18, 1,{from: buyerB, value:0.1E18}) // Bid 2.
    await iico.searchAndBid(0.8E18, 2,{from: buyerC, value:0.4E18}) // Bid 3.
    await iico.searchAndBid(0.75E18, 0,{from: buyerD, value:0.2E18}) // Bid 4.
    await iico.searchAndBid(0.5E18, tailID,{from: buyerE, value:0.15E18}) // Bid 5.
    await iico.searchAndBid(0.5E18, tailID,{from: buyerF, value:0.3E18}) // Bid 6.
    increaseTime(1E4) // End of sale.
    
    let buyerABalanceAtTheEndOfSale = web3.eth.getBalance(buyerA).toNumber()
    let buyerBBalanceAtTheEndOfSale = web3.eth.getBalance(buyerB).toNumber()
    let buyerCBalanceAtTheEndOfSale = web3.eth.getBalance(buyerC).toNumber()
    let buyerDBalanceAtTheEndOfSale = web3.eth.getBalance(buyerD).toNumber()
    let buyerEBalanceAtTheEndOfSale = web3.eth.getBalance(buyerE).toNumber()
    let buyerFBalanceAtTheEndOfSale = web3.eth.getBalance(buyerF).toNumber()
    let beneficiaryBalanceAtTheEndOfSale = web3.eth.getBalance(beneficiary).toNumber()
    
    await iico.finalize(1000)
    
    // Redeem and verify we can't redeem more than once.
    await iico.redeem(1)
    await expectThrow(iico.redeem(1))
    await iico.redeem(2)
    await expectThrow(iico.redeem(2))
    await iico.redeem(3)
    await expectThrow(iico.redeem(3))
    await iico.redeem(4)
    await expectThrow(iico.redeem(4))
    await iico.redeem(5)
    await expectThrow(iico.redeem(5))
    await iico.redeem(6)
    await expectThrow(iico.redeem(6))
    
    // Verify the proper amounts of ETH are refunded.
    assert.equal(web3.eth.getBalance(buyerA).toNumber(), buyerABalanceAtTheEndOfSale, 'The buyer A has been given ETH back while the full bid should have been accepted')
    assert.equal(web3.eth.getBalance(buyerB).toNumber(), buyerBBalanceAtTheEndOfSale+0.1E18, 'The buyer B has not been reimbursed as it should')
    assert.equal(web3.eth.getBalance(buyerC).toNumber(), buyerCBalanceAtTheEndOfSale, 'The buyer C has been given ETH back while the full bid should have been accepted')
    assert.equal(web3.eth.getBalance(buyerD).toNumber(), buyerDBalanceAtTheEndOfSale, 'The buyer D has been given ETH back while the full bid should have been accepted')
    assert.equal(web3.eth.getBalance(buyerE).toNumber(), buyerEBalanceAtTheEndOfSale+0.15E18, 'The buyer E has not been reimbursed as it should')
    assert.equal(web3.eth.getBalance(buyerF).toNumber(), buyerFBalanceAtTheEndOfSale+0.3E18, 'The buyer F has not been reimbursed as it should')
    
    assert.equal(web3.eth.getBalance(beneficiary).toNumber(), beneficiaryBalanceAtTheEndOfSale+0.7E18, 'The beneficiary has not been paid correctly')
    
    // Verify that the tokens are correctly distributed.
    assert.equal((await token.balanceOf(buyerA)).toNumber(), 10E24, 'The buyer A has not been given the right amount of tokens')
    assert.equal((await token.balanceOf(buyerB)).toNumber(), 0, 'The buyer B got some tokens despite having its bid refunded')
    assert.equal((await token.balanceOf(buyerC)).toNumber(), 40E24, 'The buyer C has not been given the right amount of tokens')
    assert.equal((await token.balanceOf(buyerD)).toNumber(), 20E24, 'The buyer D has not been given the right amount of tokens')
    assert.equal((await token.balanceOf(buyerE)).toNumber(), 0, 'The buyer E got some tokens despite having its bid refunded')
    assert.equal((await token.balanceOf(buyerF)).toNumber(), 0, 'The buyer F got some tokens despite having its bid refunded')
  })

  it('Should give back tokens to accepted bids and refund others. Partially accepted last bid', async () => {
    let startTestTime = web3.eth.getBlock('latest').timestamp
    let iico = await IICO.new(startTestTime+timeBeforeStart,fullBonusLength,partialWithdrawalLength, withdrawalLockUpLength,maxBonus,beneficiary,{from: owner})
    let head = await iico.bids(0)
    let tailID = head[1]
    let tail = await iico.bids(head[1])
    let token = await MintableToken.new({from: owner})
    await token.mint(iico.address,65E24,{from: owner})
    await iico.setToken(token.address,{from: owner})
    
    
    increaseTime(1100) // Full bonus period.
    await iico.searchAndBid(1E18, 0,{from: buyerA, value:0.1E18}) // Bid 1.
    await iico.searchAndBid(0.6E18, 1,{from: buyerB, value:0.1E18}) // Bid 2.
    await iico.searchAndBid(0.8E18, 2,{from: buyerC, value:0.4E18}) // Bid 3.
    await iico.searchAndBid(0.65E18, 0,{from: buyerD, value:0.2E18}) // Bid 4.
    await iico.searchAndBid(0.5E18, tailID,{from: buyerE, value:0.15E18}) // Bid 5.
    await iico.searchAndBid(0.5E18, tailID,{from: buyerF, value:0.3E18}) // Bid 6.
    increaseTime(1E4) // End of sale.
    
    let buyerABalanceAtTheEndOfSale = web3.eth.getBalance(buyerA).toNumber()
    let buyerBBalanceAtTheEndOfSale = web3.eth.getBalance(buyerB).toNumber()
    let buyerCBalanceAtTheEndOfSale = web3.eth.getBalance(buyerC).toNumber()
    let buyerDBalanceAtTheEndOfSale = web3.eth.getBalance(buyerD).toNumber()
    let buyerEBalanceAtTheEndOfSale = web3.eth.getBalance(buyerE).toNumber()
    let buyerFBalanceAtTheEndOfSale = web3.eth.getBalance(buyerF).toNumber()
    let beneficiaryBalanceAtTheEndOfSale = web3.eth.getBalance(beneficiary).toNumber()
    
    await iico.finalize(1000)
    
    // Redeem and verify we can't redeem more than once.
    await iico.redeem(1)
    await expectThrow(iico.redeem(1))
    await iico.redeem(2)
    await expectThrow(iico.redeem(2))
    await iico.redeem(3)
    await expectThrow(iico.redeem(3))
    await iico.redeem(4)
    await expectThrow(iico.redeem(4))
    await iico.redeem(5)
    await expectThrow(iico.redeem(5))
    await iico.redeem(6)
    await expectThrow(iico.redeem(6))
    
    // Verify the proper amounts of ETH are refunded.
    assert.equal(web3.eth.getBalance(buyerA).toNumber(), buyerABalanceAtTheEndOfSale, 'The buyer A has been given ETH back while the full bid should have been accepted')
    assert.equal(web3.eth.getBalance(buyerB).toNumber(), buyerBBalanceAtTheEndOfSale+0.1E18, 'The buyer B has not been reimbursed as it should')
    assert.equal(web3.eth.getBalance(buyerC).toNumber(), buyerCBalanceAtTheEndOfSale, 'The buyer C has been given ETH back while the full bid should have been accepted')
    assert.equal(web3.eth.getBalance(buyerD).toNumber(), buyerDBalanceAtTheEndOfSale+0.05E18, 'The buyer D, whose bid was partially accepted, has not been refunded the correct amount')
    assert.equal(web3.eth.getBalance(buyerE).toNumber(), buyerEBalanceAtTheEndOfSale+0.15E18, 'The buyer E has not been reimbursed as it should')
    assert.equal(web3.eth.getBalance(buyerF).toNumber(), buyerFBalanceAtTheEndOfSale+0.3E18, 'The buyer F has not been reimbursed as it should')
    
    assert.equal(web3.eth.getBalance(beneficiary).toNumber(), beneficiaryBalanceAtTheEndOfSale+0.65E18, 'The beneficiary has not been paid correctly')
    
    // Verify that the tokens are correctly distributed.
    assert.equal((await token.balanceOf(buyerA)).toNumber(), 10E24, 'The buyer A has not been given the right amount of tokens')
    assert.equal((await token.balanceOf(buyerB)).toNumber(), 0, 'The buyer B got some tokens despite having its bid refunded')
    assert.equal((await token.balanceOf(buyerC)).toNumber(), 40E24, 'The buyer C has not been given the right amount of tokens')
    assert.equal((await token.balanceOf(buyerD)).toNumber(), 15E24, 'The buyer D has not been given the right amount of tokens')
    assert.equal((await token.balanceOf(buyerE)).toNumber(), 0, 'The buyer E got some tokens despite having its bid refunded')
    assert.equal((await token.balanceOf(buyerF)).toNumber(), 0, 'The buyer F got some tokens despite having its bid refunded')
  })
  
  
  it('Should give back tokens to accepted bids and refund others. Full withdrawn bid, full last bid', async () => {
    let startTestTime = web3.eth.getBlock('latest').timestamp
    let iico = await IICO.new(startTestTime+timeBeforeStart,fullBonusLength,partialWithdrawalLength, withdrawalLockUpLength,maxBonus,beneficiary,{from: owner})
    let head = await iico.bids(0)
    let tailID = head[1]
    let tail = await iico.bids(head[1])
    let token = await MintableToken.new({from: owner})
    await token.mint(iico.address,60E24,{from: owner})
    await iico.setToken(token.address,{from: owner})
    
    
    increaseTime(1100) // Full bonus period.
    await iico.searchAndBid(1E18, 0,{from: buyerA, value:0.3E18}) // Bid 1.
    await iico.searchAndBid(0.6E18, 1,{from: buyerB, value:0.1E18}) // Bid 2.
    await iico.searchAndBid(0.8E18, 2,{from: buyerC, value:0.4E18}) // Bid 3.
    await iico.searchAndBid(0.7E18, 0,{from: buyerD, value:0.2E18}) // Bid 4.
    await iico.searchAndBid(0.5E18, tailID,{from: buyerE, value:0.15E18}) // Bid 5.
    await iico.searchAndBid(0.5E18, tailID,{from: buyerF, value:0.3E18}) // Bid 6.
    await iico.withdraw(3,{from: buyerC})
    
    increaseTime(1E4) // End of sale.
    
    let buyerABalanceAtTheEndOfSale = web3.eth.getBalance(buyerA).toNumber()
    let buyerBBalanceAtTheEndOfSale = web3.eth.getBalance(buyerB).toNumber()
    let buyerCBalanceAtTheEndOfSale = web3.eth.getBalance(buyerC).toNumber()
    let buyerDBalanceAtTheEndOfSale = web3.eth.getBalance(buyerD).toNumber()
    let buyerEBalanceAtTheEndOfSale = web3.eth.getBalance(buyerE).toNumber()
    let buyerFBalanceAtTheEndOfSale = web3.eth.getBalance(buyerF).toNumber()
    let beneficiaryBalanceAtTheEndOfSale = web3.eth.getBalance(beneficiary).toNumber()
    
    await iico.finalize(1000)
    
    // Redeem and verify we can't redeem more than once.
    await iico.redeem(1)
    await expectThrow(iico.redeem(1))
    await iico.redeem(2)
    await expectThrow(iico.redeem(2))
    await iico.redeem(3)
    await expectThrow(iico.redeem(3))
    await iico.redeem(4)
    await expectThrow(iico.redeem(4))
    await iico.redeem(5)
    await expectThrow(iico.redeem(5))
    await iico.redeem(6)
    await expectThrow(iico.redeem(6))
    
    // Verify the proper amounts of ETH are refunded.
    assert.equal(web3.eth.getBalance(buyerA).toNumber(), buyerABalanceAtTheEndOfSale, 'The buyer A has been given ETH back while the full bid should have been accepted')
    assert.equal(web3.eth.getBalance(buyerB).toNumber(), buyerBBalanceAtTheEndOfSale, 'The buyer B has been given ETH back while the full bid should have been accepted')
    assert.equal(web3.eth.getBalance(buyerC).toNumber(), buyerCBalanceAtTheEndOfSale, 'The buyer C has withdrawn completely but still got refund after finalization')
    assert.equal(web3.eth.getBalance(buyerD).toNumber(), buyerDBalanceAtTheEndOfSale, 'The buyer D has been given ETH back while the full bid should have been accepted')
    assert.equal(web3.eth.getBalance(buyerE).toNumber(), buyerEBalanceAtTheEndOfSale+0.15E18, 'The buyer E has not been reimbursed as it should')
    assert.equal(web3.eth.getBalance(buyerF).toNumber(), buyerFBalanceAtTheEndOfSale+0.3E18, 'The buyer F has not been reimbursed as it should')
    
    assert.equal(web3.eth.getBalance(beneficiary).toNumber(), beneficiaryBalanceAtTheEndOfSale+0.6E18, 'The beneficiary has not been paid correctly')
    
    // Verify that the tokens are correctly distributed.
    assert.equal((await token.balanceOf(buyerA)).toNumber(), 30E24, 'The buyer A has not been given the right amount of tokens')
    assert.equal((await token.balanceOf(buyerB)).toNumber(), 10E24, 'The buyer B got some tokens despite having its bid refunded')
    assert.equal((await token.balanceOf(buyerC)).toNumber(), 0, 'The buyer C has withdrawn completely but still got tokens')
    assert.equal((await token.balanceOf(buyerD)).toNumber(), 20E24, 'The buyer D has not been given the right amount of tokens')
    assert.equal((await token.balanceOf(buyerE)).toNumber(), 0, 'The buyer E got some tokens despite having its bid refunded')
    assert.equal((await token.balanceOf(buyerF)).toNumber(), 0, 'The buyer F got some tokens despite having its bid refunded')
  })
  
  it('Should give back tokens to accepted bids and refund others. Full withdrawn bid, non full last bid', async () => {
    let startTestTime = web3.eth.getBlock('latest').timestamp
    let iico = await IICO.new(startTestTime+timeBeforeStart,fullBonusLength,partialWithdrawalLength, withdrawalLockUpLength,maxBonus,beneficiary,{from: owner})
    let head = await iico.bids(0)
    let tailID = head[1]
    let tail = await iico.bids(head[1])
    let token = await MintableToken.new({from: owner})
    await token.mint(iico.address,60E24,{from: owner})
    await iico.setToken(token.address,{from: owner})
    
    
    increaseTime(1100) // Full bonus period.
    await iico.searchAndBid(1E18, 0,{from: buyerA, value:0.3E18}) // Bid 1.
    await iico.searchAndBid(0.65E18, 1,{from: buyerB, value:0.1E18}) // Bid 2.
    await iico.searchAndBid(0.8E18, 2,{from: buyerC, value:0.4E18}) // Bid 3.
    await iico.searchAndBid(0.7E18, 0,{from: buyerD, value:0.2E18}) // Bid 4.
    await iico.searchAndBid(0.5E18, tailID,{from: buyerE, value:0.15E18}) // Bid 5.
    await iico.searchAndBid(0.5E18, tailID,{from: buyerF, value:0.3E18}) // Bid 6.
    await iico.withdraw(3,{from: buyerC})
    
    increaseTime(1E4) // End of sale.
    
    let buyerABalanceAtTheEndOfSale = web3.eth.getBalance(buyerA).toNumber()
    let buyerBBalanceAtTheEndOfSale = web3.eth.getBalance(buyerB).toNumber()
    let buyerCBalanceAtTheEndOfSale = web3.eth.getBalance(buyerC).toNumber()
    let buyerDBalanceAtTheEndOfSale = web3.eth.getBalance(buyerD).toNumber()
    let buyerEBalanceAtTheEndOfSale = web3.eth.getBalance(buyerE).toNumber()
    let buyerFBalanceAtTheEndOfSale = web3.eth.getBalance(buyerF).toNumber()
    let beneficiaryBalanceAtTheEndOfSale = web3.eth.getBalance(beneficiary).toNumber()
    
    await iico.finalize(1000)
    
    // Redeem and verify we can't redeem more than once.
    await iico.redeem(1)
    await expectThrow(iico.redeem(1))
    await iico.redeem(2)
    await expectThrow(iico.redeem(2))
    await iico.redeem(3)
    await expectThrow(iico.redeem(3))
    await iico.redeem(4)
    await expectThrow(iico.redeem(4))
    await iico.redeem(5)
    await expectThrow(iico.redeem(5))
    await iico.redeem(6)
    await expectThrow(iico.redeem(6))
    
    // Verify the proper amounts of ETH are refunded.
    assert.equal(web3.eth.getBalance(buyerA).toNumber(), buyerABalanceAtTheEndOfSale, 'The buyer A has been given ETH back while the full bid should have been accepted')
    assert.equal(web3.eth.getBalance(buyerB).toNumber(), buyerBBalanceAtTheEndOfSale, 'The buyer B has been given ETH back while the full bid should have been accepted')
    assert.equal(web3.eth.getBalance(buyerC).toNumber(), buyerCBalanceAtTheEndOfSale, 'The buyer C has withdrawn completely but still got refund after finalization')
    assert.equal(web3.eth.getBalance(buyerD).toNumber(), buyerDBalanceAtTheEndOfSale, 'The buyer D has been given ETH back while the full bid should have been accepted')
    assert.equal(web3.eth.getBalance(buyerE).toNumber(), buyerEBalanceAtTheEndOfSale+0.15E18, 'The buyer E has not been reimbursed as it should')
    assert.equal(web3.eth.getBalance(buyerF).toNumber(), buyerFBalanceAtTheEndOfSale+0.3E18, 'The buyer F has not been reimbursed as it should')
    
    assert.equal(web3.eth.getBalance(beneficiary).toNumber(), beneficiaryBalanceAtTheEndOfSale+0.6E18, 'The beneficiary has not been paid correctly')
    
    // Verify that the tokens are correctly distributed.
    assert.equal((await token.balanceOf(buyerA)).toNumber(), 30E24, 'The buyer A has not been given the right amount of tokens')
    assert.equal((await token.balanceOf(buyerB)).toNumber(), 10E24, 'The buyer B has not been given the right amount of tokens')
    assert.equal((await token.balanceOf(buyerC)).toNumber(), 0, 'The buyer C has withdrawn completely but still got tokens')
    assert.equal((await token.balanceOf(buyerD)).toNumber(), 20E24, 'The buyer D has not been given the right amount of tokens')
    assert.equal((await token.balanceOf(buyerE)).toNumber(), 0, 'The buyer E got some tokens despite having its bid refunded')
    assert.equal((await token.balanceOf(buyerF)).toNumber(), 0, 'The buyer F got some tokens despite having its bid refunded')
  })

 it('Should give back tokens to accepted bids and refund others. Full withdrawn bid, partial last bid', async () => {
    let startTestTime = web3.eth.getBlock('latest').timestamp
    let iico = await IICO.new(startTestTime+timeBeforeStart,fullBonusLength,partialWithdrawalLength, withdrawalLockUpLength,maxBonus,beneficiary,{from: owner})
    let head = await iico.bids(0)
    let tailID = head[1]
    let tail = await iico.bids(head[1])
    let token = await MintableToken.new({from: owner})
    await token.mint(iico.address,60E24,{from: owner})
    await iico.setToken(token.address,{from: owner})
    
    
    increaseTime(1100) // Full bonus period.
    await iico.searchAndBid(1E18, 0,{from: buyerA, value:0.3E18}) // Bid 1.
    await iico.searchAndBid(0.6E18, 1,{from: buyerB, value:0.2E18}) // Bid 2.
    await iico.searchAndBid(0.8E18, 2,{from: buyerC, value:0.4E18}) // Bid 3.
    await iico.searchAndBid(0.7E18, 0,{from: buyerD, value:0.2E18}) // Bid 4.
    await iico.searchAndBid(0.5E18, tailID,{from: buyerE, value:0.15E18}) // Bid 5.
    await iico.searchAndBid(0.5E18, tailID,{from: buyerF, value:0.3E18}) // Bid 6.
    await iico.withdraw(3,{from: buyerC})
    
    increaseTime(1E4) // End of sale.
    
    let buyerABalanceAtTheEndOfSale = web3.eth.getBalance(buyerA).toNumber()
    let buyerBBalanceAtTheEndOfSale = web3.eth.getBalance(buyerB).toNumber()
    let buyerCBalanceAtTheEndOfSale = web3.eth.getBalance(buyerC).toNumber()
    let buyerDBalanceAtTheEndOfSale = web3.eth.getBalance(buyerD).toNumber()
    let buyerEBalanceAtTheEndOfSale = web3.eth.getBalance(buyerE).toNumber()
    let buyerFBalanceAtTheEndOfSale = web3.eth.getBalance(buyerF).toNumber()
    let beneficiaryBalanceAtTheEndOfSale = web3.eth.getBalance(beneficiary).toNumber()
    
    await iico.finalize(1000)
    
    // Redeem and verify we can't redeem more than once.
    await iico.redeem(1)
    await expectThrow(iico.redeem(1))
    await iico.redeem(2)
    await expectThrow(iico.redeem(2))
    await iico.redeem(3)
    await expectThrow(iico.redeem(3))
    await iico.redeem(4)
    await expectThrow(iico.redeem(4))
    await iico.redeem(5)
    await expectThrow(iico.redeem(5))
    await iico.redeem(6)
    await expectThrow(iico.redeem(6))
    
    // Verify the proper amounts of ETH are refunded.
    assert.equal(web3.eth.getBalance(buyerA).toNumber(), buyerABalanceAtTheEndOfSale, 'The buyer A has been given ETH back while the full bid should have been accepted')
    assert.equal(web3.eth.getBalance(buyerB).toNumber(), buyerBBalanceAtTheEndOfSale+0.1E18, 'The buyer B whose bid has been partially accepted has not gotten the right amount of ETH back')
    assert.equal(web3.eth.getBalance(buyerC).toNumber(), buyerCBalanceAtTheEndOfSale, 'The buyer C has withdrawn completely but still got refund after finalization')
    assert.equal(web3.eth.getBalance(buyerD).toNumber(), buyerDBalanceAtTheEndOfSale, 'The buyer D has been given ETH back while the full bid should have been accepted')
    assert.equal(web3.eth.getBalance(buyerE).toNumber(), buyerEBalanceAtTheEndOfSale+0.15E18, 'The buyer E has not been reimbursed as it should')
    assert.equal(web3.eth.getBalance(buyerF).toNumber(), buyerFBalanceAtTheEndOfSale+0.3E18, 'The buyer F has not been reimbursed as it should')
    
    assert.equal(web3.eth.getBalance(beneficiary).toNumber(), beneficiaryBalanceAtTheEndOfSale+0.6E18, 'The beneficiary has not been paid correctly')
    
    // Verify that the tokens are correctly distributed.
    assert.equal((await token.balanceOf(buyerA)).toNumber(), 30E24, 'The buyer A has not been given the right amount of tokens')
    assert.equal((await token.balanceOf(buyerB)).toNumber(), 10E24, 'The buyer B has not been given the right amount of tokens')
    assert.equal((await token.balanceOf(buyerC)).toNumber(), 0, 'The buyer C has withdrawn completely but still got tokens')
    assert.equal((await token.balanceOf(buyerD)).toNumber(), 20E24, 'The buyer D has not been given the right amount of tokens')
    assert.equal((await token.balanceOf(buyerE)).toNumber(), 0, 'The buyer E got some tokens despite having its bid refunded')
    assert.equal((await token.balanceOf(buyerF)).toNumber(), 0, 'The buyer F got some tokens despite having its bid refunded')
  })
  
  it('Should give back tokens to accepted bids and refund others. All accepted, some without max bonus', async () => {
    let startTestTime = web3.eth.getBlock('latest').timestamp
    let iico = await IICO.new(startTestTime+timeBeforeStart,fullBonusLength,partialWithdrawalLength, withdrawalLockUpLength,maxBonus,beneficiary,{from: owner})
    let head = await iico.bids(0)
    let tailID = head[1]
    let tail = await iico.bids(head[1])
    let token = await MintableToken.new({from: owner})
    await token.mint(iico.address,115.8E24,{from: owner})
    await iico.setToken(token.address,{from: owner})
    
    
    increaseTime(1010) // Full bonus period.
    await iico.searchAndBid(10E18, 0,{from: buyerA, value:0.1E18}) // Bid 1.
    increaseTime(5990)
    await iico.searchAndBid(6E18, 1,{from: buyerB, value:0.1E18}) // Bid 2. Bonus: 0.8*maxBonus
    increaseTime(1000)
    await iico.searchAndBid(8E18, 2,{from: buyerC, value:0.4E18}) // Bid 3. Bonus: 0.6*maxBonus
    increaseTime(1000)
    await iico.searchAndBid(7E18, 0,{from: buyerD, value:0.2E18}) // Bid 4. Bonus: 0.4*maxBonus
    increaseTime(1000)
    await iico.searchAndBid(5E18, tailID,{from: buyerE, value:0.15E18}) // Bid 5. Bonus: 0.2*maxBonus
    increaseTime(500)
    await iico.searchAndBid(5E18, tailID,{from: buyerF, value:0.1E18}) // Bid 6. Bonus : 0.1*maxBonus
    increaseTime(1E4) // End of sale.
    
    let buyerABalanceAtTheEndOfSale = web3.eth.getBalance(buyerA).toNumber()
    let buyerBBalanceAtTheEndOfSale = web3.eth.getBalance(buyerB).toNumber()
    let buyerCBalanceAtTheEndOfSale = web3.eth.getBalance(buyerC).toNumber()
    let buyerDBalanceAtTheEndOfSale = web3.eth.getBalance(buyerD).toNumber()
    let buyerEBalanceAtTheEndOfSale = web3.eth.getBalance(buyerE).toNumber()
    let buyerFBalanceAtTheEndOfSale = web3.eth.getBalance(buyerF).toNumber()
    let beneficiaryBalanceAtTheEndOfSale = web3.eth.getBalance(beneficiary).toNumber()
    
    await iico.finalize(1000)
    
    // Redeem and verify we can't redeem more than once.
    await iico.redeem(1)
    await expectThrow(iico.redeem(1))
    await iico.redeem(2)
    await expectThrow(iico.redeem(2))
    await iico.redeem(3)
    await expectThrow(iico.redeem(3))
    await iico.redeem(4)
    await expectThrow(iico.redeem(4))
    await iico.redeem(5)
    await expectThrow(iico.redeem(5))
    await iico.redeem(6)
    await expectThrow(iico.redeem(6))
    
    // Verify the proper amounts of ETH are refunded.
    assert.equal(web3.eth.getBalance(buyerA).toNumber(), buyerABalanceAtTheEndOfSale, 'The buyer A has been given ETH back while the full bid should have been accepted')
    assert.equal(web3.eth.getBalance(buyerB).toNumber(), buyerBBalanceAtTheEndOfSale, 'The buyer B has been given ETH back while the full bid should have been accepted')
    assert.equal(web3.eth.getBalance(buyerC).toNumber(), buyerCBalanceAtTheEndOfSale, 'The buyer C has been given ETH back while the full bid should have been accepted')
    assert.equal(web3.eth.getBalance(buyerD).toNumber(), buyerDBalanceAtTheEndOfSale, 'The buyer D has been given ETH back while the full bid should have been accepted')
    assert.equal(web3.eth.getBalance(buyerE).toNumber(), buyerEBalanceAtTheEndOfSale, 'The buyer E has been given ETH back while the full bid should have been accepted')
    assert.equal(web3.eth.getBalance(buyerF).toNumber(), buyerFBalanceAtTheEndOfSale, 'The buyer F has been given ETH back while the full bid should have been accepted')
    
    assert.equal(web3.eth.getBalance(beneficiary).toNumber(), beneficiaryBalanceAtTheEndOfSale+1.05E18, 'The beneficiary has not been paid correctly')

    // Verify that the tokens are correctly distributed.
    // Allow up to 1% of error due to time not being prefect.
    assert(Math.abs((await token.balanceOf(buyerA)).toNumber() - 12E24) <= 12E24/100, 'The buyer A has not been given the right amount of tokens')
    assert(Math.abs((await token.balanceOf(buyerB)).toNumber() - 11.6E24) <= 11.6E24/100, 'The buyer B has not been given the right amount of tokens')
    assert(Math.abs((await token.balanceOf(buyerC)).toNumber() - 44.8E24) <= 44.8E24/100, 'The buyer C has not been given the right amount of tokens')
    assert(Math.abs((await token.balanceOf(buyerD)).toNumber() - 21.6E24) <= 21.6E24/100, 'The buyer D has not been given the right amount of tokens')
    assert(Math.abs((await token.balanceOf(buyerE)).toNumber() - 15.6E24) <= 15.6E24/100, 'The buyer E has not been given the right amount of tokens')
    assert(Math.abs((await token.balanceOf(buyerF)).toNumber() - 10.2E24) <= 10.2E24/100, 'The buyer F has not been given the right amount of tokens')
  })
  
  
  it('Should give back tokens to accepted bids and refund others. Some accepted, some without max bonus', async () => {
    let startTestTime = web3.eth.getBlock('latest').timestamp
    let iico = await IICO.new(startTestTime+timeBeforeStart,fullBonusLength,partialWithdrawalLength, withdrawalLockUpLength,maxBonus,beneficiary,{from: owner})
    let head = await iico.bids(0)
    let tailID = head[1]
    let tail = await iico.bids(head[1])
    let token = await MintableToken.new({from: owner})
    await token.mint(iico.address,78.4E24,{from: owner})
    await iico.setToken(token.address,{from: owner})
    
    
    increaseTime(1010) // Full bonus period.
    await iico.searchAndBid(1E18, 0,{from: buyerA, value:0.1E18}) // Bid 1.
    increaseTime(5990)
    await iico.searchAndBid(0.6E18, 1,{from: buyerB, value:0.1E18}) // Bid 2. Bonus: 0.8*maxBonus
    increaseTime(1000)
    await iico.searchAndBid(0.8E18, 2,{from: buyerC, value:0.4E18}) // Bid 3. Bonus: 0.6*maxBonus
    increaseTime(1000)
    await iico.searchAndBid(0.7E18, 0,{from: buyerD, value:0.2E18}) // Bid 4. Bonus: 0.4*maxBonus
    increaseTime(1000)
    await iico.searchAndBid(0.5E18, tailID,{from: buyerE, value:0.15E18}) // Bid 5. Bonus: 0.2*maxBonus
    increaseTime(500)
    await iico.searchAndBid(0.5E18, tailID,{from: buyerF, value:0.1E18}) // Bid 6. Bonus : 0.1*maxBonus
    increaseTime(1E4) // End of sale.
    
    let buyerABalanceAtTheEndOfSale = web3.eth.getBalance(buyerA).toNumber()
    let buyerBBalanceAtTheEndOfSale = web3.eth.getBalance(buyerB).toNumber()
    let buyerCBalanceAtTheEndOfSale = web3.eth.getBalance(buyerC).toNumber()
    let buyerDBalanceAtTheEndOfSale = web3.eth.getBalance(buyerD).toNumber()
    let buyerEBalanceAtTheEndOfSale = web3.eth.getBalance(buyerE).toNumber()
    let buyerFBalanceAtTheEndOfSale = web3.eth.getBalance(buyerF).toNumber()
    let beneficiaryBalanceAtTheEndOfSale = web3.eth.getBalance(beneficiary).toNumber()
    
    await iico.finalize(1000)
    
    // Redeem and verify we can't redeem more than once.
    await iico.redeem(1)
    await expectThrow(iico.redeem(1))
    await iico.redeem(2)
    await expectThrow(iico.redeem(2))
    await iico.redeem(3)
    await expectThrow(iico.redeem(3))
    await iico.redeem(4)
    await expectThrow(iico.redeem(4))
    await iico.redeem(5)
    await expectThrow(iico.redeem(5))
    await iico.redeem(6)
    await expectThrow(iico.redeem(6))
    
    // Verify the proper amounts of ETH are refunded.
    assert.equal(web3.eth.getBalance(buyerA).toNumber(), buyerABalanceAtTheEndOfSale, 'The buyer A has been given ETH back while the full bid should have been accepted')
    assert.equal(web3.eth.getBalance(buyerB).toNumber(), buyerBBalanceAtTheEndOfSale+0.1E18, 'The buyer B has not been reimbursed as it should')
    assert.equal(web3.eth.getBalance(buyerC).toNumber(), buyerCBalanceAtTheEndOfSale, 'The buyer C has been given ETH back while the full bid should have been accepted')
    assert.equal(web3.eth.getBalance(buyerD).toNumber(), buyerDBalanceAtTheEndOfSale, 'The buyer D has been given ETH back while the full bid should have been accepted')
    assert.equal(web3.eth.getBalance(buyerE).toNumber(), buyerEBalanceAtTheEndOfSale+0.15E18, 'The buyer E has not been reimbursed as it should')
    assert.equal(web3.eth.getBalance(buyerF).toNumber(), buyerFBalanceAtTheEndOfSale+0.1E18, 'The buyer F has not been reimbursed as it should')
    
    assert.equal(web3.eth.getBalance(beneficiary).toNumber(), beneficiaryBalanceAtTheEndOfSale+0.7E18, 'The beneficiary has not been paid correctly')

    // Verify that the tokens are correctly distributed.
    // Allow up to 1% of error due to time not being prefect.
    assert(Math.abs((await token.balanceOf(buyerA)).toNumber() - 12E24) <= 12E24/100, 'The buyer A has not been given the right amount of tokens')
    assert((await token.balanceOf(buyerB)).toNumber() === 0, 'The buyer B has not been given the right amount of tokens')
    assert(Math.abs((await token.balanceOf(buyerC)).toNumber() - 44.8E24) <= 44.8E24/100, 'The buyer C has not been given the right amount of tokens')
    assert(Math.abs((await token.balanceOf(buyerD)).toNumber() - 21.6E24) <= 21.6E24/100, 'The buyer D has not been given the right amount of tokens')
    assert((await token.balanceOf(buyerE)).toNumber() === 0, 'The buyer E has not been given the right amount of tokens')
    assert((await token.balanceOf(buyerF)).toNumber() === 0, 'The buyer F has not been given the right amount of tokens')
  })

  it('Should give back tokens to accepted bids and refund others. Some accepted, some without max bonus, one bid partially withdrawn', async () => {
    let startTestTime = web3.eth.getBlock('latest').timestamp
    let iico = await IICO.new(startTestTime+timeBeforeStart,fullBonusLength,partialWithdrawalLength, withdrawalLockUpLength,maxBonus,beneficiary,{from: owner})
    let head = await iico.bids(0)
    let tailID = head[1]
    let tail = await iico.bids(head[1])
    let token = await MintableToken.new({from: owner})
    await token.mint(iico.address,75.36E24,{from: owner})
    await iico.setToken(token.address,{from: owner})
    
    
    increaseTime(1010) // Full bonus period.
    await iico.searchAndBid(1E18, 0,{from: buyerA, value:0.1E18}) // Bid 1.
    increaseTime(5990)
    await iico.searchAndBid(0.6E18, 1,{from: buyerB, value:0.1E18}) // Bid 2. Bonus: 0.8*maxBonus
    increaseTime(1000)
    await iico.searchAndBid(0.8E18, 2,{from: buyerC, value:0.4E18}) // Bid 3. Bonus: 0.6*maxBonus
    await iico.withdraw(1,{from: buyerA})
    increaseTime(1000)
    await iico.searchAndBid(0.7E18, 0,{from: buyerD, value:0.2E18}) // Bid 4. Bonus: 0.4*maxBonus
    increaseTime(1000)
    await iico.searchAndBid(0.5E18, tailID,{from: buyerE, value:0.15E18}) // Bid 5. Bonus: 0.2*maxBonus
    increaseTime(500)
    await iico.searchAndBid(0.5E18, tailID,{from: buyerF, value:0.1E18}) // Bid 6. Bonus : 0.1*maxBonus
    increaseTime(1E4) // End of sale.
    
    let buyerABalanceAtTheEndOfSale = web3.eth.getBalance(buyerA).toNumber()
    let buyerBBalanceAtTheEndOfSale = web3.eth.getBalance(buyerB).toNumber()
    let buyerCBalanceAtTheEndOfSale = web3.eth.getBalance(buyerC).toNumber()
    let buyerDBalanceAtTheEndOfSale = web3.eth.getBalance(buyerD).toNumber()
    let buyerEBalanceAtTheEndOfSale = web3.eth.getBalance(buyerE).toNumber()
    let buyerFBalanceAtTheEndOfSale = web3.eth.getBalance(buyerF).toNumber()
    let beneficiaryBalanceAtTheEndOfSale = web3.eth.getBalance(beneficiary).toNumber()
    
    await iico.finalize(1000)
    
    // Redeem and verify we can't redeem more than once.
    await iico.redeem(1)
    await expectThrow(iico.redeem(1))
    await iico.redeem(2)
    await expectThrow(iico.redeem(2))
    await iico.redeem(3)
    await expectThrow(iico.redeem(3))
    await iico.redeem(4)
    await expectThrow(iico.redeem(4))
    await iico.redeem(5)
    await expectThrow(iico.redeem(5))
    await iico.redeem(6)
    await expectThrow(iico.redeem(6))
    
    // Verify the proper amounts of ETH are refunded.
    assert.equal(web3.eth.getBalance(buyerA).toNumber(), buyerABalanceAtTheEndOfSale, 'The buyer A has been given ETH back while the full bid should have been accepted')
    assert.equal(web3.eth.getBalance(buyerB).toNumber(), buyerBBalanceAtTheEndOfSale+0.1E18, 'The buyer B has not been reimbursed as it should')
    assert.equal(web3.eth.getBalance(buyerC).toNumber(), buyerCBalanceAtTheEndOfSale, 'The buyer C has been given ETH back while the full bid should have been accepted')
    assert.equal(web3.eth.getBalance(buyerD).toNumber(), buyerDBalanceAtTheEndOfSale, 'The buyer D has been given ETH back while the full bid should have been accepted')
    assert.equal(web3.eth.getBalance(buyerE).toNumber(), buyerEBalanceAtTheEndOfSale+0.15E18, 'The buyer E has not been reimbursed as it should')
    assert.equal(web3.eth.getBalance(buyerF).toNumber(), buyerFBalanceAtTheEndOfSale+0.1E18, 'The buyer F has not been reimbursed as it should')
    
    assert(Math.abs(web3.eth.getBalance(beneficiary).toNumber() - (beneficiaryBalanceAtTheEndOfSale+0.68E18))  <= 0.68E18/100, 'The beneficiary has not been paid correctly')
    
    // Verify that the tokens are correctly distributed.
    // Allow up to 1% of error due to time not being prefect. For buyer A up to 2% because of time error both in bid and withdraw.
    assert(Math.abs((await token.balanceOf(buyerA)).toNumber() - 8.96E24) <= 2*8.96E24/100, 'The buyer A has not been given the right amount of tokens')
    assert((await token.balanceOf(buyerB)).toNumber() === 0, 'The buyer B has not been given the right amount of tokens')
    assert(Math.abs((await token.balanceOf(buyerC)).toNumber() - 44.8E24) <= 44.8E24/100, 'The buyer C has not been given the right amount of tokens')
    assert(Math.abs((await token.balanceOf(buyerD)).toNumber() - 21.6E24) <= 21.6E24/100, 'The buyer D has not been given the right amount of tokens')
    assert((await token.balanceOf(buyerE)).toNumber() === 0, 'The buyer E has not been given the right amount of tokens')
    assert((await token.balanceOf(buyerF)).toNumber() === 0, 'The buyer F has not been given the right amount of tokens')
    
  })
  
  // Fallback
  it('Should make bids of infinite max val and withdraw them', async () => {
    let startTestTime = web3.eth.getBlock('latest').timestamp
    let iico = await IICO.new(startTestTime+timeBeforeStart,fullBonusLength,partialWithdrawalLength, withdrawalLockUpLength,maxBonus,beneficiary,{from: owner})
    let head = await iico.bids(0)
    let tailID = head[1]
    let tail = await iico.bids(head[1])
    let token = await MintableToken.new({from: owner})
    await token.mint(iico.address,70E24,{from: owner})
    await iico.setToken(token.address,{from: owner})
    
    
    increaseTime(1100) // Full bonus period.
    await iico.sendTransaction({from: buyerA, value:0.1E18}) // Bid 1.
    await iico.searchAndBid(0.6E18, 1,{from: buyerB, value:0.1E18}) // Bid 2.
    await iico.sendTransaction({from: buyerC, value:0.3E18}) // Bid 3.
    await iico.sendTransaction({from: buyerC, value:0.1E18}) // Bid 4.
    await iico.searchAndBid(0.7E18, 0,{from: buyerD, value:0.2E18}) // Bid 5.
    await iico.searchAndBid(0.5E18, tailID,{from: buyerE, value:0.15E18}) // Bid 6.
    await iico.searchAndBid(0.5E18, tailID,{from: buyerF, value:0.3E18}) // Bid 7.
    increaseTime(1E4) // End of sale.
    
    let buyerABalanceAtTheEndOfSale = web3.eth.getBalance(buyerA).toNumber()
    let buyerBBalanceAtTheEndOfSale = web3.eth.getBalance(buyerB).toNumber()
    let buyerCBalanceAtTheEndOfSale = web3.eth.getBalance(buyerC).toNumber()
    let buyerDBalanceAtTheEndOfSale = web3.eth.getBalance(buyerD).toNumber()
    let buyerEBalanceAtTheEndOfSale = web3.eth.getBalance(buyerE).toNumber()
    let buyerFBalanceAtTheEndOfSale = web3.eth.getBalance(buyerF).toNumber()
    let beneficiaryBalanceAtTheEndOfSale = web3.eth.getBalance(beneficiary).toNumber()
    
    await iico.finalize(1000)
    
    // Redeem and verify we can't redeem more than once.
    let txA = await iico.sendTransaction({from: buyerA, gasPrice: gasPrice})
    let txFeeA = txA.receipt.gasUsed * gasPrice
    await iico.redeem(2)
    await expectThrow(iico.redeem(2))
    let txC = await iico.sendTransaction({from: buyerC, gasPrice: gasPrice})
    let txFeeC = txC.receipt.gasUsed * gasPrice
    await iico.redeem(5)
    await expectThrow(iico.redeem(5))
    await iico.redeem(6)
    await expectThrow(iico.redeem(6))
    await iico.redeem(7)
    await expectThrow(iico.redeem(7))
    
    // Verify the proper amounts of ETH are refunded.
    assert.equal(web3.eth.getBalance(buyerA).plus(txFeeA).toNumber(), buyerABalanceAtTheEndOfSale, 'The buyer A has been given ETH back while the full bid should have been accepted')
    assert.equal(web3.eth.getBalance(buyerB).toNumber(), buyerBBalanceAtTheEndOfSale+0.1E18, 'The buyer B has not been reimbursed as it should')
    assert.equal(web3.eth.getBalance(buyerC).plus(txFeeC).toNumber(), buyerCBalanceAtTheEndOfSale, 'The buyer C has been given ETH back while the full bid should have been accepted')
    assert.equal(web3.eth.getBalance(buyerD).toNumber(), buyerDBalanceAtTheEndOfSale, 'The buyer D has been given ETH back while the full bid should have been accepted')
    assert.equal(web3.eth.getBalance(buyerE).toNumber(), buyerEBalanceAtTheEndOfSale+0.15E18, 'The buyer E has not been reimbursed as it should')
    assert.equal(web3.eth.getBalance(buyerF).toNumber(), buyerFBalanceAtTheEndOfSale+0.3E18, 'The buyer F has not been reimbursed as it should')
    
    assert.equal(web3.eth.getBalance(beneficiary).toNumber(), beneficiaryBalanceAtTheEndOfSale+0.7E18, 'The beneficiary has not been paid correctly')
    
    // Verify that the tokens are correctly distributed.
    assert.equal((await token.balanceOf(buyerA)).toNumber(), 10E24, 'The buyer A has not been given the right amount of tokens')
    assert.equal((await token.balanceOf(buyerB)).toNumber(), 0, 'The buyer B got some tokens despite having its bid refunded')
    assert.equal((await token.balanceOf(buyerC)).toNumber(), 40E24, 'The buyer C has not been given the right amount of tokens')
    assert.equal((await token.balanceOf(buyerD)).toNumber(), 20E24, 'The buyer D has not been given the right amount of tokens')
    assert.equal((await token.balanceOf(buyerE)).toNumber(), 0, 'The buyer E got some tokens despite having its bid refunded')
    assert.equal((await token.balanceOf(buyerF)).toNumber(), 0, 'The buyer F got some tokens despite having its bid refunded')
  })

  // https://medium.com/kleros/how-interactive-coin-offerings-iicos-work-beed401ce526
  // ! ! ! NOTE THAT WE ARE DOING REFUNDS DIFFERENTLY, see: https://github.com/kleros/openiico-contract/issues/18
  // Bob 6 ETH remains in the sale, up to 20 ETH, only 4 ETH gets refunded
  it('Test case from the blog', async () => {
    let startTestTime = web3.eth.getBlock('latest').timestamp
    let iico = await IICO.new(startTestTime+timeBeforeStart,fullBonusLength,partialWithdrawalLength, withdrawalLockUpLength,maxBonus,beneficiary,{from: owner})
    let head = await iico.bids(0)
    let tailID = head[1]
    let tail = await iico.bids(head[1])
    let token = await MintableToken.new({from: owner})
    await token.mint(iico.address,100E18,{from: owner}) // We will use a 100 PNK sale for the example.
    await iico.setToken(token.address,{from: owner})

    increaseTime(1000) // Full bonus period.
    /* ALICE */ await iico.searchAndBid(noCap, 0,{from: buyerA, value:6E18}) // Alice's bid 
    var aliceBid = await iico.bids.call(1);

    increaseTime(5250) // 250 elapsed, 1/20 of 2500+2500
    /* BOB */ await iico.searchAndBid(20E18, 0,{from: buyerB, value:10E18}) // Bob's bid, bonus 19%
    
    increaseTime(250) // another 250 elapsed, 2/20 of 2500
    /* CARL */ await iico.searchAndBid(25E18, 0,{from: buyerC, value:5E18}) // Carl's bid, bonus 18%

    // He will only be able to withdraw whatever percentage is left of the first phase. 
    // Carl withdraws manually 80% of the way through the end of the first phase. 
    increaseTime(1500); // now it's 2000 of 2500 partialWithdrawalLength, which equal to 80%, therefore returning 20% of the bid

    let CarlBalanceBeforeReimbursment = web3.eth.getBalance(buyerC)
    var CarlsBidBefore = await iico.bids.call(3);
    var CarlsBidBeforeBonus = CarlsBidBefore[4].toNumber(); // it's a struct, getting 4 field
    assert.closeTo(CarlsBidBeforeBonus, 1.8E8, 0.01E8, 'Bonus amount not correct before withdrawing the bid');

    await expectThrow(iico.withdraw(3,{from: buyerB})) // Only the contributor can withdraw.
    let tx = await iico.withdraw(3,{from: buyerC, gasPrice: gasPrice})

    await expectThrow(iico.withdraw(3,{from: buyerC, gasPrice: gasPrice})) // cannot withdraw more than once
    let txFee = tx.receipt.gasUsed * gasPrice
    let CarlBalanceAfterReimbursment = web3.eth.getBalance(buyerC)
    assert.closeTo(CarlBalanceBeforeReimbursment.plus(1E18).minus(txFee).toNumber(), CarlBalanceAfterReimbursment.toNumber(), 0.01*1E18, 'Reimbursement amount not correct');

    var CarlsBidAfter = await iico.bids.call(3);
    var CarlsBidAfterBonus = CarlsBidAfter[4].toNumber();
    assert.closeTo(CarlsBidAfterBonus, 1.2E8, 0.01E8, 'Bonus amount not correct, after withdrawal of the bid (reduced by 1/3)');

    // Now David, after seeing how the sale is evolving, decides that he also wants some tokens 
    // and contributes 4 ETH with a personal cap of 24 ETH. He gets an 8% bonus. 
    increaseTime(1000) // now it is 3000 out of 5000
    /* DAVID */ await iico.searchAndBid(24E18, 0, {from: buyerD, value:4E18}) // Davids's bid, bonus 8%

    var DavidsBid = await iico.bids.call(4);
    var DavidsBidBonus = DavidsBid[4].toNumber();
    assert.closeTo(DavidsBidBonus, 0.8E8, 0.01E8, 'Bonus amount not correct');

    increaseTime(1E4) // End of sale.
    
    let buyerABalanceAtTheEndOfSale = web3.eth.getBalance(buyerA).toNumber()
    let buyerBBalanceAtTheEndOfSale = web3.eth.getBalance(buyerB).toNumber()
    let buyerCBalanceAtTheEndOfSale = web3.eth.getBalance(buyerC).toNumber()
    let buyerDBalanceAtTheEndOfSale = web3.eth.getBalance(buyerD).toNumber()
    let beneficiaryBalanceAtTheEndOfSale = web3.eth.getBalance(beneficiary).toNumber()
    
    await iico.finalize(1000)
    
    // Redeem and verify we can't redeem more than once.
    await iico.redeem(1)
    await expectThrow(iico.redeem(1))
    await iico.redeem(2)
    await expectThrow(iico.redeem(2))
    await iico.redeem(3)
    await expectThrow(iico.redeem(3))
    await iico.redeem(4)
    await expectThrow(iico.redeem(4))

    
    // Verify the proper amounts of ETH are refunded.
    assert.equal(web3.eth.getBalance(buyerA).toNumber(), buyerABalanceAtTheEndOfSale, 'The buyer A has been given ETH back while the full bid should have been accepted')
    assert.closeTo(web3.eth.getBalance(buyerB).toNumber(), buyerBBalanceAtTheEndOfSale + 4E18, 0.01*1E18, 'The buyer B has been given ETH back while the full bid should have been accepted')
    assert.equal(web3.eth.getBalance(buyerC).toNumber(), buyerCBalanceAtTheEndOfSale, 'The buyer C has been given ETH back while the full bid should have been accepted')
    assert.equal(web3.eth.getBalance(buyerD).toNumber(), buyerDBalanceAtTheEndOfSale, 'The buyer D has been given ETH back while the full bid should have been accepted')
    
    assert.equal(web3.eth.getBalance(beneficiary).toNumber(), beneficiaryBalanceAtTheEndOfSale+20E18, 'The beneficiary has not been paid correctly')
    
    // Alice: 6 ETH 20% bonus = 7.20
    // Bob:   6 ETH 18% bonus = 7.08
    // Carl:  4 ETH 12% bonus = 4.48
    // David: 4 ETH 8%  bonus = 4.32
    var totalContributed = 7.2 + 7.08 + 4.48 + 4.32; // 23.08

    // Verify that the tokens are correctly distributed.
    assert.closeTo( (await token.balanceOf(buyerA)).toNumber() / 1E18, 7.20 / totalContributed * 100, 0.2, 'The buyer A has not been given the right amount of tokens')
    assert.closeTo( (await token.balanceOf(buyerB)).toNumber() / 1E18, 7.08 / totalContributed * 100, 0.2, 'The buyer B has not been given the right amount of tokens')
    assert.closeTo( (await token.balanceOf(buyerC)).toNumber() / 1E18, 4.48 / totalContributed * 100, 0.2, 'The buyer C has not been given the right amount of tokens')
    assert.closeTo( (await token.balanceOf(buyerD)).toNumber() / 1E18, 4.32 / totalContributed * 100, 0.2, 'The buyer D has not been given the right amount of tokens')
  
  })
  
})

