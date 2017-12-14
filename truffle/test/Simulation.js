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
  return Math.floor(Math.random() * (max - min) + min) * Math.pow(10,18)
}

function generateEmptyMappings(size) {
  var a = [];
  for(var i=0; i < size; i++){
    a.push(0);
  }
  return a;
}

async function simulate(accounts, sale){


  var failedTransactions = [];
  var interactionsSnapshots = [];

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
  for(var i = 0; i < accounts.length; i++){
    var temp = valuationsList.slice();
    var value = getRandomValueInEther(1,10);
    var cap = getRandomValueInEther(100, 999);
    var spot = findPredictedValue(temp, cap);
    personalCaps[i] = cap;

    let snapshot = {
      "iteraction": i,
      "value": value,
      "cap": cap,
      "proposedSpot": spot,
      "totalCommited": valueCommitted,
      "valuationsList": temp,
      "sender address": accounts[i],
    };

      try{
          console.log(cap);
          var bid = await sale.submitBid(cap, spot, {from: accounts[i], value: 100000000});
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
      }
      catch (e)
      {
        failedTransactions.push(i);
        valuationsList = temp;
        snapshot.succeed = false;
      }

    // var proposedValuation = valueCommitted - valuationSums[valuationsList[valuationPointer]];
    //
    // var currentBucket = valuationsList[valuationPointer + 1];
    // console.log("proposedCommit", proposedCommit);
    // console.log("currentBucket", currentBucket);
    // while(currentBucket < proposedCommit){
    //
    // };
    interactionsSnapshots.push(snapshot);
  }

  return {
    "pricePurchasedAt": pricePurchasedAt,
    "personalCaps": personalCaps,
    "valuationsList": valuationsList,
    "valuationSums": valuationSums,
    "numBidsAtValuation": numBidsAtValuation,
    "valueCommitted": valueCommitted,
    "failedTransactions": failedTransactions,
    "interactionsSnapshots": interactionsSnapshots,
  }


}

contract("Simulation", (accounts) => {
  let sale, startTime, endWithdrawlTime, endTime, afterEndTime;

  before(async function () {
    startTime = latestTime() + duration.weeks(7)
    endWithdrawlTime = startTime + duration.weeks(100)
    endTime =  startTime + duration.years(2)
    afterEndTime = endTime + duration.seconds(1)

    var purchaseData =[startTime,141,100,
                       startTime + duration.weeks(1),200,100];
    sale = await InteractiveCrowdsaleTestContract.new(accounts[5], purchaseData, 29000, 10000000, 1700000000, endWithdrawlTime, endTime, 50, CrowdsaleToken.address,{from:accounts[5]})

  })

  it("passes", async () => {
    await increaseTimeTo(startTime);
    let simulation = await simulate(accounts, sale);
    //Check sale state here
    assert.isTrue(false);
  })
})
