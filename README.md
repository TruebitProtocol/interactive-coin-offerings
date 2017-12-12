# Interactive Crowdsale

See [Jason and Vitalik's paper](https://people.cs.uchicago.edu/~teutsch/papers/ico.pdf) for a detailed description of the protocol.

## Table of Contents

* [Table of Contents](#table-of-contents)
* [Overview](#overview)
* [How To Use](#how-to-use)
* [Implementation Details](#implementation-details)
* [Development](#development)
* [Setting Up](#setting-up)
* [Running Tests](#running-tests)
* [Coding Contribution](#coding-contribution)
* [License and Warranty](#license-and-warranty)

<!-- START doctoc -->

<!-- END doctoc -->

## Overview

The interactive crowdsale protocol allows participants to submit a bid along with a valuation cap. This cap represents the highest value the participant is willing to give the token sale. If the token sale completes above this personal valuation cap, the participant is ejected from the sale and receives their cryptocurrency back.

There are two parts to the sale, prior to a withdrawal lock and after. Prior to the withdrawal lock, participants can withdraw their submitted bid and receive their cryptocurrency back, but they pay a small penalty and this penalty remains in the sale. After the withdrawal lock, all bids are committed for the duration of the sale. It is after the withdrawal lock that participants can officially be ejected from the sale. Since the valuation can move up and down prior to the lock due to deposits and withdrawals, every bid is still 'active' even if a personal cap is exceeded. Once the withdrawal lock kicks in, the value can only move up and if a personal cap is exceeded, the bids at that cap are available for withdrawal without penalty.

This version constantly calculates the cutoff for participation in the sale and keeps a record of which bids are valid and which aren't. After the sale ends, participants can withdraw their tokens if their cap was not exceeded by the total value. If their cap was exceeded, only their bid is available for withdrawal. This avoids complex searching and looping that was needed in the previous version when bids were sorted and removed throughout the sale, cutting down on gas price.

## How to Use

See [Majoolr's Crowdsale Repo](https://github.com/Majoolr/ethereum-libraries/tree/master/CrowdsaleLib) to see how these libraries are structured. Essentially, Every crowdsale library uses the CrowdsaleLib.sol and CrowdsaleLib.json files as a base contract. Then another library, in this case InteractiveCrowdsaleLib.sol, inherits the base and is inherited by a Test contract so the contract can use it's data structure and functions.

## Implementation Details

Base Crowdsale Logic: CrowdsaleLib.sol
Interactive ICO-Specific Logic: InteractiveCrowdsaleLib.sol
Contract that implements Library functions: InteractiveCrowdsaleTestContract.sol

This version of the Interactive Crowdsale is a version that behaves in almost the same way as what is specified in the white paper with some modifications to how bids are "removed" from the sale to significantly cut down on gas costs.

Instead of removing bids automatically after the withdrawal lock, the library utilizes a pointer throughout the sale that indicates which valuation is the cutoff point for being allowed in the sale and only counts bids towards the total valuation that have personal valuations that are greater than the total valuation. When a bid with a greater valuation than the cutoff is submitted, its bid is counted towards the total valuation and the cutoff pointer is moved to a higher valuation if the total valuation increases past the sum of the next group of bids.

When a user manually withdraws their bid, first, the penalty is applied and then if the bid being removed was above the cutoff, there is a chance the total valuation will decrease enough to cause the cutoff to decrease. If the bid being removed is below the cutoff, it is removed without any affect on the cutoff pointer because it already had no effect on the total valuation. Because of the penalty, a removed bid will still have tokens purchased and ETH spent in the sale, but they have removed their bid and valuation, so their personal valuation and bid amount will not be counted towards the calculation of the cutoff pointer.

During what is usually referred to as the AutoWithdrawal period, no bids are actually removed automatically because the bids that would have been removed already do not count toward the total sale valuation. The cutoff pointer still increases though, effectively cancelling bids that had personal valuations lower than any new total valuations. So now it is simply a time for bidders to submit more bids that have personal valuations that are above the current sale valuation without having to worry about manual withdrawals.

After the sale is over, the bidders all have a chance to withdraw. If your bid's personal valuation ended up being lower than the total sale valuation, then you get a complete ETH refund, but no tokens. If your bid's personal valuation was right at the cutoff, then you are given a partial refund of ETH and tokens based on the calculation in section 4.3.3 of the paper that partially refunds buyers to get the total valuation under their personal valuation. If your bid's personal valuation was above the cutoff, then you get your entire bid's purchase in tokens.

As you'll see, the valuations are stored in a sorted linked list, using LinkedListLib.sol for the implementation. There is only one node in the linked list per personal valuation, so even if there are multiple bids at the same personal valuation, there will still be only one entry in the list.

There is also a storage struct that maps addresses to their submitted valuation. If a bidder manually removes their bid, the penalty is a forfeit their "bonus."

Addresses can only submit one bid each.

When submitting a bid, a bidder can only submit personal valuations in multiples of a granularity that the owner sets. The bidders also submit a prediction for where to start searching in the list. We chose this with the intent that the owner will publish the valuations at certain placements in the linked list, like 1/4 of the way through, 1/2 way through, 3/4 of the way through, etc depending on the size of the list. Bidders chose the search prediction that is closest to their personal Valuation to save time and gas in finding their spot in the list.

Bidders cannot withdraw tokens until after the sale.

## Development

**Dependencies**

* `node@8.5.x`
* `truffle@^4.0.1`
* `ethereumjs-testrpc@^6.0.x`

## Setting Up

* Clone this repository.

* Install all [system dependencies](#development).

  * `cd truffle && npm install`

* Compile contract code

  * `node_modules/.bin/truffle compile`

## Running Tests

* `bash run_test.sh`

## Code Contributions

If you see an issue please don't hesitate to dive in. We welcome help in any form and are more than willing to offer our assistance to developers who want to contribute to documentation, code fixes, or even new libraries or functionality! We ask that you follow a few guidelines when making changes to the repo:

1. Create an issue for changes being made.
2. Create a branch named for the issue ie 7-[label].
3. Use keyword `Closes #[issue-number]` when opening a PR.

## License and Warranty

Be advised that while we strive to provide professional grade, tested code we cannot guarantee its fitness for your application. This is released under [The MIT License (MIT)](https://github.com/Majoolr/ethereum-libraries/blob/master/LICENSE "MIT License") and as such we will not be held liable for lost funds, etc. Please use your best judgment and note the following:

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
