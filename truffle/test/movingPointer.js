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


function getRandomValueInEther(max, min){
  return Math.floor(Math.random() * (max - min) + min) //* Math.pow(10,18)
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
  var pricePurchasedAt, personalCaps =  generateEmptyMappings(accounts.length);;


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

  for(var i = 0; i < accounts.length; i++){
    let submit;
    if((i === 0) || (i === 6)){ submit = true; } else { submit = getSubmitOrWithdraw(); }

    if(!submit){
      console.log('withdraw');
      await sale.withdrawBid({from: accounts[i-1]});
      withdrawValue = await sale.getLeftoverWei(accounts[i-1]);
      withdrawValue = withdrawValue.toNumber();
      valuationSums[cap] -=  withdrawValue;
      numBidsAtValuation[cap]--;
      valueCommitted -= withdrawValue;
    } else {
      withdrawValue = 0;
    }

    var temp = valuationsList.slice();
    value = getRandomValueInEther(1,10);
    cap = getRandomValueInEther(10, 200);
    var spot = findPredictedValue(temp, cap);
    personalCaps[i] = cap;

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
          console.log('cap '+cap);
          console.log('value '+value);
          console.log(valuationSums);
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
  }


}

contract("Moving pointer", (accounts) => {
  let sale, startTime, endWithdrawlTime, endTime, afterEndTime;

  before(async function () {
    startTime = latestTime() + duration.weeks(7) + duration.hours(4);
    endWithdrawlTime = startTime + duration.weeks(100)
    endTime = startTime + duration.years(2)
    afterEndTime = endTime + duration.seconds(1)
    console.log(startTime);
    console.log(latestTime());
    console.log(new Date().valueOf())
    var purchaseData =[startTime,141,100,
                       startTime + duration.weeks(1),200,100];
    console.log(accounts[5],purchaseData,endWithdrawlTime,endTime,CrowdsaleToken.address);
    sale = await InteractiveCrowdsaleTestContract.new(accounts[5], purchaseData, 29000, 10000000, 1700000000, endWithdrawlTime, endTime, 50, CrowdsaleToken.address,{from:accounts[5]})

  })

  it("Calculates moving pointer correctly", async () => {

    await increaseTimeTo(startTime);
    let simulation = await simulate(accounts, sale);
    console.log("fetched Pointers: ", simulation.fetchedValuationPointer);
    console.log("calculated pointers", simulation.calculatedValuationPointer);
    for(var i = 0; i < simulation.fetchedValuationPointer.length; i++){
      assert.equal(simulation.fetchedValuationPointer[i], simulation.calculatedValuationPointer[i], "Results from fetched value differ from calculated value");
    }

  })
})
