See [Jason and Vitalik's paper](https://people.cs.uchicago.edu/~teutsch/papers/ico.pdf) for a detailed description of the protocol.

## How to Use

See [Majoolr's Crowdsale Repo](https://github.com/Majoolr/ethereum-libraries/tree/master/CrowdsaleLib) to see how these libraries are structured.  Essentially, Every crowdsale library uses the CrowdsaleLib.sol and CrowdsaleLib.json files as a base contract.  Then another library, in this case InteractiveCrowdsaleLib.sol, inherits the base and is inherited by a Test contract so the contract can use it's data structure and functions.


## Two different Designs

see thir respective READMEs for more detailed descriptions

### AutoRemoval

This version keeps a record of the valuations and bids submitted throughout the sale in a linked list.  When a bid is removed from the sale, it is deleted from the linked list and the bidder gets their refund throughout the sale


### PostRemoval

(this is the version we are moving forward with most likely

This version constantly calculates what the cutoff is for participation in the sale and keeps a record of which bids are valid and which aren't.  After the sale ends and the valuation is set, everyone withdraws their tokens and that is when the minimal bids are refunded and removed from the sale.  This avoids complex searching and looping that was needed in the previous version when bids were sorted and removed throughout the sale, cutting down on gas price.