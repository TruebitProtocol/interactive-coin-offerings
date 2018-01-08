import {advanceBlock} from './helpers/advanceToBlock'
import {increaseTimeTo, duration} from './helpers/increaseTime'
import latestTime from './helpers/latestTime'
const { should } = require('./helpers/utils')
const CrowdsaleToken = artifacts.require("CrowdsaleToken");
const InteractiveCrowdsaleTestContract = artifacts.require("InteractiveCrowdsaleTestContract");

//Naive implementation - Ok only for smaller arrays
function insertInOrder(arr, item) {
    let ix = 0;
    if(arr.indexOf(item) > 0){
      return arr;
    }
    while (ix < arr.length) {
        if (item < arr[ix]) { break; }
        ix++;
    }
    arr.splice(ix,0,item);
    return arr;
}

function findPredictedValue(array, item) {
  if(array.length <= 1) {
    return 0; }
  for(var i = 1; i < array.length; i++){
    if(array[i] >= item) {
      return array[i - 1];
    }
  }
  return array[array.length - 1]
}


function getRandomValueInEther(min, max){
  return Math.floor(Math.random() * (max - min) + min) //* Math.pow(10,18)
}

function getNumDigits(num) {
  let _digits = 0;
    while (num != 0) {
      num = Math.floor(num/10);
      _digits++;
    }
    return _digits;
}

function getSubmitOrWithdraw(){
  // set closer to 1 for more withdrawals
  return Math.random() >= 0.35;
}

function generateEmptyMappings(size) {
  var a = [];
  for(var i=0; i < size; i++){
    a.push(0);
  }
  return a;
}

function generateEmptyBoolMappings(size) {
  var a = [];
  for(var i=0; i < size; i++){
    a.push(false);
  }
  return a;
}

function calculateValuationPointer (valueCommitted, valuationsList, valuationSums) {
  let proposedValuation = 0
  let committedAtThisValue = 0;
  // console.log("valuationsList: ", valuationsList);
  // console.log("valuationSums: ", valuationSums);
  // console.log("Value committed: ", proposedValuation);
  let pointer = 0
  for (var i = valuationsList.length - 1; i > 0; i--) {
    // console.log("Current bucket: ", valuationsList[i])
    let sumAtValuation = valuationSums[valuationsList[i]]
    // console.log("Sum at valuation i: ", sumAtValuation);
    committedAtThisValue += sumAtValuation
    // console.log("proposedValuation: ", prop);
    proposedValuation = committedAtThisValue

    if (proposedValuation >= valuationsList[i]) {
      // console.log("Valuation in the middle of value commited and proposed value");
      let proposedCommit = proposedValuation - sumAtValuation
      if (proposedCommit > valuationsList[i]) {
        proposedValuation = proposedCommit
        committedAtThisValue = proposedCommit
      } else {
        proposedValuation = valuationsList[i]
      }
      pointer = valuationsList[i]

      break
    }
  }
  // console.log("Proposed pointer: ", pointer);
  // console.log("");
  return { pointer, proposedValuation, committedAtThisValue }
}

