## Implementation Details

Base crowdsale Logic: CrowdsaleLib.sol
Interactive ICO-Specific Logic: InteractiveCrowdsaleLib.sol
Contract that implements Library functions:  InteractiveCrowdsaleTestContract.sol

We had to create copies for testing in testrpc, which are prefixed with Test for the libraries and Time for the contract to deal with timestamps.

This version of the Interactive Crowdsale is a version that behaves in almost the same way as what is specified in the white paper with some major modifications to significantly cut down on gas costs.


As you'll see, the valuations are stored in a sorted linked list, using LinkedListLib.sol for the implementation.  There is only one node in the linked list per personal valuation, so even if there are multiple bids at the same personal valuation, there will still be only one entry in the list.

There is also a storage struct that maps addresses to their submitted valuation.  Addresses have a few different states in the sale
inactive: no bid or ETH currently in the sale
active: bid is in the sale

addresses can only submit one bid each.

When submitting a bid, a bidder can only submit personal valuations in multiples of a granularity that the owner sets.  The bidders also submit a prediction for where to start searching in the list.  We chose this with the intent that the owner will publish the valuations at certain placements in the linked list, like 1/4 of the way through, 1/2 way through, 3/4 of the way through, etc depending on the size of the list.  Bidders chose the search prediction that is closest to their personal Valuation to save time and gas in finding their spot in the list.


bidders cannot withdraw tokens until after the sale

## Still need to add

There are a few additions that still need to be made, most notably two of the changes in the new protocol:

1. Bids which exercise voluntary withdrawals forfeit their "bonus."

I am waiting until we have a more concrete proposal for those before they are added.

We want to try to make this implementation as robust, secure, and high performing as possible, so we are open to improvement suggestions on almost any aspect of the implementation.  Please don't hesitate to open an issue or bring it up on the slack channel.

## License and Warranty

Be advised that while we strive to provide professional grade, tested code we cannot guarantee its fitness for your application. This is released under [The MIT License (MIT)](https://github.com/Majoolr/ethereum-libraries/blob/master/LICENSE "MIT License") and as such we will not be held liable for lost funds, etc. Please use your best judgment and note the following:

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

