contract("Moving pointer", (accounts) => {
  let sale, startTime, endWithdrawlTime, endTime, afterEndTime, simulation;

  before(async function () {
    startTime = latestTime() + duration.weeks(7) + duration.hours(4);
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

    for(var i = 0; i < accounts.length; i++){
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
