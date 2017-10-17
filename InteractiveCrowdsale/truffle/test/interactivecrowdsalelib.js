const TimeInteractiveCrowdsaleTestContract = artifacts.require("TimeInteractiveCrowdsaleTestContract");
const CrowdsaleToken = artifacts.require("CrowdsaleToken");

contract('CrowdsaleToken', (accounts) => {
  it("should properly initialize token data", async () => {
    
    const c = await CrowdsaleToken.deployed();
    const name = await c.name.call();
    const symbol = await c.symbol.call();
    const decimals = await c.decimals.call();
    const totalSupply = await c.totalSupply.call();

    assert.equal(name.valueOf(), 'Tester Token', "Name should be set to Tester Token.");
    assert.equal(symbol.valueOf(), 'TST', "Symbol should be set to TST.");
    assert.equal(decimals.valueOf(), 18, "Decimals should be set to 18.");
    assert.equal(totalSupply.valueOf(), 20000000000000000000000000, "Total supply should reflect 20000000000000000000.");
  });
});

/*************************************************************************



**************************************************************************/

contract('TimeInteractiveCrowdsaleTestContract', (accounts) => {
  it("should initialize the interactive crowdsale contract data", async () => {
    const c = await TimeInteractiveCrowdsaleTestContract.deployed();
    const owner = await c.getOwner.call();
    const tokensPerEth = await c.getTokensPerEth.call();
    const capAmount = await c.getCapAmount.call();
    const startTime = await c.getStartTime.call();
    const endTime = await c.getEndTime.call();
    const exchangeRate = await c.getExchangeRate.call();
    const totalValuation = await c.getTotalValuation.call();
    const percentBurn = await c.getPercentBurn.call();
    const endWithdrawlTime = await c.getEndWithdrawlTime.call();

    assert.equal(owner.valueOf(), accounts[5], "Owner should be set to accounts[5].");
    assert.equal(tokensPerEth.valueOf(), 206, "Symbol should be set to TST.");
    assert.equal(capAmount.valueOf(), 5.8621e+22, "capAmount should be 5.8621e+22");
    assert.equal(startTime.valueOf(), 105, "Start time should be 105");
    assert.equal(endTime.valueOf(),125, "end time should be 125");
    assert.equal(exchangeRate.valueOf(),29000, "exchangeRate should be 29000");
    assert.equal(totalValuation.valueOf(), 0, "total valuation of the crowdsale should be zero");
    assert.equal(percentBurn.valueOf(), 50, "Percentage of Tokens to burn after the crowdsale should be 50!");
    assert.equal(endWithdrawlTime.valueOf(), 120, "Time to end manual bid withdrawls should be 120!");

  });


  it("should deny non-owner transactions pre-crowdsale, set exchange rate", async () => {
    const c = await TimeInteractiveCrowdsaleTestContract.deployed();

    const t = await CrowdsaleToken.deployed();

    await t.transfer(c.contract.address,12000000000000000000000000,{from:accounts[5]});
    var tokenbalance = await t.balanceOf.call(c.contract.address);
    assert.equal(tokenbalance.valueOf(), 12000000000000000000000000,  "crowdsale's token balance should be 20000000000000000000000000!");

    var exch_succ = await c.setTokenExchangeRate(30000,103, {from:accounts[5]});
    assert.equal(exch_succ.logs[0].args.Msg, "Owner has sent the exchange Rate and tokens bought per ETH!", "Should give success message that the exchange rate was set.");
      
    exch_succ = await c.setTokenExchangeRate(30000,101, {from:accounts[5]});
    assert.equal(exch_succ.logs[0].args.Msg, 'Owner can only set the exchange rate once up to three days before the sale!', "Should give an error message that timing for setting the exchange rate is wrong.");
    
    var exchange = await c.getExchangeRate.call();
    assert.equal(exchange.valueOf(), 30000, "exchangeRate should have been set to 30000!");

    var tokensPerEth = await c.getTokensPerEth.call();
    assert.equal(tokensPerEth.valueOf(), 213, "tokensPerEth should have been set to 213!");

    ret = await c.getTokenPurchase.call(accounts[0]);
    assert.equal(ret.valueOf(), 0, "accounts0 token purchase should be 0!");

  });

  it("should accept bids during the sale, place them in a sorted list, and allow manual withdrawls", async () => {
    const c = await TimeInteractiveCrowdsaleTestContract.deployed();    

    await c.submitBid(1e22,0, 106, {from:accounts[0], value: 1e20});

    var token_purchase = await c.getTokenPurchase.call(accounts[0]);
    assert.equal(token_purchase.valueOf(), 2.13e22, "accounts0 token purchase should be 2.13e22!");

    var valuation = await c.getPersonalValuation.call(accounts[0]);
    assert.equal(valuation.valueOf(), 1e22, "accounts[0]'s personal valuation should be 1e22");

    var atVal = await c.isBidderAtValuation.call(1e22,accounts[0]);
    assert.equal(atVal,true, "accounts[0] should be listed at the 1e22 personal valuation");

    var totalVal = await c.getTotalValuation.call();
    assert.equal(totalVal.valueOf(),1e20, "The total valuation of the sale should be 1e20");

    await c.withdrawBid(107, {from:accounts[0]});

    var token_purchase = await c.getTokenPurchase.call(accounts[0]);
    assert.equal(token_purchase.valueOf(), 0, "accounts0 token purchase should be 0!");

    var valuation = await c.getPersonalValuation.call(accounts[0]);
    assert.equal(valuation.valueOf(), 0, "accounts[0]'s personal valuation should be 0");

    var atVal = await c.isBidderAtValuation.call(1e22,accounts[0]);
    assert.equal(atVal,false, "accounts[0] should not be listed at the 1e22 personal valuation");

    var totalVal = await c.getTotalValuation.call();
    assert.equal(totalVal.valueOf(),0, "The total valuation of the sale should be 0");


  });

  it("should accept bids during the sale, place them in a sorted list, and automatically remove minimal personal valuations", async () => {
    const c = await TimeInteractiveCrowdsaleTestContract.deployed();    

    await c.submitBid(1e22,0, 121, {from:accounts[0], value: 1e20});

    // var token_purchase = await c.getTokenPurchase.call(accounts[0]);
    // assert.equal(token_purchase.valueOf(), 2.13e22, "accounts0 token purchase should be 2.13e22!");

    var valuation = await c.getPersonalValuation.call(accounts[0]);
    assert.equal(valuation.valueOf(), 1e22, "accounts[0]'s personal valuation should be 1e22");

    var atVal = await c.isBidderAtValuation.call(1e22,accounts[0]);
    assert.equal(atVal,true, "accounts[0] should be listed at the 1e22 personal valuation");

    var totalVal = await c.getTotalValuation.call();
    assert.equal(totalVal.valueOf(),1e20, "The total valuation of the sale should be 1e20");

    await c.submitBid(2e22,0, 121, {from:accounts[1], value: 5e21});

    // token_purchase = await c.getTokenPurchase.call(accounts[1]);
    // assert.equal(token_purchase.valueOf(), 1.065E24, "accounts1 token purchase should be 1.065E24!");

    valuation = await c.getPersonalValuation.call(accounts[1]);
    assert.equal(valuation.valueOf(), 2e22, "accounts[1]'s personal valuation should be 2e22");

    atVal = await c.isBidderAtValuation.call(2e22,accounts[1]);
    assert.equal(atVal,true, "accounts[1] should be listed at the 2e22 personal valuation");

    totalVal = await c.getTotalValuation.call();
    assert.equal(totalVal.valueOf(),5.1e21, "The total valuation of the sale should be 5.1e21");

    valuation = await c.getPersonalValuation.call(accounts[0]);
    assert.equal(valuation.valueOf(), 1e22, "accounts[0]'s personal valuation should be 1e22");
    atVal = await c.isBidderAtValuation.call(1e22,accounts[0]);
    assert.equal(atVal,true, "accounts[0] should be listed at the 1e22 personal valuation");

    await c.submitBid(2e22, 0, 121, {from:accounts[2], value: 6e21});

    valuation = await c.getPersonalValuation.call(accounts[2]);
    assert.equal(valuation.valueOf(), 2e22, "accounts[2]'s personal valuation should be 2e22");

    atVal = await c.isBidderAtValuation.call(2e22,accounts[2]);
    assert.equal(atVal,true, "accounts[2] should be listed at the 2e22 personal valuation");

    totalVal = await c.getTotalValuation.call();
    assert.equal(totalVal.valueOf(),1.1e22, "The total valuation of the sale should be 1.1e22");

    valuation = await c.getPersonalValuation.call(accounts[0]);
    assert.equal(valuation.valueOf(), 0, "accounts[0]'s personal valuation should be 0");
    atVal = await c.isBidderAtValuation.call(1e22,accounts[0]);
    assert.equal(atVal,false, "accounts[0] should have been removed from the 1e22 personal valuation");

    await c.submitBid(2.5e22,0, 121, {from:accounts[3], value: 2e21});

    valuation = await c.getPersonalValuation.call(accounts[3]);
    assert.equal(valuation.valueOf(), 2.5e22, "accounts[3]'s personal valuation should be 2.5e22");

    atVal = await c.isBidderAtValuation.call(2.5e22,accounts[3]);
    assert.equal(atVal,true, "accounts[3] should be listed at the 2.5e22 personal valuation");

    totalVal = await c.getTotalValuation.call();
    assert.equal(totalVal.valueOf(),1.3e22, "The total valuation of the sale should be 1.1e22");

    await c.submitBid(3e22,0, 121, {from:accounts[4], value: 4e21});

    valuation = await c.getPersonalValuation.call(accounts[4]);
    assert.equal(valuation.valueOf(), 3e22, "accounts[4]'s personal valuation should be 3e22");

    atVal = await c.isBidderAtValuation.call(3e22,accounts[4]);
    assert.equal(atVal,true, "accounts[3] should be listed at the 3e22 personal valuation");

    totalVal = await c.getTotalValuation.call();
    assert.equal(totalVal.valueOf(),1.7e22, "The total valuation of the sale should be 1.1e22");

    await c.submitBid(27000000000000000000000,0, 122, {from:accounts[0], value: 5e21});

    valuation = await c.getPersonalValuation.call(accounts[0]);
    assert.equal(valuation.valueOf(), 2.7e22, "accounts[0]'s personal valuation should be 2.7e22");

    atVal = await c.isBidderAtValuation.call(2.7e22,accounts[0]);
    assert.equal(atVal,true, "accounts[0] should be listed at the 2.7e22 personal valuation");

    totalVal = await c.getTotalValuation.call();
    assert.equal(totalVal.valueOf(),1.991E22, "The total valuation of the sale should be 1.991e22");

    var contribution = await c.getContribution.call(accounts[1]);
    assert.equal(contribution.valueOf(),4.05E21, "accounts1's contribution should have been decreased!");

    contribution = await c.getContribution.call(accounts[2]);
    assert.equal(contribution.valueOf(),4.86E21, "accounts2's contribution should have been decreased!");
  });
});

