## Implementation Details

Base crowdsale Logic: CrowdsaleLib.sol
Interactive ICO-Specific Logic: InteractiveCrowdsaleLib.sol
Contract that implements Library functions:  InteractiveCrowdsaleTestContract.sol

We had to create copies for testing in testrpc, which are prefixed with Test for the libraries and Time for the contract to deal with timestamps.

As you'll see, the valuations are stored in a sorted linked list, using LinkedListLib.sol for the implementation.  There is only one node in the linked list per personal valuation, so even if there are multiple bids at the same personal valuation, there will still be only one entry in the list.

There is also a storage struct that maps addresses to their submitted valuation.  A valuation of zero shows that the address is inactive. Addresses only have inactive and active status
inactive: no bid currently in the sale (not in the array)
active: bid is in the sale  (in the array)

There is also a mapping that maps valuations to an array of addresses that have submitted at that valuation. 

addresses can only submit one bid each.

When submitting a bid, a bidder can only submit personal valuations in a granularity set by the owner of the sale.  We chose this in order to reduce time and space complexity of the linked list implementation.  The bidders also submit a prediction for where to start searching in the list.  We chose this with the intent that the owner will publish the valuations at certain placements in the linked list, like 1/4 of the way through, 1/2 way through, 3/4 of the way through, etc depending on the size of the list.  Bidders chose the search prediction that is closest to their personal Valuation to save time and gas in finding their spot in the list.

After the inputs have been checked, number of tokens purchased are calculated and credited to the buyer, bids are added to the toal valuation, the personal valuation is recorded in the list and mapping for the addresses, and then the automatic withdrawal function is called if it is past the manual withdrawal time period.

When a manual bid withdrawal is called, it reverses all the actions that were taken in the submitBid function.

Automatic removal and refunding of bids is done just like is described in the paper. We add 1 our fraction, q, that is used to do partial refunds, in order to make up for the lack of precision in integer arithmetic.  

bidders cannot withdraw tokens until after the sale

## Still need to add

There are a few additions that still need to be made, most notably two of the changes in the new protocol:

1. Bids which exercise voluntary withdrawals forfeit their "bonus."

We also need to figure out a better way to handle autowithdrawals because that could end up costing average bidders a lot of gas to pay for the computation of finding minimal personal valuations and refunding them.  The only Solutions proposed right now is to have the owner periodically call autoWithdrawal manually so the owner pays for the gas

We want to try to make this implementation as robust, secure, and high performing as possible, so we are open to improvement suggestions on almost any aspect of the implementation.  Please don't hesitate to open an issue or bring it up on the slack channel.

## License and Warranty

Be advised that while we strive to provide professional grade, tested code we cannot guarantee its fitness for your application. This is released under [The MIT License (MIT)](https://github.com/Majoolr/ethereum-libraries/blob/master/LICENSE "MIT License") and as such we will not be held liable for lost funds, etc. Please use your best judgment and note the following:

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

