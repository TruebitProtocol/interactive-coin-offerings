/* eslint-disable no-undef */ // Avoid the linter considering truffle elements as undef.
const { expectThrow, increaseTime } = require('../helpers/utils')
const TwoPartyArbitrable = artifacts.require('./TwoPartyArbitrable.sol')
const CentralizedArbitrator = artifacts.require('./CentralizedArbitrator.sol')

contract('TwoPartyArbitrable', function (accounts) {
  let partyA = accounts[0]
  let partyB = accounts[1]
  let arbitrator = accounts[2]
  let other = accounts[3]
  let timeout = 100
  let arbitrationFee = 20
  let gasPrice = 5000000000
  let contractHash = 0x6aa0bb2779ab006be0739900654a89f1f8a2d7373ed38490a7cbab9c9392e1ff

  // Constructor
  it('Should set the correct values', async () => {
    let centralizedArbitrator = await CentralizedArbitrator.new(arbitrationFee, {from: arbitrator})
    let arbitrable = await TwoPartyArbitrable.new(centralizedArbitrator.address, contractHash, timeout, partyB, 0x08575, {from: partyA})
    assert.equal(await arbitrable.timeout(), timeout)
    assert.equal(await arbitrable.partyA(), partyA)
    assert.equal(await arbitrable.partyB(), partyB)
    assert.equal(await arbitrable.arbitratorExtraData(), 0x08575)
  })

  // payArbitrationFeeByPartyA and payArbitrationFeeByPartyB
  it('Should create a dispute when A and B pay', async () => {
    let centralizedArbitrator = await CentralizedArbitrator.new(arbitrationFee, {from: arbitrator})
    let arbitrable = await TwoPartyArbitrable.new(centralizedArbitrator.address, contractHash, timeout, partyB, 0x08575, {from: partyA})
    await arbitrable.payArbitrationFeeByPartyA({from: partyA, value: arbitrationFee})
    await arbitrable.payArbitrationFeeByPartyB({from: partyB, value: arbitrationFee})
    let dispute = await centralizedArbitrator.disputes(0)
    assert.equal(dispute[0], arbitrable.address, 'Arbitrable not set up properly')
    assert.equal(dispute[1].toNumber(), 2, 'Number of choices not set up properly')
    assert.equal(dispute[2].toNumber(), 20, 'Fee not set up properly')
  })

  it('Should create a dispute when B and A pay', async () => {
    let centralizedArbitrator = await CentralizedArbitrator.new(arbitrationFee, {from: arbitrator})
    let arbitrable = await TwoPartyArbitrable.new(centralizedArbitrator.address, contractHash, timeout, partyB, 0x08575, {from: partyA})
    await arbitrable.payArbitrationFeeByPartyB({from: partyB, value: arbitrationFee})
    await arbitrable.payArbitrationFeeByPartyA({from: partyA, value: arbitrationFee})
    let dispute = await centralizedArbitrator.disputes(0)
    assert.equal(dispute[0], arbitrable.address, 'Arbitrable not set up properly')
    assert.equal(dispute[1].toNumber(), 2, 'Number of choices not set up properly')
    assert.equal(dispute[2].toNumber(), 20, 'Fee not set up properly')
  })

  it('Should not be possible to pay less', async () => {
    let centralizedArbitrator = await CentralizedArbitrator.new(arbitrationFee, {from: arbitrator})
    let arbitrable = await TwoPartyArbitrable.new(centralizedArbitrator.address, contractHash, timeout, partyB, 0x08575, {from: partyA})
    await expectThrow(arbitrable.payArbitrationFeeByPartyB({from: partyB, value: arbitrationFee - 1}))
    await expectThrow(arbitrable.payArbitrationFeeByPartyA({from: partyA, value: arbitrationFee - 1}))
    await arbitrable.payArbitrationFeeByPartyB({from: partyB, value: arbitrationFee})
    await expectThrow(arbitrable.payArbitrationFeeByPartyA({from: partyA, value: arbitrationFee - 1}))
    await arbitrable.payArbitrationFeeByPartyA({from: partyA, value: arbitrationFee})
  })

  // timeOutByPartyA and timeOutByPartyB
  it('Should reimburse partyA in case of timeout of partyB', async () => {
    let centralizedArbitrator = await CentralizedArbitrator.new(arbitrationFee, {from: arbitrator})
    let arbitrable = await TwoPartyArbitrable.new(centralizedArbitrator.address, contractHash, timeout, partyB, 0x0, {from: partyA})
    await arbitrable.payArbitrationFeeByPartyA({from: partyA, value: arbitrationFee})
    increaseTime(timeout + 1)
    let partyABalanceBeforeReimbursment = web3.eth.getBalance(partyA)
    let tx = await arbitrable.timeOutByPartyA({from: partyA, gasPrice: gasPrice})
    let txFee = tx.receipt.gasUsed * gasPrice
    let newpartyABalance = web3.eth.getBalance(partyA)
    assert.equal(newpartyABalance.toString(), partyABalanceBeforeReimbursment.plus(20).minus(txFee).toString(), 'partyA has not been reimbursed correctly')
  })

  it("Shouldn't work before timeout for partyA", async () => {
    let centralizedArbitrator = await CentralizedArbitrator.new(arbitrationFee, {from: arbitrator})
    let arbitrable = await TwoPartyArbitrable.new(centralizedArbitrator.address, contractHash, timeout, partyB, 0x0, {from: partyA})
    await expectThrow(arbitrable.timeOutByPartyA({from: partyA, gasPrice: gasPrice}))
    await arbitrable.payArbitrationFeeByPartyA({from: partyA, value: arbitrationFee})
    increaseTime(1)
    await expectThrow(arbitrable.timeOutByPartyA({from: partyA, gasPrice: gasPrice}))
  })

  it('Should reimburse partyB in case of timeout of partyA', async () => {
    let centralizedArbitrator = await CentralizedArbitrator.new(arbitrationFee, {from: arbitrator})
    let arbitrable = await TwoPartyArbitrable.new(centralizedArbitrator.address, contractHash, timeout, partyB, 0x0, {from: partyA})
    await arbitrable.payArbitrationFeeByPartyB({from: partyB, value: arbitrationFee})
    increaseTime(timeout + 1)
    let partyBBalanceBeforeReimbursment = web3.eth.getBalance(partyB)
    let tx = await arbitrable.timeOutByPartyB({from: partyB, gasPrice: gasPrice})
    let txFee = tx.receipt.gasUsed * gasPrice
    let newpartyBBalance = web3.eth.getBalance(partyB)
    assert.equal(newpartyBBalance.toString(), partyBBalanceBeforeReimbursment.plus(20).minus(txFee).toString(), 'partyB has not been reimbursed correctly')
  })

  it("Shouldn't work before timeout for partyB", async () => {
    let centralizedArbitrator = await CentralizedArbitrator.new(arbitrationFee, {from: arbitrator})
    let arbitrable = await TwoPartyArbitrable.new(centralizedArbitrator.address, contractHash, timeout, partyB, 0x0, {from: partyA})
    await expectThrow(arbitrable.timeOutByPartyB({from: partyB, gasPrice: gasPrice}))
    await arbitrable.payArbitrationFeeByPartyB({from: partyB, value: arbitrationFee})
    increaseTime(1)
    await expectThrow(arbitrable.timeOutByPartyB({from: partyB, gasPrice: gasPrice}))
  })

  // submitEvidence
  it('Should create events when evidence is submitted by partyA', async () => {
    let centralizedArbitrator = await CentralizedArbitrator.new(arbitrationFee, {from: arbitrator})
    let arbitrable = await TwoPartyArbitrable.new(centralizedArbitrator.address, contractHash, timeout, partyB, 0x0, {from: partyA})
    await arbitrable.payArbitrationFeeByPartyA({from: partyA, value: arbitrationFee})
    await arbitrable.payArbitrationFeeByPartyB({from: partyB, value: arbitrationFee})
    let tx = await arbitrable.submitEvidence('ipfs:/X', {from: partyA})
    assert.equal(tx.logs[0].event, 'Evidence')
    assert.equal(tx.logs[0].args._arbitrator, centralizedArbitrator.address)
    assert.equal(tx.logs[0].args._party, partyA)
    assert.equal(tx.logs[0].args._evidence, 'ipfs:/X')
  })

  it('Should create events when evidence is submitted by partyB', async () => {
    let centralizedArbitrator = await CentralizedArbitrator.new(arbitrationFee, {from: arbitrator})
    let arbitrable = await TwoPartyArbitrable.new(centralizedArbitrator.address, contractHash, timeout, partyB, 0x0, {from: partyA})
    await arbitrable.payArbitrationFeeByPartyA({from: partyA, value: arbitrationFee})
    await arbitrable.payArbitrationFeeByPartyB({from: partyB, value: arbitrationFee})
    let tx = await arbitrable.submitEvidence('ipfs:/X', {from: partyB})
    assert.equal(tx.logs[0].event, 'Evidence')
    assert.equal(tx.logs[0].args._arbitrator, centralizedArbitrator.address)
    assert.equal(tx.logs[0].args._party, partyB)
    assert.equal(tx.logs[0].args._evidence, 'ipfs:/X')
  })

  it('Should fail if someone else tries to submit', async () => {
    let centralizedArbitrator = await CentralizedArbitrator.new(arbitrationFee, {from: arbitrator})
    let arbitrable = await TwoPartyArbitrable.new(centralizedArbitrator.address, contractHash, timeout, partyB, 0x0, {from: partyA})
    await arbitrable.payArbitrationFeeByPartyA({from: partyA, value: arbitrationFee})
    await arbitrable.payArbitrationFeeByPartyB({from: partyB, value: arbitrationFee})
    await expectThrow(arbitrable.submitEvidence('ipfs:/X', {from: other}))
  })

  // appeal
  // TODO: When we'll have a contract using appeal.

  // executeRuling
  it('Should reimburse the partyA (including arbitration fee) when the arbitrator decides so', async () => {
    let centralizedArbitrator = await CentralizedArbitrator.new(arbitrationFee, {from: arbitrator})
    let arbitrable = await TwoPartyArbitrable.new(centralizedArbitrator.address, contractHash, timeout, partyB, 0x0, {from: partyA})
    await arbitrable.payArbitrationFeeByPartyA({from: partyA, value: arbitrationFee})
    await arbitrable.payArbitrationFeeByPartyB({from: partyB, value: arbitrationFee})
    let partyABalanceBeforeReimbursment = web3.eth.getBalance(partyA)
    await centralizedArbitrator.giveRuling(0, 1, {from: arbitrator})
    let newPartyABalance = web3.eth.getBalance(partyA)
    assert.equal(newPartyABalance.toString(), partyABalanceBeforeReimbursment.plus(20).toString(), 'partyA has not been reimbursed correctly')
  })

  it('Should pay the partyB and reimburse him the arbitration fee when the arbitrator decides so', async () => {
    let centralizedArbitrator = await CentralizedArbitrator.new(arbitrationFee, {from: arbitrator})
    let arbitrable = await TwoPartyArbitrable.new(centralizedArbitrator.address, contractHash, timeout, partyB, 0x0, {from: partyA})
    await arbitrable.payArbitrationFeeByPartyA({from: partyA, value: arbitrationFee})
    await arbitrable.payArbitrationFeeByPartyB({from: partyB, value: arbitrationFee})
    let partyBBalanceBeforePay = web3.eth.getBalance(partyB)
    await centralizedArbitrator.giveRuling(0, 2, {from: arbitrator})
    let newPartyBBalance = web3.eth.getBalance(partyB)
    assert.equal(newPartyBBalance.toString(), partyBBalanceBeforePay.plus(20).toString(), 'partyB has not been reimbursed correctly')
  })

  it('It should do nothing if the arbitrator decides so', async () => {
    let centralizedArbitrator = await CentralizedArbitrator.new(arbitrationFee, {from: arbitrator})
    let arbitrable = await TwoPartyArbitrable.new(centralizedArbitrator.address, contractHash, timeout, partyB, 0x0, {from: partyA})
    await arbitrable.payArbitrationFeeByPartyA({from: partyA, value: arbitrationFee})
    await arbitrable.payArbitrationFeeByPartyB({from: partyB, value: arbitrationFee})
    let partyBBalanceBeforePay = web3.eth.getBalance(partyB)
    let partyABalanceBeforeReimbursment = web3.eth.getBalance(partyA)
    await centralizedArbitrator.giveRuling(0, 0, {from: arbitrator})
    let newPartyBBalance = web3.eth.getBalance(partyB)
    let newPartyABalance = web3.eth.getBalance(partyA)
    assert.equal(newPartyBBalance.toString(), partyBBalanceBeforePay.toString(), "partyB got wei while it shouldn't")
    assert.equal(newPartyABalance.toString(), partyABalanceBeforeReimbursment.toString(), "partyA got wei while it shouldn't")
  })
})
