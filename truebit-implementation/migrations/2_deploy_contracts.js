const Web3 = require('web3');
const web3 = new Web3();
const IICO = artifacts.require('IICO.sol');

module.exports = function(deployer, network, accounts) {
  const startTime = Math.floor(new Date().getTime() / 1000);
  const timeBeforeStart = 0; // in seconds
  const fullBonusLength = 5000;
  const partialWithdrawalLength = 2500;
  const withdrawalLockUpLength = 2500;
  const maxBonus = 2E8;
  // const noCap = 120000000E18;
  const beneficiary = accounts[1];
  const minValuation = 0;
  const maxValuation = web3.utils.toWei('100000', 'ether');
  const increment = web3.utils.toWei('0.5', 'ether');
  // const numBuckets = 200001;

  deployer.deploy(
    IICO,
    startTime + timeBeforeStart,
    fullBonusLength,
    partialWithdrawalLength,
    withdrawalLockUpLength,
    maxBonus,
    beneficiary,
    minValuation,
    maxValuation,
    increment,
    { from: accounts[0] }
  );
}