//   it("should deny invalid payments during the sale and accept payments that are reflected in token balance", function() {
//     var c;

//     return TimeEvenDistroCrowdsaleTestContract.deployed().then(function(instance) {
//       c = instance;

//       return c.crowdsaleActive.call(106);
//     }).then(function(ret) {
//       assert.equal(ret.valueOf(), true, "Crowsale should be active!");
//       return c.crowdsaleEnded.call(106);
//     }).then(function(ret) {
//       assert.equal(ret.valueOf(), false, "Crowsale should not be ended!");
//       return c.registerUser(accounts[4],106,{from:accounts[5]});
//     }).then(function(ret) {
//       assert.equal(ret.logs[0].args.Msg, 'Cannot register users within 3 days of the sale!', "Should give an error that users cannot be registered close to the sale");
//       return c.unregisterUser(accounts[1],106,{from:accounts[5]});
//     }).then(function(ret) {
//       assert.equal(ret.logs[0].args.Msg, 'Cannot unregister users within 3 days of the sale!', "Should give an error that users cannot be unregistered close to the sale");
//       return c.getNumRegistered.call();
//     }).then(function(ret) {
//       assert.equal(ret.valueOf(),4,"Four Users should be registered!");
//       return c.withdrawTokens(106,{from:accounts[0]});
//     }).then(function(ret) {
//       assert.equal(ret.logs[0].args.Msg, 'Sender has no tokens to withdraw!', "should give message that the sender cannot withdraw any tokens");
//       return c.withdrawLeftoverWei({from:accounts[3]});
//     }).then(function(ret) {
//       assert.equal(ret.logs[0].args.Msg, 'Sender has no extra wei to withdraw!', "should give message that the sender cannot withdraw any wei");
//       return c.withdrawLeftoverWei({from:accounts[5]});
//     }).then(function(ret) {
//       assert.equal(ret.logs[0].args.Msg, 'Sender has no extra wei to withdraw!', "should give message that the sender cannot withdraw any wei");
//       return c.receivePurchase(106,{from:accounts[0]});
//     }).then(function(ret) {
//       assert.equal(ret.logs[0].args.Msg, 'Invalid Purchase! Check send time and amount of ether.', "should give an error message since no ether was sent");
//       return c.receivePurchase(106,{value:39990000000000000000,from:accounts[0]});
//     }).then(function(ret) {
//       return c.getLeftoverWei.call(accounts[0]);
//     }).then(function(ret) {
//       return c.receivePurchase(106,{value:10000000000000000,from:accounts[0]});
//     }).then(function(ret) {
//       return c.getLeftoverWei.call(accounts[0]);
//     }).then(function(ret) {
//       assert.equal(ret.valueOf(),0, "should show that accounts0 has 0 leftover wei");
//       //assert.equal(ret.logs[0].args.Msg, 'Sender has no extra wei to withdraw!', "should give message that the sender cannot withdraw any wei");
//       return c.getContribution.call(accounts[0], {from:accounts[0]});
//     }).then(function(ret) {
//       assert.equal(ret.valueOf(),40000000000000000000, "accounts[0] amount of wei contributed should be 40000000000000000000 wei");
//       return c.getTokenPurchase.call(accounts[0]);
//     }).then(function(ret) {
//       assert.equal(ret.valueOf(), 8520000000000000000000, "accounts[0] tokens purchased should be 8520000000000000000000");
//       return c.receivePurchase(108,{value: 40000000000000000000000, from:accounts[0]});
//     }).then(function(ret) {
//       assert.equal(ret.logs[0].args.Msg, "Cap Per Address has been exceeded! Please withdraw leftover Wei!","should show message that the addressCap was exceeded");
//       return c.receivePurchase(108,{value: 40000000000000000000, from:accounts[4]});
//     }).then(function(ret) {
//       assert.equal(ret.logs[0].args.Msg, "Buyer is not registered for the sale!", "should give error message that the buyer is not registered for the sale");
//       return c.receivePurchase(108,{value: 40000000000000000000000, from:accounts[1]});
//     }).then(function(ret) {
//       assert.equal(ret.logs[0].args.Msg, "Cap Per Address has been exceeded! Please withdraw leftover Wei!","should show message that the addressCap was exceeded");
//       return c.getLeftoverWei.call(accounts[0]);
//     }).then(function(ret) {
//       assert.equal(ret.valueOf(),2.538475E22,"accounts0 LeftoverWei should be 2.538475E22");
//       return c.getLeftoverWei.call(accounts[1]);
//     }).then(function(ret) {
//       assert.equal(ret.valueOf(),2.534475E22,"accounts1 LeftoverWei should be 2.534475E22");
//       return c.getTokensPerEth.call();
//     }).then(function(ret) {
//       assert.equal(ret.valueOf(), 213, "tokensPerEth should stay the same!");
//       return c.getContribution.call(accounts[0], {from:accounts[0]});
//     }).then(function(ret) {
//       assert.equal(ret.valueOf(),14655250000000000000000, "accounts[0] amount of wei contributed should be 14655250000000000000000 wei");
//       return c.getContribution.call(accounts[1], {from:accounts[1]});
//     }).then(function(ret) {
//       assert.equal(ret.valueOf(),14655250000000000000000, "accounts[1] amount of wei contributed should be 14655250000000000000000 wei");
//       return c.getTokenPurchase.call(accounts[0],{from:accounts[0]});
//     }).then(function(ret) {
//       assert.equal(ret.valueOf(),3.12156825e+24, "accounts0 amount of tokens purchased should be 3.12156825e+24 tokens");
//       return c.getTokenPurchase.call(accounts[1],{from:accounts[1]});
//     }).then(function(ret) {
//       assert.equal(ret.valueOf(),3.12156825e+24, "accounts1 amount of tokens purchased should be 3.12156825e+24 tokens");
//       return c.receivePurchase(111, {value: 40000000000000000000, from:accounts[0]});
//     }).then(function(ret) {
//       assert.equal(ret.logs[0].args.Msg, "Address cap has increased!", "Should give message the the address cap has increased!");
//       return c.getAddressCap.call();
//     }).then(function(ret) {
//       assert.equal(ret.valueOf(),3.6638125E22, "Address cap should be 250% of what is what before. now 3.6638125E22");
//       return c.getContribution.call(accounts[0],{from:accounts[0]});
//     }).then(function(ret) {
//       assert.equal(ret.valueOf(),1.469525E22, "accounts[0] amount of wei contributed should be 1.469525E22 wei");
//       return c.getTokenPurchase.call(accounts[0],{from:accounts[0]});
//     }).then(function(ret) {
//       assert.equal(ret.valueOf(),3.13008825E24, "accounts[0] amount of tokens purchased should be 3.13008825E24 tokens");
//       return c.setTokenExchangeRate(30000,112, {from:accounts[5]});
//     }).then(function(ret) {
//       assert.equal(ret.logs[0].args.Msg, 'Owner can only set the exchange rate once up to three days before the sale!', "Should give an error message that timing for setting the exchange rate is wrong.");
//       return c.setTokenExchangeRate(30000,112, {from:accounts[4]});
//     }).then(function(ret) {
//       assert.equal(ret.logs[0].args.Msg, 'Owner can only set the exchange rate!', "Should give an error message that timing for setting the exchange rate is wrong.");
//       return c.receivePurchase(112,{value: 120000000000000000000, from: accounts[5]});
//     }).then(function(ret) {
//       assert.equal(ret.logs[0].args.Msg, 'Owner cannot send ether to contract', "should give an error message since the owner cannot donate to its own contract");
//       return c.withdrawOwnerEth(112,{from: accounts[5]});
//     }).then(function(ret) {
//       assert.equal(ret.logs[0].args.Msg, 'Cannot withdraw owner ether until after the sale', "Should give an error that sale ether cannot be withdrawn till after the sale");
//       return c.getContribution.call(accounts[5]);
//     }).then(function(ret) {
//       assert.equal(ret.valueOf(),0,"accounts[5] (owner) ether contribution should be 0");
//       return c.receivePurchase(114, {value: 500000000000000111111, from:accounts[3]});
//     }).then(function(ret) {
//       return c.getContribution.call(accounts[3],{from:accounts[3]});
//     }).then(function(ret) {
//       assert.equal(ret.valueOf(),500000000000000111111, "accounts[3] amount of wei contributed should be 50000000000000111111 wei");
//       return c.getTokenPurchase.call(accounts[3],{from:accounts[3]});
//     }).then(function(ret) {
//       assert.equal(ret.valueOf(),1.065000000000000213e+23, "accounts[3] amount of tokens purchased should be 1.065000000000000213e+23 tokens");
//       return c.withdrawTokens(116,{from:accounts[0]});
//     }).then(function(ret) {
//       return c.getTokenPurchase.call(accounts[0],{from:accounts[0]});
//     }).then(function(ret) {
//       assert.equal(ret.valueOf(),0,"accounts[0] should have withdrawn all tokens and should now have zero in the contract");
//       return c.withdrawTokens(104, {from:accounts[5]});
//     }).then(function(ret) {
//       assert.equal(ret.logs[0].args.Msg, "Owner cannot withdraw extra tokens until after the sale!", "Should give error message that the owner cannot withdraw any extra tokens yet");
//       return c.setTokenExchangeRate(100, 116, {from:accounts[5]});
//     }).then(function(ret) {
//       assert.equal(ret.logs[0].args.Msg, 'Owner can only set the exchange rate once up to three days before the sale!', "Should give an error message that timing for setting the exchange rate is wrong.");
//       return c.receivePurchase(121, {value: 56670000000000000000000, from: accounts[3]});
//     }).then(function(ret) {
//       assert.equal(ret.logs[0].args.Msg, 'buyer ether sent exceeds cap of ether to be raised!', "should give error message that the raise cap has been exceeded");
//       return c.receivePurchase(121, {value: 60000000000000000000000, from: accounts[3]});
//     }).then(function(ret) {
//       assert.equal(ret.logs[0].args.Msg, 'buyer ether sent exceeds cap of ether to be raised!', "should give error message that the raise cap has been exceeded");
//       return c.receivePurchase(122, {value: 500000000000000100000, from:accounts[1]});
//     }).then(function(ret) {
//       return c.getAddressCap.call();
//     }).then(function(ret) {
//       console.log(ret.valueOf());
//       //assert.equal(ret.valueOf(),2.2898828125E23, "new addressCap should be 2.2898828125E23");
//       return c.getContribution.call(accounts[1],{from:accounts[4]});
//     }).then(function(ret) {
//       assert.equal(ret.valueOf(),1.515525E22, "accounts[1] amount of wei contributed should be 1.515525E22 wei");
//       return c.getTokenPurchase.call(accounts[1],{from:accounts[4]});
//     }).then(function(ret) {
//       assert.equal(ret.valueOf(),3.22806825E24, "accounts[1] amount of tokens purchased should be 3.22806825E24 tokens");
//       return c.getLeftoverWei.call(accounts[1],{from:accounts[4]});
//     }).then(function(ret) {
//       assert.equal(ret.valueOf(),2.534475e+22, "accounts[1] leftover wei should be 2.534475e+22");
//       return c.withdrawLeftoverWei({from:accounts[1]});
//     }).then(function(ret) {
//       return c.getLeftoverWei.call(accounts[1],{from:accounts[4]});
//     }).then(function(ret) {
//       assert.equal(ret.valueOf(),0, "accounts[4] should have no leftover wei because it was just withdrawn");
//     });
//   });
// //});



