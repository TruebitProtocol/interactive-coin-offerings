const BasicMathLib = artifacts.require("./BasicMathLib.sol");
const Array256Lib = artifacts.require("./Array256Lib.sol");
const TokenLib = artifacts.require("./TokenLib.sol");
const CrowdsaleToken = artifacts.require("./CrowdsaleToken.sol");
const CrowdsaleLib = artifacts.require("./CrowdsaleLib.sol");
const InteractiveCrowdsaleLib = artifacts.require("./InteractiveCrowdsaleLib.sol");
// const InteractiveCrowdsaleTestContract = artifacts.require("./InteractiveCrowdsaleTestContract.sol");

module.exports = function(deployer, network, accounts) {
  deployer.deploy(BasicMathLib,{overwrite: false});
  deployer.deploy(Array256Lib, {overwrite: false});
  deployer.link(BasicMathLib, TokenLib);
  deployer.deploy(TokenLib, {overwrite: false});
  deployer.link(BasicMathLib,CrowdsaleLib);
  deployer.link(TokenLib,CrowdsaleLib);
  deployer.deploy(CrowdsaleLib, {overwrite: false});
  deployer.link(BasicMathLib,InteractiveCrowdsaleLib);
  deployer.link(TokenLib,InteractiveCrowdsaleLib);
  deployer.link(CrowdsaleLib, InteractiveCrowdsaleLib);
  deployer.deploy(InteractiveCrowdsaleLib, {overwrite:false});
  deployer.link(TokenLib,CrowdsaleToken);
  deployer.deploy(CrowdsaleToken, accounts[5], "Tester Token", "TST", 18, 20000000000000000000000000, false, {from:accounts[5]});

  // deployer.link(CrowdsaleLib, InteractiveCrowdsaleTestContract);
  // deployer.link(InteractiveCrowdsaleLib, InteractiveCrowdsaleTestContract);
  // deployer.deploy(InteractiveCrowdsaleTestContract, {overwrite:false});

  // if(network == "development"){
  //   deployer.link(BasicMathLib,TestCrowdsaleLib);
  //   deployer.link(TokenLib,TestCrowdsaleLib);
  //   deployer.deploy(TestCrowdsaleLib);
  //   deployer.link(BasicMathLib,TestInteractiveCrowdsaleLib);
  //   deployer.link(TokenLib,TestInteractiveCrowdsaleLib);
  //   deployer.link(TestCrowdsaleLib,TestInteractiveCrowdsaleLib);
  //   deployer.deploy(TestInteractiveCrowdsaleLib);
  //   deployer.link(TokenLib,CrowdsaleToken);
  //   deployer.link(TestCrowdsaleLib,TimeInteractiveCrowdsaleTestContract);
  //   deployer.link(TestInteractiveCrowdsaleLib, TimeInteractiveCrowdsaleTestContract);
  //   deployer.deploy(CrowdsaleToken, accounts[5], "Tester Token", "TST", 18, 20000000000000000000000000, false, {from:accounts[5]})
  //.then(function() {
  //     // configured to set the token price to $1.41, with a periodic increase in the address cap by 250%
  //     var purchaseData =[105,141,100,
  //                        115,200,100];
  //     return deployer.deploy(TimeInteractiveCrowdsaleTestContract, accounts[5], purchaseData, 29000, 1700000000, 10000000000000000, 120, 125, 50, CrowdsaleToken.address,{from:accounts[5]});
  //   });
  // }
};
