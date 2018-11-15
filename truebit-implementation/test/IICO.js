
const { waitForMined, expectThrow, increaseTime } = require('kleros-interaction/helpers/utils')
const MintableToken = artifacts.require('openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol')
const IICO = artifacts.require('IICO.sol')


contract('IICO', function (accounts) {
  let owner = accounts[0]
  let beneficiary = accounts[1]
  let buyerA = accounts[2]
  let buyerB = accounts[3]

  let timeBeforeStart = 1000
  let fullBonusLength = 5000
  let partialWithdrawalLength = 2500
  let withdrawalLockUpLength = 2500
  let maxBonus = 2E8
  let noCap = 120000000E18 // for placing bids with no cap
//  let minValuation = web3.toWei(1000, 'ether')
  let minValuation = 0
  let maxValuation = web3.toWei(100000, 'ether')
  let increment = web3.toWei(0.5, 'ether') 
  let numBuckets = 200001
  let tx, log

  // Constructor
  it('Should create the contract with the initial setup', async () => {
    let startTestTime = web3.eth.getBlock('latest').timestamp
    let iico = await IICO.new(startTestTime+timeBeforeStart,fullBonusLength,partialWithdrawalLength, withdrawalLockUpLength,maxBonus,beneficiary, minValuation, maxValuation, increment, {from: owner})
    let minBucket = await iico.buckets(0)
    let maxBucket = await iico.buckets(numBuckets-1)

    assert.equal(await iico.owner(), owner, 'The owner is not set correctly')
    assert.equal(await iico.beneficiary(), beneficiary, 'The beneficiary is not set correctly')
    assert.equal(await iico.lastBidID(), 0, 'The lastBidID is not set correctly')
    assert.equal(await iico.startTime(), startTestTime+1000, 'The startTime is not set correctly')
    assert.equal(await iico.endFullBonusTime(), startTestTime+6000, 'The endFullBonusTime is not set correctly')
    assert.equal(await iico.withdrawalLockTime(), startTestTime+8500, 'The endFullBonusTime is not set correctly')
    assert.equal(await iico.endTime(), startTestTime+11000, 'The endFullBonusTime is not set correctly')
    assert.equal(await iico.maxBonus(), 2E8, 'The maxBonus is not set correctly')
    assert.equal(await iico.finalized(), false, 'The finalized is not set correctly')

    /* TODO: Do we need to track the cutoffbid in this case? */

    assert.equal(await iico.sumAcceptedContrib(), 0, 'The sumAcceptedContrib is not set correctly')
    assert.equal(await iico.sumAcceptedVirtualContrib(), 0, 'The sumAcceptedVirtualContrib is not set correctly')

  assert.equal(await iico.numBuckets(), numBuckets)
  assert.equal(maxBucket[1], owner)
  assert.equal(minBucket[1], owner)
  assert.equal(maxBucket[0].toNumber(), maxValuation)
  assert.equal(minBucket[0].toNumber(), minValuation)
    })

  // setToken
  it('Should set the token', async () => {
    let startTestTime = web3.eth.getBlock('latest').timestamp
    let iico = await IICO.new(startTestTime+timeBeforeStart,fullBonusLength,partialWithdrawalLength, withdrawalLockUpLength,maxBonus,beneficiary, minValuation, maxValuation, increment, {from: owner})
    let token = await MintableToken.new({from: owner})
    await token.mint(iico.address,160E24,{from: owner})
    await expectThrow(iico.setToken(token.address,{from: buyerA})) // Only owner can set.
    await iico.setToken(token.address,{from: owner})

    assert.equal(await iico.token(), token.address, 'The token is not set correctly')
    assert.equal(await iico.tokensForSale(), 160E24, 'The tokensForSale is not set correctly')
  })

  it('Should submit a bid with default valuations', async () => {
    let startTestTime = web3.eth.getBlock('latest').timestamp
    let iico = await IICO.new(startTestTime+timeBeforeStart,fullBonusLength,partialWithdrawalLength, withdrawalLockUpLength,maxBonus,beneficiary, minValuation, maxValuation, increment, {from: owner})
    let token = await MintableToken.new({from: owner})
    let minBucket = iico.buckets(0)
  
    await token.mint(iico.address,160E24,{from: owner})
    await iico.setToken(token.address,{from: owner})

    await expectThrow( iico.submitBid(maxValuation, 0, {from: buyerA, value:0.1E18}) )  

    increaseTime(1010)

    tx = await iico.submitBid(maxValuation, 0, {from: buyerA, value:0.1E18})
  
    log = tx.logs.find(log => log.event === 'BidSubmitted')
    assert.equal(log.args.contributor, buyerA)
    assert.equal(log.args.bidID, 1)

    let bid = await iico.bids.call(1)
    assert.equal(bid[0].toNumber(), maxValuation)
    assert.equal(bid[1], 0)
    assert.equal(bid[2], 0.1E18)
    assert.equal(bid[4], buyerA)
    assert.equal(bid[5], false)
    assert.equal(bid[6], false)
    assert.equal(bid[7], true)
    assert.equal(bid[8].toNumber(), 0)
    assert.equal(bid[9].toNumber(), numBuckets-1)
    // TODO: fix the god damn min bucket valuation
    // Check the bucket got filled
    let bucketMinBids = await iico.bucketMinBids(0)
    let bucketMaxBids = await iico.bucketMaxBids(numBuckets-1)
    assert.equal(bucketMinBids.length, 1)
    assert.equal(bucketMaxBids.length, 1)
    assert.equal(bucketMinBids[0].toNumber(), 1)
    assert.equal(bucketMaxBids[0].toNumber(), 1)
  })

  it('Should mark the bid inactive at submission.', async () => {
    let startTestTime = web3.eth.getBlock('latest').timestamp
    let iico = await IICO.new(startTestTime+timeBeforeStart,fullBonusLength,partialWithdrawalLength, withdrawalLockUpLength,maxBonus,beneficiary, minValuation, maxValuation, increment, {from: owner})
    let token = await MintableToken.new({from: owner})
    increaseTime(1010)
 
 	await iico.submitBid(web3.toWei(1, 'ether'), 0, {from: buyerA, value:web3.toWei(10, 'ether')})

	let bid = await iico.bids.call(1)
	assert.equal(bid[7], false)

	await iico.submitBid(web3.toWei(100, 'ether'), web3.toWei(50, 'ether'), {from: buyerB, value: web3.toWei(1, 'ether')})

	bid = await iico.bids.call(2)
	assert.equal(bid[4], buyerB)
	assert.equal(bid[7], false)

  })

  it('Should submit a bit and create a new bucket', async () => {
    let startTestTime = web3.eth.getBlock('latest').timestamp
    let iico = await IICO.new(startTestTime+timeBeforeStart,fullBonusLength,partialWithdrawalLength, withdrawalLockUpLength,maxBonus,beneficiary, minValuation, maxValuation, increment, {from: owner})
    let token = await MintableToken.new({from: owner})
    
  })

})


    
