## Implementation Details

Base Crowdsale Logic: CrowdsaleLib.sol
Interactive ICO-Specific Logic: InteractiveCrowdsaleLib.sol
Contract that implements Library functions:  InteractiveCrowdsaleTestContract.sol

This version of the Interactive Crowdsale is a version that behaves in almost the same way as what is specified in the white paper with some modifications to how bids are "removed" from the sale to significantly cut down on gas costs.

Instead of removing bids automatically after the withdrawal lock, the library utilizes a pointer throughout the sale that indicates which valuation is the cutoff point for being allowed in the sale and only counts bids towards the total valuation that have personal valuations that are greater than the total valuation.  When a bid with a greater valuation than the cutoff is submitted, its bid is counted towards the total valuation and the cutoff pointer is moved to a higher valuation if the total valuation increases past the sum of the next group of bids.  

When a user manually withdraws their bid, first, the penalty is applied and then if the bid being removed was above the cutoff, there is a chance the total valuation will decrease enough to cause the cutoff to decrease.  If the bid being removed is below the cutoff, it is removed without any affect on the cutoff pointer because it already had no effect on the total valuation.  Because of the penalty, a removed bid will still have tokens purchased and ETH spent in the sale, but they have removed their bid and valuation, so their personal valuation and bid amount will not be counted towards the calculation of the cutoff pointer.

During what is usually referred to as the AutoWithdrawal period, no bids are actually removed automatically because the bids that would have been removed already do not count toward the total sale valuation.  The cutoff pointer still increases though, effectively cancelling bids that had personal valuations lower than any new total valuations.  So now it is simply a time for bidders to submit more bids that have personal valuations that are above the current sale valuation without having to worry about manual withdrawals.

After the sale is over, the bidders all have a chance to withdraw.  If your bid's personal valuation ended up being lower than the total sale valuation, then you get a complete ETH refund, but no tokens.  If your bid's personal valuation was right at the cutoff, then you are given a partial refund of ETH and tokens based on the calculation in section 4.3.3 of the paper that partially refunds buyers to get the total valuation under their personal valuation.  If your bid's personal valuation was above the cutoff, then you get your entire bid's purchase in tokens.

As you'll see, the valuations are stored in a sorted linked list, using LinkedListLib.sol for the implementation.  There is only one node in the linked list per personal valuation, so even if there are multiple bids at the same personal valuation, there will still be only one entry in the list.

There is also a storage struct that maps addresses to their submitted valuation.  If a bidder manually removes their bid, the penalty is a forfeit their "bonus."

Addresses can only submit one bid each.

When submitting a bid, a bidder can only submit personal valuations in multiples of a granularity that the owner sets.  The bidders also submit a prediction for where to start searching in the list.  We chose this with the intent that the owner will publish the valuations at certain placements in the linked list, like 1/4 of the way through, 1/2 way through, 3/4 of the way through, etc depending on the size of the list.  Bidders chose the search prediction that is closest to their personal Valuation to save time and gas in finding their spot in the list.

Bidders cannot withdraw tokens until after the sale.

## Still need to add

There are a few additions that still need to be made, most notably two of the changes in the new protocol:

1. Bids which exercise voluntary withdrawals forfeit their "bonus."

I am waiting until we have a more concrete proposal for those before they are added.

We want to try to make this implementation as robust, secure, and high performing as possible, so we are open to improvement suggestions on almost any aspect of the implementation.  Please don't hesitate to open an issue or bring it up on the Slack channel.

## License and Warranty

Be advised that while we strive to provide professional grade, tested code we cannot guarantee its fitness for your application. This is released under [The MIT License (MIT)](https://github.com/Majoolr/ethereum-libraries/blob/master/LICENSE "MIT License") and as such we will not be held liable for lost funds, etc. Please use your best judgment and note the following:

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
