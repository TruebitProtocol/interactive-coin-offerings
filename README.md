# interactive-coin-offerings

The Truebit implementation of the Interactive Coin Offering Protocol by [Teutsch et al.](https://people.cs.uchicago.edu/~teutsch/papers/ico.pdf).
This protocol attempts to solve two key problems in the current method for token sales, and initial coin offering.

1. When the token sale is capped (i.e. a *fixed* number of tokens are sold), users that want to participate may not be able to if they don't attempt to buy in *immediately*. This prevents users from evaluating the sale before deciding to participate, and users sometimes have to take a leap-of-faith due to the fear of missing out.
2. In an *uncapped* sale, it is unclear to any participant what percentage of the entire token supply they will actually hold when the sale is over.

**Proposition.** *No token crowdsale satisfies that both*:

1. *a fixed amount of currency buys at least a fixed fraction of the total tokens, and*
2. *everyone can participate.*


The proof-of-concept implementation from this work can be found [here](poc-implementation/).

## Directory Structure
This repository build on top of previous attempts to implement the IICO protoccol by [Kleros](https://github.com/kleros/openiico-contract) and [Modular](https://github.com/Modular-Network/ethereum-libraries/tree/master/CrowdsaleLib/IICOLib). 
The two respective project are included as directories in this project as well (for ease of access).

## Truebit Implementation
The Truebit implementation is located in `./truebit-implementation`.
The basic differences between the Truebit implementation and the Kleros impementation is the use of buckets instead of a linked list structure.

Briefly, the Kleros implementation consists of a linked list of all bids made. Each list nodes is a bid that specifies a maximum cap, *the maximum valuation of the sale that this bid is willing to accept*.
If the the sale valuation exceeds this vaue, all bids whose max. cap is below it are considered *inactive*.
At the end of the sale a *cutoff bid* is identified. 
The cutoff bid is the *first* bid found whose maximum cap falls below the valuation of the sale.
The bid is pruned and all bids that lie ahead of the *cutoff bid* in the list is accepted (and redeemable) and all behind it are no longer valid.

