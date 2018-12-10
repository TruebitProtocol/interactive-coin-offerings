# interactive-coin-offerings

The Truebit implementation of the Interactive Coin Offering Protocol by [Teutsch et al.](https://people.cs.uchicago.edu/~teutsch/papers/ico.pdf).
This protocol attempts to solve two key problems in the current method for token salse, an initial coin offering.

1. When the token sale is capped (i.e. a *fixed* number of tokens are sold), users that want to participate may not be able to if they don't attempt to buy in *immediately*. This prevents users from evaluating the sale before deciding to participate, and users sometimes have to take a leap-of-faith due to the fear of missing out.
2. In an *uncapped* sale, it is unclear to any participant what percentage of the entire token supply they will actually hold when the sale is over.

**Proposition.** *No token crowdsale satisfies that both*:

1. *a fixed amount of currency buys at least a fixed fraction of the total tokens, and*
2. *everyone can participate.*
