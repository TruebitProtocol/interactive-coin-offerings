## Implementation Details

Base Crowdsale Logic: CrowdsaleLib.sol
Interactive ICO-Specific Logic: InteractiveCrowdsaleLib.sol
Contract that implements Library functions:  InteractiveCrowdsaleTestContract.sol

This implementation provides a full implementation with bids declaring personal caps and personal minimums all of the way through the sale. [Click here for a rough diagram.](https://drive.google.com/open?id=1mkQvuEIMgej8b4TMNl1jDRpjdDYUzNEQ)

This version of the Interactive Crowdsale is a version that behaves in almost the same way as what is specified in the white paper with some modifications to how bids are "removed" from the sale to significantly cut down on gas costs.

We're still working out the specifics with Jason, but in consideration of time, here is the rough idea of what is going on here (some parts carried over from PostRemoval README):

Instead of removing bids automatically after the withdrawal lock, the library utilizes a pointer throughout the sale that indicates which valuation is the cutoff point for being allowed in the sale and only counts bids towards the total valuation that have personal valuations that are greater than the total valuation.  When a bid with a greater valuation than the cutoff is submitted, its bid is counted towards the total valuation.  

When a user manually withdraws their bid, first, the penalty is applied and then if the bid being removed was above the cutoff, there is a chance the total valuation will decrease enough to cause the cutoff to decrease.  If the bid being removed is below the cutoff, it is removed without any affect on the cutoff pointer because it already had no effect on the total valuation.  Because of the penalty, a removed bid will still have tokens purchased and ETH spent in the sale.

During what is usually referred to as the AutoWithdrawal period, no bids are actually removed automatically because the bids that would have been removed already do not count toward the total sale valuation.  The cutoff pointer still increases though, effectively canceling bids that had personal valuations lower than any new total valuations.  So now it is simply a time for bidders to submit more bids that have personal valuations that are above the current sale valuation without having to worry about manual withdrawals.

There are now two key periods of time so that we can incorporate personal minimums and implement a version
of the 'poking' method explained in Section 7. Prior to the withdrawal lock, the value pointer is not actually calulated during the bidding period, it sits quiet while the contract stores the bids in buckets that track the impact each bucket has to the pointer... I'll explain below. Once the withdrawal lock kicks in, a `setPointer()` function opens up which allows anyone to call. When called, the contract begins calculating the pointer and the caller receives fees that were collected from each bid (explained in the code). Once all valuations have been considered, the pointer is set. Withdrawals are now disallowed unless your personal cap is below this pointer, allowing the sale value to monotonically increase from here on out.

Once the pointer has been set, it will now move in real time as bids come in. Bids declare personal caps and personal minimums and the pointer will move accordingly. If a personal minimum is sent below the current valuation, the bid is automatically committed to the sale and the pointer is moved up until it reaches equilibrium again. If a personal minimum is sent above the current valuation, then all 'resting' bids will need to be considered in order to see if the new bid along with the other 'resting' bids will push the value above the declared minimum. This is done by a waterfall calculation from the highest bucket down to the declared minimum. If at any point the value exceeds one of these buckets, we've reached a new value.

Here's a rough pseudo code from discussion with Jason as well:

bool pointerSet starts at false and t < withdrawal lock time

bids...bids...bids

Once t > withdrawal lock:

    if(!pointerSet): call a setPointer function that goes through all of the buckets and calculates the value.

    if(pointerSet): sale is monotonically increasing, only accept bids with pc's greater than the pointer

At this time we move the pointer up during the rest of the sale. We know we can only accepts bids with personal caps greater than the value at withdrawal lock.

Who pays for the gas when setting the pointer? As was mentioned before, all bids submit a small fee, fees will be gathered into the personal cap buckets and, as each bucket is pulled into the pointer calculation, the fee is added and distributed to the caller.

What about personal minimums? Since we are calculating the value as a whole, we can include personal minimum buckets. All buckets really serve as thresholds which act on the value pointer. Looking at the calculation workflow it goes like this:

The calculation starts at the highest personal cap declared and waterfalls down

All bids in the highest bucket are added

if totalBids < personal cap move down to the next bucket and add those bids into the total

if totalBids < personal cap move left to the next bucket and add those bids into the total

....

As we're moving down, if we cross a personal minimum bucket, subtract those bids from the total. We know for certain that these bids are in the calculation because every personal minimum must be less than personal cap. This gives every bid a range at which their bid has value, and outside of this range the bid value is 0. Then:

if (!(totalBids < personal cap) we've reached equilibrium, valuePointer == personal cap

Since each bucket acts on the same pointer, we actually don't need to keep separate buckets for caps and minimums. They can exist in the same buckets on the same linked list. How so?

Since each personal cap bucket adds bids to the value and each minimum bucket subtracts bids from the value, we can simply have each bucket contain the cumulative delta for the pointer.

The UI can still calculate value off-chain as the value pointer sits quiet, or provide any metric it desires really. How so? If the UI keeps track of the values in the buckets, although we're not using on-chain resources to set the pointer, the UI can run the algo on its own and still display where the value is as bids come, etc, etc. The `setPointer()` function is merely to finalize this location on-chain.

After the sale is over, the bidders all have a chance to withdraw.  If your bid's personal valuation ended up being lower than the total sale valuation, then you get a complete ETH refund, but no tokens.  If your bid's personal valuation was right at the cutoff, then you are given a partial refund of ETH and tokens based on the calculation in section 4.3.3 of the paper that partially refunds buyers to get the total valuation under their personal valuation.  If your bid's personal valuation was above the cutoff, then you get your entire bid's purchase in tokens.

As you'll see, the valuations are stored in a sorted linked list, using LinkedListLib.sol for the implementation.  There is only one node in the linked list per personal valuation, so even if there are multiple bids at the same personal valuation, there will still be only one entry in the list.

There is also a storage struct that maps addresses to their submitted valuation.  If a bidder manually removes their bid, the penalty is a forfeit their "bonus."

Addresses can only submit one bid each.

When submitting a bid, a bidder can only submit personal valuations in multiples of a granularity that the owner sets.  The bidders also submit a prediction for where to start searching in the list.  We chose this with the intent that the owner will publish the valuations at certain placements in the linked list, like 1/4 of the way through, 1/2 way through, 3/4 of the way through, etc depending on the size of the list.  Bidders chose the search prediction that is closest to their personal Valuation to save time and gas in finding their spot in the list.

Bidders cannot withdraw tokens until after the sale.

## Granularity

Granularity for declared personal caps and personal minimums has been considered in order to properly manage the linked list. Granularity is automatically set that anything beyond the 3 most significant values (MSV) must be zero. So, for example, you can set a personal cap as 1.23 ETH but not 2.131 ETH. You can submit 100 wei as a cap but you cannot submit 1001 wei. You can set 1010 wei or 999 wei but not 9999 wei. Anything beyond the first three MSV must be zero. The UI should contain such restriction. This allows for a reasonably sized linked list, while an arbitrary amount of buckets can be created prior to withdrawal lock, they will all pay fees. After withdrawal lock, when there are no fees, the personal caps must exceed the value and therefore you must submit higher personal caps with only the three MSV as non-zero.

## Still need to add

There are a few additions that still need to be made, most notably two of the changes in the new protocol:

1. Bids which exercise voluntary withdrawals forfeit their "bonus."

We are waiting until we have a more concrete proposal for those before they are added.

## License and Warranty

Be advised that while we strive to provide professional grade, tested code we cannot guarantee its fitness for your application. This is released under [The MIT License (MIT)](https://github.com/Majoolr/ethereum-libraries/blob/master/LICENSE "MIT License") and as such we will not be held liable for lost funds, etc. Please use your best judgment and note the following:

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