async function simulate(accounts, sale){


  var failedTransactions = [];
  var interactionsSnapshots = [];
  let fetchedValuationPointer = [];
  let calculatedValuationPointer = [];

  //Arrays that smulate mappings from address(position in the accounts array) to any value;
  var pricePurchasedAt, personalCaps =  generateEmptyMappings(accounts.length);

  var initialContribution =  generateEmptyMappings(accounts.length);

  var addressWithdrew = generateEmptyBoolMappings(accounts.length);

  var valuationsList = [0];

  //Sim of UINTs
  var valuationPointer = 0
  var valueCommitted = 0
  var minimumRaise = 0;

  //Sim of mapping that maps uint to uints
  var valuationSums = {};
  var numBidsAtValuation = {};
  var bid;
  var cap;
  var value;
  var valuation;
  var withdrawValue;

  var contribution;

  for(var i = 0; i < accounts.length; i++){
    if ((i+1)%8 == 0) { await increaseTimeTo(latestTime() + duration.weeks(10)); }
    let submit;
    if((i === 0) || (i === 6)){ submit = true; } else { submit = getSubmitOrWithdraw(); }

    if(!submit){
      //console.log('withdraw');
      addressWithdrew[i-1] = true;
      //console.log(addressWithdrew[i-1]);
      // contribution = await sale.getContribution(accounts[i-1]);
      // contribution = contribution.toNumber();
      // console.log(contribution);

      await sale.withdrawBid({from: accounts[i-1]});
      withdrawValue = await sale.getLeftoverWei(accounts[i-1]);
      withdrawValue = withdrawValue.toNumber();
      // contribution = await sale.getContribution(accounts[i-1]);
      // contribution = contribution.toNumber();
      // console.log(contribution);
      valuationSums[cap] -=  withdrawValue;
      numBidsAtValuation[cap]--;
      valueCommitted -= withdrawValue;
    } else {
      withdrawValue = 0;
    }

    var temp = valuationsList.slice();
    value = getRandomValueInEther(10,100);
    cap = getRandomValueInEther(100, 2000);
    var numDigits = getNumDigits(cap);
    cap = Math.floor(cap/Math.pow(10,(numDigits-3)));
    var spot = findPredictedValue(temp, cap);
    personalCaps[i] = cap;
    initialContribution[i] = value;

    let snapshot = {
      "iteraction": i,
      "withdraw previous bid": !submit,
      "withdraw amount": withdrawValue,
      "new bid value": value,
      "cap": cap,
      "proposedSpot": spot,
      "totalCommited": valueCommitted + value,
      "sender address": accounts[i],
    };

      try{
          console.log('cap '+cap);
          console.log('value '+value);
          console.log('spot '+spot);
          bid = await sale.submitBid(cap, spot, {from: accounts[i], value: value});
          valuationsList = insertInOrder(valuationsList, cap);
          valueCommitted += value;

          if(typeof valuationSums[cap] != 'undefined'){
            valuationSums[cap] += value;
          } else {
            valuationSums[cap] = value;
          }

          if(typeof numBidsAtValuation[cap] != 'undefined'){
            numBidsAtValuation[cap] += 1;
          } else {
            numBidsAtValuation[cap] = 1;
          }

          snapshot.succeed = true;

          valuation = await sale.getCurrentBucket();
          fetchedValuationPointer.push(valuation.toNumber());
          //console.log(valuationSums);
          let calcObject = calculateValuationPointer(valueCommitted, valuationsList, valuationSums)
          snapshot.calculatedPointer = calcObject.pointer;
          snapshot.proposedValue = calcObject.proposedValuation;
          snapshot.committedAtThisValue = calcObject.committedAtThisValue;
          calculatedValuationPointer.push(calcObject.pointer);
      }
      catch (e)
      {
        failedTransactions.push(i);
        valuationsList = temp;
        snapshot.succeed = false;
        snapshot.error = e;
      }
    snapshot.valuationsList = valuationsList;
    interactionsSnapshots.push(snapshot);
  }

  //console.log(interactionsSnapshots);

  return {
    "pricePurchasedAt": pricePurchasedAt,
    "personalCaps": personalCaps,
    "valuationsList": valuationsList,
    "valuationSums": valuationSums,
    "numBidsAtValuation": numBidsAtValuation,
    "valueCommitted": valueCommitted,
    "failedTransactions": failedTransactions,
    "interactionsSnapshots": interactionsSnapshots,
    "fetchedValuationPointer": fetchedValuationPointer,
    "calculatedValuationPointer": calculatedValuationPointer,
    "addressWithdrew": addressWithdrew,
    "initialContribution": initialContribution,
  }


}

contract("Moving pointer", (accounts) => {
  let sale, startTime, endWithdrawlTime, endTime, afterEndTime, simulation;

  before(async function () {
    startTime = latestTime() + duration.weeks(30) + duration.hours(4);
    endWithdrawlTime = startTime + duration.weeks(100)
    endTime = startTime + duration.years(2)
    afterEndTime = endTime + duration.seconds(1)

    var purchaseData =[startTime,141,100,
                       startTime + duration.weeks(1),200,100];

    sale = await InteractiveCrowdsaleTestContract.new(accounts[5],
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

  it("Calculates moving pointer correctly", async () => {

    await increaseTimeTo(startTime);
    simulation = await simulate(accounts, sale);
    console.log("fetched Pointers: ", simulation.fetchedValuationPointer);
    console.log("calculated pointers", simulation.calculatedValuationPointer);
    for(var i = 0; i < simulation.fetchedValuationPointer.length; i++){
      assert.equal(simulation.fetchedValuationPointer[i], simulation.calculatedValuationPointer[i], "Results from fetched value differ from calculated value");
    }

  })

  it("Has correct ETH refunds during the sale", async () => {
    var ethBalance

    for(var i = 1; i < accounts.length; i++){
      ethBalance = await sale.getLeftoverWei(accounts[i])
      //console.log(accounts[i]+": "+ethBalance)
      if (simulation.addressWithdrew[i] == false) {
        //console.log("no withdrawal")
        assert.equal(ethBalance.valueOf(),0, "Addresses that didn't withdraw should have a leftover wei balance of zero!")
      } else {
        //console.log("withdrawal")
        assert.isAbove(ethBalance.valueOf(),0,"Addresses that did manual withdraws should have a nonzero leftover wei balance!")
        assert.isBelow(ethBalance.valueOf(),simulation.initialContribution[i],"Addresses that withdrew should has withdrawn less ETH than they contributed!");
      }
    }

  })

  it("Has correct Token purchases after the sale ends", async () => {
    var tokenBalance

    await increaseTimeTo(afterEndTime);



  })
})
