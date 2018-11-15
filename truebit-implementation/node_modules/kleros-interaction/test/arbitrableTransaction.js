/* eslint-disable no-undef */ // Avoid the linter considering truffle elements as undef.
const { expectThrow, increaseTime } = require('../helpers/utils')
const ArbitrableTransaction = artifacts.require('./ArbitrableTransaction.sol')
const CentralizedArbitrator = artifacts.require('./CentralizedArbitrator.sol')

contract('ArbitrableTransaction', function (accounts) {
  let payer = accounts[0]
  let payee = accounts[1]
  let arbitrator = accounts[2]
  let other = accounts[3]
  let amount = 1000
  let timeout = 100
  let arbitrationFee = 20
  let gasPrice = 5000000000
  let contractHash = 0x6aa0bb2779ab006be0739900654a89f1f8a2d7373ed38490a7cbab9c9392e1ff

  // Constructor
  it('Should put 1000 wei in the contract', async () => {
    let arbitrableTransaction = await ArbitrableTransaction.new(0x0, contractHash, timeout, payee, 0x0, {from: payer, value: amount})
    assert.equal(web3.eth.getBalance(arbitrableTransaction.address), 1000, "The contract hasn't received the wei correctly.")

    let amountSending = await arbitrableTransaction.amount()
    assert.equal(amountSending.toNumber(), 1000, "The contract hasn't updated its amount correctly.")
  })

    // Pay
  it('Should pay the payee', async () => {
    let initialPayeeBalance = web3.eth.getBalance(payee)
    let arbitrableTransaction = await ArbitrableTransaction.new(0x0, contractHash, timeout, payee, 0x0, {from: payer, value: amount})
    await arbitrableTransaction.pay({from: payer})
    let newPayeeBalance = web3.eth.getBalance(payee)
    assert.equal(newPayeeBalance.toString(), initialPayeeBalance.plus(1000).toString(), "The payee hasn't been paid properly")
  })

  it('Should not pay the payee', async () => {
    let arbitrableTransaction = await ArbitrableTransaction.new(0x0, contractHash, timeout, payee, 0x0, {from: payer, value: amount})
    await expectThrow(arbitrableTransaction.pay({from: payee}))
  })

  // Reimburse
  it('Should reimburse 507 to the payer', async () => {
    let arbitrableTransaction = await ArbitrableTransaction.new(0x0, contractHash, timeout, payee, 0x0, {from: payer, value: amount})
    let payerBalanceBeforeReimbursment = web3.eth.getBalance(payer)
    await arbitrableTransaction.reimburse(507, {from: payee})
    let newPayerBalance = web3.eth.getBalance(payer)
    let newContractBalance = web3.eth.getBalance(arbitrableTransaction.address)
    let newAmount = await arbitrableTransaction.amount()

    assert.equal(newPayerBalance.toString(), payerBalanceBeforeReimbursment.plus(507).toString(), 'The payer has not been reimbursed correctly')
    assert.equal(newContractBalance.toNumber(), 493, 'Bad amount in the contract')
    assert.equal(newAmount.toNumber(), 493, 'Amount not updated correctly')
  })

  it('Should reimburse 1000 (all) to the payer', async () => {
    let arbitrableTransaction = await ArbitrableTransaction.new(0x0, contractHash, timeout, payee, 0x0, {from: payer, value: amount})
    let payerBalanceBeforeReimbursment = web3.eth.getBalance(payer)
    await arbitrableTransaction.reimburse(1000, {from: payee})
    let newPayerBalance = web3.eth.getBalance(payer)
    let newContractBalance = web3.eth.getBalance(arbitrableTransaction.address)
    let newAmount = await arbitrableTransaction.amount()

    assert.equal(newPayerBalance.toString(), payerBalanceBeforeReimbursment.plus(1000).toString(), 'The payer has not been reimbursed correctly')
    assert.equal(newContractBalance.toNumber(), 0, 'Bad amount in the contract')
    assert.equal(newAmount.toNumber(), 0, 'Amount not updated correctly')
  })

  it('Should fail if we try to reimburse more', async () => {
    let arbitrableTransaction = await ArbitrableTransaction.new(0x0, contractHash, timeout, payee, 0x0, {from: payer, value: amount})
    await expectThrow(arbitrableTransaction.reimburse(1003, {from: payee}))
  })

  it('Should fail if the payer to it', async () => {
    let arbitrableTransaction = await ArbitrableTransaction.new(0x0, contractHash, timeout, payee, 0x0, {from: payer, value: amount})
    await expectThrow(arbitrableTransaction.reimburse(1000, {from: payer}))
  })

  // executeRuling
  it('Should reimburse the payer (including arbitration fee) when the arbitrator decides so', async () => {
    let centralizedArbitrator = await CentralizedArbitrator.new(arbitrationFee, {from: arbitrator})
    let arbitrableTransaction = await ArbitrableTransaction.new(centralizedArbitrator.address, contractHash, timeout, payee, 0x0, {from: payer, value: amount})
    await arbitrableTransaction.payArbitrationFeeByPartyA({from: payer, value: arbitrationFee})
    await arbitrableTransaction.payArbitrationFeeByPartyB({from: payee, value: arbitrationFee})
    let payerBalanceBeforeReimbursment = web3.eth.getBalance(payer)
    await centralizedArbitrator.giveRuling(0, 1, {from: arbitrator})
    let newPayerBalance = web3.eth.getBalance(payer)
    assert.equal(newPayerBalance.toString(), payerBalanceBeforeReimbursment.plus(1020).toString(), 'The payer has not been reimbursed correctly')
  })

  it('Should pay the payee and reimburse him the arbitration fee when the arbitrator decides so', async () => {
    let centralizedArbitrator = await CentralizedArbitrator.new(arbitrationFee, {from: arbitrator})
    let arbitrableTransaction = await ArbitrableTransaction.new(centralizedArbitrator.address, contractHash, timeout, payee, 0x0, {from: payer, value: amount})

    await arbitrableTransaction.payArbitrationFeeByPartyA({from: payer, value: arbitrationFee})
    await arbitrableTransaction.payArbitrationFeeByPartyB({from: payee, value: arbitrationFee})
    let payeeBalanceBeforePay = web3.eth.getBalance(payee)
    await centralizedArbitrator.giveRuling(0, 2, {from: arbitrator})
    let newPayeeBalance = web3.eth.getBalance(payee)
    assert.equal(newPayeeBalance.toString(), payeeBalanceBeforePay.plus(1020).toString(), 'The payee has not been paid properly')
  })

  it('It should do nothing if the arbitrator decides so', async () => {
    let centralizedArbitrator = await CentralizedArbitrator.new(arbitrationFee, {from: arbitrator})
    let arbitrableTransaction = await ArbitrableTransaction.new(centralizedArbitrator.address, contractHash, timeout, payee, 0x0, {from: payer, value: amount})
    await arbitrableTransaction.payArbitrationFeeByPartyA({from: payer, value: arbitrationFee})
    await arbitrableTransaction.payArbitrationFeeByPartyB({from: payee, value: arbitrationFee})
    let payeeBalanceBeforePay = web3.eth.getBalance(payee)
    let payerBalanceBeforeReimbursment = web3.eth.getBalance(payer)
    await centralizedArbitrator.giveRuling(0, 0, {from: arbitrator})
    let newPayeeBalance = web3.eth.getBalance(payee)
    let newPayerBalance = web3.eth.getBalance(payer)
    assert.equal(newPayeeBalance.toString(), payeeBalanceBeforePay.toString(), "The payee got wei while it shouldn't")
    assert.equal(newPayerBalance.toString(), payerBalanceBeforeReimbursment.toString(), "The payer got wei while it shouldn't")
  })

  it('Should reimburse the payer in case of timeout of the payee', async () => {
    let centralizedArbitrator = await CentralizedArbitrator.new(arbitrationFee, {from: arbitrator})
    let arbitrableTransaction = await ArbitrableTransaction.new(centralizedArbitrator.address, contractHash, timeout, payee, 0x0, {from: payer, value: amount})
    await arbitrableTransaction.payArbitrationFeeByPartyA({from: payer, value: arbitrationFee})
    increaseTime(timeout + 1)
    let payerBalanceBeforeReimbursment = web3.eth.getBalance(payer)
    let tx = await arbitrableTransaction.timeOutByPartyA({from: payer, gasPrice: gasPrice})
    let txFee = tx.receipt.gasUsed * gasPrice
    let newPayerBalance = web3.eth.getBalance(payer)
    assert.equal(newPayerBalance.toString(), payerBalanceBeforeReimbursment.plus(1020).minus(txFee).toString(), 'The payer has not been reimbursed correctly')
  })

  it("Shouldn't work before timeout for the payer", async () => {
    let centralizedArbitrator = await CentralizedArbitrator.new(arbitrationFee, {from: arbitrator})
    let arbitrableTransaction = await ArbitrableTransaction.new(centralizedArbitrator.address, contractHash, timeout, payee, 0x0, {from: payer, value: amount})
    await expectThrow(arbitrableTransaction.timeOutByPartyA({from: payer, gasPrice: gasPrice}))
    await arbitrableTransaction.payArbitrationFeeByPartyA({from: payer, value: arbitrationFee})
    increaseTime(1)
    await expectThrow(arbitrableTransaction.timeOutByPartyA({from: payer, gasPrice: gasPrice}))
  })

  it('Should pay and reimburse the payee in case of timeout of the payer', async () => {
    let centralizedArbitrator = await CentralizedArbitrator.new(arbitrationFee, {from: arbitrator})
    let arbitrableTransaction = await ArbitrableTransaction.new(centralizedArbitrator.address, contractHash, timeout, payee, 0x0, {from: payer, value: amount})
    await arbitrableTransaction.payArbitrationFeeByPartyB({from: payee, value: arbitrationFee})
    increaseTime(timeout + 1)
    let payeeBalanceBeforeReimbursment = web3.eth.getBalance(payee)
    let tx = await arbitrableTransaction.timeOutByPartyB({from: payee, gasPrice: gasPrice})
    let txFee = tx.receipt.gasUsed * gasPrice
    let newPayeeBalance = web3.eth.getBalance(payee)
    assert.equal(newPayeeBalance.toString(), payeeBalanceBeforeReimbursment.plus(1020).minus(txFee).toString(), 'The payee has not been paid correctly')
  })

  it("Shouldn't work before timeout for the payee", async () => {
    let centralizedArbitrator = await CentralizedArbitrator.new(arbitrationFee, {from: arbitrator})
    let arbitrableTransaction = await ArbitrableTransaction.new(centralizedArbitrator.address, contractHash, timeout, payee, 0x0, {from: payer, value: amount})
    await expectThrow(arbitrableTransaction.timeOutByPartyB({from: payee, gasPrice: gasPrice}))
    await arbitrableTransaction.payArbitrationFeeByPartyB({from: payee, value: arbitrationFee})
    increaseTime(1)
    await expectThrow(arbitrableTransaction.timeOutByPartyB({from: payee, gasPrice: gasPrice}))
  })

  // submitEvidence
  it('Should create events when evidence is submitted by the payer', async () => {
    let centralizedArbitrator = await CentralizedArbitrator.new(arbitrationFee, {from: arbitrator})
    let arbitrableTransaction = await ArbitrableTransaction.new(centralizedArbitrator.address, contractHash, timeout, payee, 0x0, {from: payer, value: amount})
    await arbitrableTransaction.payArbitrationFeeByPartyA({from: payer, value: arbitrationFee})
    await arbitrableTransaction.payArbitrationFeeByPartyB({from: payee, value: arbitrationFee})
    let tx = await arbitrableTransaction.submitEvidence('ipfs:/X', {from: payer})
    assert.equal(tx.logs[0].event, 'Evidence')
    assert.equal(tx.logs[0].args._arbitrator, centralizedArbitrator.address)
    assert.equal(tx.logs[0].args._party, payer)
    assert.equal(tx.logs[0].args._evidence, 'ipfs:/X')
  })

  it('Should create events when evidence is submitted by the payee', async () => {
    let centralizedArbitrator = await CentralizedArbitrator.new(arbitrationFee, {from: arbitrator})
    let arbitrableTransaction = await ArbitrableTransaction.new(centralizedArbitrator.address, contractHash, timeout, payee, 0x0, {from: payer, value: amount})
    await arbitrableTransaction.payArbitrationFeeByPartyA({from: payer, value: arbitrationFee})
    await arbitrableTransaction.payArbitrationFeeByPartyB({from: payee, value: arbitrationFee})
    let tx = await arbitrableTransaction.submitEvidence('ipfs:/X', {from: payee})
    assert.equal(tx.logs[0].event, 'Evidence')
    assert.equal(tx.logs[0].args._arbitrator, centralizedArbitrator.address)
    assert.equal(tx.logs[0].args._party, payee)
    assert.equal(tx.logs[0].args._evidence, 'ipfs:/X')
  })

  it('Should fail if someone else try to submit', async () => {
    let centralizedArbitrator = await CentralizedArbitrator.new(arbitrationFee, {from: arbitrator})
    let arbitrableTransaction = await ArbitrableTransaction.new(centralizedArbitrator.address, contractHash, timeout, payee, 0x0, {from: payer, value: amount})
    await arbitrableTransaction.payArbitrationFeeByPartyA({from: payer, value: arbitrationFee})
    await arbitrableTransaction.payArbitrationFeeByPartyB({from: payee, value: arbitrationFee})
    await expectThrow(arbitrableTransaction.submitEvidence('ipfs:/X', {from: other}))
  })
})