//   ///********************************************************
//   //  AFTER SALE
//   //******************************************************
//   it("should deny payments after the sale and allow users to withdraw their tokens/owner to withdraw ether", function() {
//     var c;

//     return TimeEvenDistroCrowdsaleTestContract.deployed().then(function(instance) {
//       c = instance;
//       return c.crowdsaleActive.call(126);
//     }).then(function(ret) {
//       assert.equal(ret.valueOf(), false, "Crowsale should not be active!");
//       return c.crowdsaleEnded.call(126);
//     }).then(function(ret) {
//       assert.equal(ret.valueOf(), true, "Crowsale should be ended!");
//       return c.registerUser(accounts[4],106,{from:accounts[5]});
//     }).then(function(ret) {
//       assert.equal(ret.logs[0].args.Msg, 'Cannot register users within 3 days of the sale!', "Should give an error that users cannot be registered close to the sale");
//       return c.unregisterUser(accounts[1],106,{from:accounts[5]});
//     }).then(function(ret) {
//       assert.equal(ret.logs[0].args.Msg, 'Cannot unregister users within 3 days of the sale!', "Should give an error that users cannot be unregistered close to the sale");
//       return c.getNumRegistered.call();
//     }).then(function(ret) {
//       assert.equal(ret.valueOf(),4,"Four Users should be registered!");
//       return c.getEthRaised.call();
//     }).then(function(ret) {
//       return c.getTokenPurchase.call(accounts[0],{from:accounts[0]});
//     }).then(function(ret) {
//       assert.equal(ret.valueOf(),0, "accounts[0] amount of tokens purchased should be 0 tokens");
//       return c.withdrawTokens(126,{from:accounts[0]});
//     }).then(function(ret) {
//       assert.equal(ret.logs[0].args.Msg, "Sender has no tokens to withdraw!", "Accounts[0] alread withdrew all tokens. should be error");
//       return c.getTokenPurchase.call(accounts[3],{from:accounts[3]});
//     }).then(function(ret) {
//       assert.equal(ret.valueOf(),1.065000000000000213e+23, "accounts[3] amount of tokens purchased should be 1.065000000000000213e+23 tokens");
//       return c.withdrawTokens(126,{from:accounts[3]});
//     }).then(function(ret) {
//       return c.getTokenPurchase.call(accounts[3],{from:accounts[3]});
//     }).then(function(ret) {
//       assert.equal(ret.valueOf(),0,"accounts[3] should have withdrawn all tokens and should now have zero in the contract");
//       return c.withdrawLeftoverWei({from:accounts[4]});
//     }).then(function(ret) {
//       assert.equal(ret.logs[0].args.Msg, "Sender has no extra wei to withdraw!", "should give error message because accounts4 already withdrew wei");
//       return c.withdrawLeftoverWei({from:accounts[3]});
//     }).then(function(ret) {
//       return c.getLeftoverWei.call(accounts[3],{from:accounts[3]});
//     }).then(function(ret) {
//       assert.equal(ret.valueOf(),0, "accounts[4] should have no leftover wei because it was just withdrawn");
//       return c.receivePurchase(126,{from:accounts[2]});
//     }).then(function(ret) {
//       assert.equal(ret.logs[0].args.Msg, 'Invalid Purchase! Check send time and amount of ether.', "should give an error message since no ether was sent");
//       return c.withdrawTokens(127,{from:accounts[2]});
//     }).then(function(ret) {
//       assert.equal(ret.logs[0].args.Msg, 'Sender has no tokens to withdraw!', "should give message that the sender cannot withdraw any tokens");
//       return c.withdrawOwnerEth(127,{from:accounts[5]});
//     }).then(function(ret) {
//       assert.equal(ret.logs[0].args.Msg, 'crowdsale owner has withdrawn all funds', "Should give message that the owner has withdrawn all funds");
//       return c.getTokenPurchase.call(accounts[1],{from:accounts[1]});
//     }).then(function(ret) {
//       assert.equal(ret.valueOf(),3.22806825E24,"accounts[1] should have 3.22806825E24 tokens available to withdraw");
//       return c.withdrawTokens(126,{from:accounts[1]});
//     }).then(function(ret) {
//       return c.getTokenPurchase.call(accounts[1],{from:accounts[1]});
//     }).then(function(ret) {
//       assert.equal(ret.valueOf(),0,"accounts[1] should have withdrawn all tokens and should now have zero in the contract");

