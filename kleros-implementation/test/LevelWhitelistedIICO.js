/* eslint-disable no-undef */ // Avoid the linter considering truffle elements as undef.
const { expectThrow, increaseTime } = require('kleros-interaction/helpers/utils')
const MintableToken = artifacts.require('zeppelin-solidity/MintableToken.sol')
const LWIICO = artifacts.require('LevelWhitelistedIICO.sol')

contract('Level Whitelisted IICO', function (accounts) {
  let owner = accounts[0]
  let beneficiary = accounts[1]
  let buyerA = accounts[2]
  let buyerB = accounts[3]
  let whitelister = accounts[4]
  let whitelister2 = accounts[5]
  let gasPrice = 5E9

  
  let timeBeforeStart = 1000
  let fullBonusLength = 5000
  let partialWithdrawalLength = 2500
  let withdrawalLockUpLength = 2500
  let maxBonus = 2E8
  let noCap = 120000000E18 // for placing bids with no cap
  let maximumBaseContribution = 5E18
  
  // Constructor
  it('Should create the contract with the initial values', async () => {
    let startTestTime = web3.eth.getBlock('latest').timestamp
    let lwiico = await LWIICO.new(startTestTime+timeBeforeStart,fullBonusLength,partialWithdrawalLength, withdrawalLockUpLength,maxBonus,beneficiary,maximumBaseContribution,{from: owner})
    assert.equal((await lwiico.maximumBaseContribution.call()).toNumber(), maximumBaseContribution, 'Maximum base contribution not set correctly')
    assert.equal(await lwiico.whitelister.call(), 0, 'Whitelister should not be set initially')
  })  

  it('Should be able to set and change whitelister (only owner)', async () => {
    let startTestTime = web3.eth.getBlock('latest').timestamp
    let lwiico = await LWIICO.new(startTestTime+timeBeforeStart,fullBonusLength,partialWithdrawalLength, withdrawalLockUpLength,maxBonus,beneficiary,maximumBaseContribution,{from: owner})

    await lwiico.setWhitelister(whitelister,{from: owner});
    assert.equal(await lwiico.whitelister.call(), whitelister, 'Whitelister is not set')    

    await lwiico.setWhitelister(whitelister2,{from: owner});
    assert.equal(await lwiico.whitelister.call(), whitelister2, 'Whitelister is not changed')
  })    

  it('Should not be able to set whitelister (anyone else)', async () => {
    let startTestTime = web3.eth.getBlock('latest').timestamp
    let lwiico = await LWIICO.new(startTestTime+timeBeforeStart,fullBonusLength,partialWithdrawalLength, withdrawalLockUpLength,maxBonus,beneficiary,maximumBaseContribution,{from: owner})

    await expectThrow(lwiico.setWhitelister(whitelister,{from: buyerA}));
  }) 

  it('Should not be able to add to whitelist (anyone else)', async () => {
    let startTestTime = web3.eth.getBlock('latest').timestamp
    let lwiico = await LWIICO.new(startTestTime+timeBeforeStart,fullBonusLength,partialWithdrawalLength, withdrawalLockUpLength,maxBonus,beneficiary,maximumBaseContribution,{from: owner})

    await lwiico.setWhitelister(whitelister,{from: owner});
    await expectThrow(lwiico.addBaseWhitelist([buyerA],{from: buyerA}));
  })         

  it('Should be forbidden to send ETH without whitelist', async () => {
    let startTestTime = web3.eth.getBlock('latest').timestamp
    let lwiico = await LWIICO.new(startTestTime+timeBeforeStart,fullBonusLength,partialWithdrawalLength, withdrawalLockUpLength,maxBonus,beneficiary,maximumBaseContribution,{from: owner})

    increaseTime(1010) // time of the crowdasle

    await expectThrow(lwiico.searchAndBid(1E18, 0,{from: buyerA, value:0.1E18}))
  })   

  it('Should be possible to send ETH after whitelisting', async () => {
    let startTestTime = web3.eth.getBlock('latest').timestamp
    let lwiico = await LWIICO.new(startTestTime+timeBeforeStart,fullBonusLength,partialWithdrawalLength, withdrawalLockUpLength,maxBonus,beneficiary,maximumBaseContribution,{from: owner})

    await lwiico.setWhitelister(whitelister,{from: owner});
    await lwiico.addBaseWhitelist([buyerA],{from: whitelister}) 

    increaseTime(1010) // time of the crowdasle
    lwiico.searchAndBid(1E18, 0, {from: buyerA, value:0.1E18});
    increaseTime(100) // without it the test fails, might be some timing / async issues
    var bid = await lwiico.bids.call(1);

    assert.equal(bid[5], buyerA, "Bid is not properly saved");
  })   

  it('Should not be possible to send too much ETH after whitelisting', async () => {
    let startTestTime = web3.eth.getBlock('latest').timestamp
    let lwiico = await LWIICO.new(startTestTime+timeBeforeStart,fullBonusLength,partialWithdrawalLength, withdrawalLockUpLength,maxBonus,beneficiary,maximumBaseContribution,{from: owner})

    await lwiico.setWhitelister(whitelister,{from: owner});
    await lwiico.addBaseWhitelist([buyerA],{from: whitelister}) 

    increaseTime(1010) // time of the crowdasle

    await expectThrow(lwiico.searchAndBid(1E18, 0, {from: buyerA, value: maximumBaseContribution + 1e18})); // the way how JavaScript handles big numbers, cannot just do +1
  }) 

  it('Should not be possible to send too much ETH after whitelisting in multiple goes', async () => {
    let startTestTime = web3.eth.getBlock('latest').timestamp
    let lwiico = await LWIICO.new(startTestTime+timeBeforeStart,fullBonusLength,partialWithdrawalLength, withdrawalLockUpLength,maxBonus,beneficiary,maximumBaseContribution,{from: owner})

    await lwiico.setWhitelister(whitelister,{from: owner});
    await lwiico.addBaseWhitelist([buyerA],{from: whitelister}) 

    increaseTime(1010) // time of the crowdasle

    lwiico.searchAndBid(1E18, 0, {from: buyerA, value: 1E18});

    increaseTime(100);

    await expectThrow(lwiico.searchAndBid(1E18, 0, {from: buyerA, value: 4.5E18}));
  })    

  it('Should not be possible to send ETH after removing from whitelist', async () => {
    let startTestTime = web3.eth.getBlock('latest').timestamp
    let lwiico = await LWIICO.new(startTestTime+timeBeforeStart,fullBonusLength,partialWithdrawalLength, withdrawalLockUpLength,maxBonus,beneficiary,maximumBaseContribution,{from: owner})

    await lwiico.setWhitelister(whitelister,{from: owner});
    await lwiico.addBaseWhitelist([buyerA],{from: whitelister}) 

    increaseTime(1010) // time of the crowdasle

    lwiico.searchAndBid(1E18, 0, {from: buyerA, value: 1E18});

    increaseTime(100);

    await lwiico.removeBaseWhitelist([buyerA],{from: whitelister}) 

    await expectThrow(lwiico.searchAndBid(1E18, 0, {from: buyerA, value: 1E18}));
  })    

  it('Should be possible to add and remove multiple users at once to base whitelist', async () => {
    let startTestTime = web3.eth.getBlock('latest').timestamp
    let lwiico = await LWIICO.new(startTestTime+timeBeforeStart,fullBonusLength,partialWithdrawalLength, withdrawalLockUpLength,maxBonus,beneficiary,maximumBaseContribution,{from: owner})

    await lwiico.setWhitelister(whitelister,{from: owner});
    await lwiico.addBaseWhitelist([buyerA, buyerB],{from: whitelister}) 

    increaseTime(1010) // time of the crowdasle
    lwiico.searchAndBid(1E18, 0, {from: buyerA, value:0.1E18});
    increaseTime(100)
    lwiico.searchAndBid(1E18, 0, {from: buyerB, value:0.2E18});
    var bidA = await lwiico.bids.call(1);
    var bidB = await lwiico.bids.call(2);

    assert.equal(bidA[5], buyerA, "Bid of buyerA is not properly saved");
    assert.equal(bidB[5], buyerB, "Bid of buyerB is not properly saved");

    await lwiico.removeBaseWhitelist([buyerA, buyerB],{from: whitelister}) 

    increaseTime(100)

    await expectThrow(lwiico.searchAndBid(1E18, 0, {from: buyerA, value:0.1E18}));
    await expectThrow(lwiico.searchAndBid(1E18, 0, {from: buyerB, value:0.2E18}));
  })    

  ////////////// REINFORCED

  it('Should be able to add to reinforced (only whitelister)', async () => {
    let startTestTime = web3.eth.getBlock('latest').timestamp
    let lwiico = await LWIICO.new(startTestTime+timeBeforeStart,fullBonusLength,partialWithdrawalLength, withdrawalLockUpLength,maxBonus,beneficiary,maximumBaseContribution,{from: owner})

    await lwiico.setWhitelister(whitelister,{from: owner});
    await lwiico.addReinforcedWhitelist([buyerA],{from: whitelister});
  })   

  it('Should not be able to add to reinforced (anyone else)', async () => {
    let startTestTime = web3.eth.getBlock('latest').timestamp
    let lwiico = await LWIICO.new(startTestTime+timeBeforeStart,fullBonusLength,partialWithdrawalLength, withdrawalLockUpLength,maxBonus,beneficiary,maximumBaseContribution,{from: owner})

    await lwiico.setWhitelister(whitelister,{from: owner});
    await expectThrow(lwiico.addReinforcedWhitelist([buyerA],{from: buyerA}));
  }) 

  it('Should be possible to send a lot ETH after reinforced whitelisting', async () => {
    let startTestTime = web3.eth.getBlock('latest').timestamp
    let lwiico = await LWIICO.new(startTestTime+timeBeforeStart,fullBonusLength,partialWithdrawalLength, withdrawalLockUpLength,maxBonus,beneficiary,maximumBaseContribution,{from: owner})

    await lwiico.setWhitelister(whitelister,{from: owner});
    await lwiico.addReinforcedWhitelist([buyerA],{from: whitelister}) 

    increaseTime(1010) // time of the crowdasle

    lwiico.searchAndBid(1E18, 0, {from: buyerA, value: maximumBaseContribution * 10}); // the way how JavaScript handles big numbers, cannot just do +1
  }) 

  it('Should be possible to send some ETH first and more after reinforced whitelisting', async () => {
    let startTestTime = web3.eth.getBlock('latest').timestamp
    let lwiico = await LWIICO.new(startTestTime+timeBeforeStart,fullBonusLength,partialWithdrawalLength, withdrawalLockUpLength,maxBonus,beneficiary,maximumBaseContribution,{from: owner})

    await lwiico.setWhitelister(whitelister,{from: owner});
    await lwiico.addBaseWhitelist([buyerA],{from: whitelister}) 

    increaseTime(1010) // time of the crowdasle

    lwiico.searchAndBid(1E18, 0, {from: buyerA, value: 1E18}); // the way how JavaScript handles big numbers, cannot just do +1

    await lwiico.addReinforcedWhitelist([buyerA],{from: whitelister});

    lwiico.searchAndBid(1E18, 0, {from: buyerA, value: 6E18}); // the way how JavaScript handles big numbers, cannot just do +1

    let buyerAContrib =  await lwiico.totalContrib.call(buyerA);

    assert.equal(buyerAContrib, 7E18);
  }) 

  it('Should be possible to add and remove multiple users at once to reinforced whitelist', async () => {
    let startTestTime = web3.eth.getBlock('latest').timestamp
    let lwiico = await LWIICO.new(startTestTime+timeBeforeStart,fullBonusLength,partialWithdrawalLength, withdrawalLockUpLength,maxBonus,beneficiary,maximumBaseContribution,{from: owner})

    await lwiico.setWhitelister(whitelister,{from: owner});
    await lwiico.addReinforcedWhitelist([buyerA, buyerB],{from: whitelister}) 

    increaseTime(1010) // time of the crowdasle
    lwiico.searchAndBid(1E18, 0, {from: buyerA, value:6E18});
    increaseTime(100)
    lwiico.searchAndBid(1E18, 0, {from: buyerB, value:7E18});
    var bidA = await lwiico.bids.call(1);
    var bidB = await lwiico.bids.call(2);

    assert.equal(bidA[5], buyerA, "Bid of buyerA is not properly saved");
    assert.equal(bidB[5], buyerB, "Bid of buyerB is not properly saved");

    await lwiico.removeReinforcedWhitelist([buyerA, buyerB],{from: whitelister}) 

    increaseTime(100)

    await expectThrow(lwiico.searchAndBid(1E18, 0, {from: buyerA, value:0.1E18}));
    await expectThrow(lwiico.searchAndBid(1E18, 0, {from: buyerB, value:0.2E18}));
  })  
  
});