//       return c.getEthRaised.call();
//     }).then(function(ret) {
//       assert.equal(ret.valueOf(), 0, "Owner's ether balance in the contract should be zero!");

//       //******************
//       //* TOKEN CONTRACT BALANCE CHECKS
//       //******************
//       return CrowdsaleToken.deployed().then(function(instance) {
//       t = instance;
//       return t.balanceOf.call(accounts[0],{from:accounts[0]});
//     }).then(function(ret) {
//       assert.equal(ret.valueOf(), 3.13008825E24, "accounts0 token balance should be 24040000000000000000000");
//       return t.balanceOf.call(accounts[1],{from:accounts[1]});
//     }).then(function(ret) {
//       assert.equal(ret.valueOf(), 3.2280682500000000213e+24, "accounts1 token balance should be 3.2280682500000000213e+24");
//       return t.balanceOf.call(accounts[2],{from:accounts[2]});
//     }).then(function(ret) {
//       assert.equal(ret.valueOf(), 0, "accounts2 token balance should be 0");
//       return t.balanceOf.call(accounts[3],{from:accounts[3]});
//     }).then(function(ret) {
//       assert.equal(ret.valueOf(), 1.065000000000000213e+23, "accounts3 token balance should be 1.065000000000000213e+23");
//       return t.balanceOf.call(accounts[4],{from:accounts[4]});
//     }).then(function(ret) {
//       assert.equal(ret.valueOf(), 0, "accounts4 token balance should be 0");
//       return t.balanceOf.call(accounts[5],{from:accounts[5]});
//     }).then(function(ret) {
//       assert.equal(ret.valueOf(), 8000000000000000000000000, "accounts5 token balance should be 8000000000000000000000000");
//       return t.balanceOf.call(c.contract.address);
//     }).then(function(ret) {
//       assert.equal(ret.valueOf(), 5.5353435E24,  "crowdsale's token balance should be 5.5353435E24!");
//       return c.getTokenPurchase.call(accounts[5],{from:accounts[5]});
//     }).then(function(ret) {
//       assert.equal(ret.valueOf(),5.5353435E24, "Owners available tokens to withdraw should be 5.5353435E24");
//       return c.withdrawTokens(128,{from:accounts[5]});
//     }).then(function(ret) {
//       return c.getTokenPurchase.call(accounts[5],{from:accounts[5]});
//     }).then(function(ret) {
//       assert.equal(ret.valueOf(),0, "Owner should have withdrawn all the leftover tokens from the sale!");
//       return t.balanceOf.call(accounts[5],{from:accounts[5]});
//     }).then(function(ret) {
//       assert.equal(ret.valueOf(), 1.076767175E25, "accounts5 token balance should be 1.076767175E25");
//       return t.balanceOf.call(c.contract.address);
//     }).then(function(ret) {
//       assert.equal(ret.valueOf(), 0,  "crowdsale's token balance should be 0!");
//       return t.initialSupply();
//     }).then(function(ret){
//       assert.equal(ret.valueOf(), 20000000000000000000000000,  "The token's initial supply was 20M");
//       return t.totalSupply();
//     }).then(function(ret){
//       assert.equal(ret.valueOf(), 1.723232825E25,  "The token's new supply is 1.723232825E25");
//     });
//   });
//   });
// });


