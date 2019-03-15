/** @title Interactive Coin Offering
 *  @author Clément Lesaege - <clement@lesaege.com>
 *  This smart contract has undertaken two audits and two bounty programs. However, keep in mind that smart contracts still rely on experimental technology.
 */

pragma solidity ^0.4.23;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

/** @title Interactive Coin Offering
 *  This contract implements the Interactive Coin Offering token sale as described in this paper:
 *  https://people.cs.uchicago.edu/~teutsch/papers/ico.pdf
 *  Implementation details and modifications compared to the paper:
 *  -A fixed amount of tokens is sold. This allows more flexibility for the distribution of the remaining tokens (rounds, team tokens which can be preallocated, non-initial sell of some cryptographic assets).
 *  -The valuation pointer is only moved when the sale is over. This greatly reduces the amount of write operations and code complexity. However, at least one party must make one or multiple calls to finalize the sale.
 *  -Buckets are not used as they are not required and increase code complexity.
 *  -The bid submitter must provide the insertion spot. A search of the insertion spot is still done in the contract just in case the one provided was wrong or other bids were added between when the TX got signed and executed, but giving the search starting point greatly lowers gas consumption.
 *  -Automatic withdrawals are only possible at the end of the sale. This decreases code complexity and possible interactions between different parts of the code.
 *  -We put a full bonus, free withdrawal period at the beginning. This allows everyone to have a chance to place bids with full bonus and avoids clogging the network just after the sale starts. Note that at this moment, no information can be taken for granted as parties can withdraw freely.
 *  -Calling the fallback function while sending ETH places a bid with an infinite maximum valuation. This allows buyers who want to buy no matter the price not need to use a specific interface and just send ETH. Without ETH, a call to the fallback function redeems the bids of the caller.
 */
contract IICO {

    /* *** General *** */
    address public owner;       // The one setting up the contract.
    address public beneficiary; // The address which will get the funds.

    /* *** Bid *** */
    uint constant HEAD = 0;            // Minimum value used for both the maxValuation and bidID of the head of the linked list.
    uint constant TAIL = uint(-1);     // Maximum value used for both the maxValuation and bidID of the tail of the linked list.
    uint constant INFINITY = uint(-2); // A value so high that a bid using it is guaranteed to succeed. Still lower than TAIL to be placed before TAIL.
	uint constant ZERO = 0;
	uint constant MAXMIN = uint(-1) - 1;
    // A bid to buy tokens as long as the personal maximum valuation is not exceeded.
    // Bids are in a sorted doubly linked list.
    // They are sorted in ascending order by (maxValuation,bidID) where bidID is the ID and key of the bid in the mapping.
    // The list contains two artificial bids HEAD and TAIL having respectively the minimum and maximum bidID and maxValuation.
    struct Bid {
        /* ***     Bid Members     *** */
        uint maxValuation;    // Maximum valuation in wei beyond which the contributor prefers refund.
        uint personalMin;
        uint contrib;         // Contribution in wei.
        uint bonus;           // The numerator of the bonus that will be divided by BONUS_DIVISOR.
        address contributor;  // The contributor who placed the bid.
        bool withdrawn;       // True if the bid has been withdrawn.
        bool redeemed;        // True if the ETH or tokens have been redeemed.
		bool active;		  // True if the bid is active given the current valuation.

		uint minBucketID;
		uint maxBucketID;
		uint creationBlock;
		uint pokeOutReward;
		uint pokeInReward;
    }

    struct BidBucket {
        uint valuation;         // the max cap/personal min valuation of bids in this bucket
        address creator;        // The creator of this bucket for gas refund at the end. 
        uint[] maxCapBids;
        uint[] personalMinBids;
    }

    mapping (uint => Bid) public bids; // Map bidID to bid.
    mapping (uint => BidBucket) public buckets; // Map bucketID to bucket.
    mapping (address => uint[]) public contributorBidIDs; // Map contributor to a list of its bid ID.
    uint public lastBidID = 0; // The last bidID not accounting TAIL.

    /* *** Sale parameters *** */
    uint public startTime;                      // When the sale starts.
    uint public endFullBonusTime;               // When the full bonus period ends.
    uint public withdrawalLockTime;             // When the contributors can't withdraw their bids manually anymore.
    uint public endTime;                        // When the sale ends.
    ERC20 public token;                         // The token which is sold.
    uint public tokensForSale;                  // The amount of tokens which will be sold.
    uint public maxBonus;                       // The maximum bonus. Will be normalized by BONUS_DIVISOR. For example for a 20% bonus, _maxBonus must be 0.2 * BONUS_DIVISOR.
    uint public minValuation;
    uint public maxValuation;
    uint public increment;
    uint public numBuckets;
    uint constant BONUS_DIVISOR = 1E9;          // The quantity we need to divide by to normalize the bonus.
	uint public constant pokeReward = 0.01 ether;

    /* *** Finalization variables *** */
    bool public finalized;                 // True when the cutting bid has been found. The following variables are final only after finalized==true.
    uint public cutOffBidID = TAIL;        // The first accepted bid. All bids after it are accepted.
    uint public sumAcceptedContrib;        // The sum of accepted contributions.
    uint public sumAcceptedVirtualContrib; // The sum of virtual (taking into account bonuses) contributions.

    /* *** Events *** */
    event BidSubmitted(address indexed contributor, uint indexed bidID, uint indexed time);
	event PokeIn(address indexed poker, uint indexed bidID);
	event PokeOut(address indexed poker, uint indexed bidID);

    /* *** Modifiers *** */
    modifier onlyOwner{ require(owner == msg.sender); _; }

    /* *** Functions Modifying the state *** */

    /** @dev Constructor. First contract set up (tokens will also need to be transferred to the contract and then setToken needs to be called to finish the setup).
     *  @param _startTime Time the sale will start in seconds since the Unix Epoch.
     *  @param _fullBonusLength Amount of seconds the sale lasts in the full bonus period.
     *  @param _partialWithdrawalLength Amount of seconds the sale lasts in the partial withdrawal period.
     *  @param _withdrawalLockUpLength Amount of seconds the sale lasts in the withdrawal lockup period.
     *  @param _maxBonus The maximum bonus. Will be normalized by BONUS_DIVISOR. For example for a 20% bonus, _maxBonus must be 0.2 * BONUS_DIVISOR.
     *  @param _beneficiary The party which will get the funds of the token sale.
     */
    function IICO(uint _startTime, uint _fullBonusLength, uint _partialWithdrawalLength, uint _withdrawalLockUpLength, uint _maxBonus, address _beneficiary, uint _minValuation, uint _maxValuation, uint _increment) public {
        owner = msg.sender;
        startTime = _startTime;
        endFullBonusTime = startTime + _fullBonusLength;
        withdrawalLockTime = endFullBonusTime + _partialWithdrawalLength;
        endTime = withdrawalLockTime + _withdrawalLockUpLength;
        maxBonus = _maxBonus;
        beneficiary = _beneficiary;
        maxValuation = _maxValuation;
        minValuation = _minValuation;
        increment = _increment;
        numBuckets = ((maxValuation - minValuation) / increment) + 1;
    }

    /** @dev Set the token. Must only be called after the IICO contract receives the tokens to be sold.
     *  @param _token The token to be sold.
     */
    function setToken(ERC20 _token) public onlyOwner {
        require(address(token) == address(0)); // Make sure the token is not already set.

        token = _token;
        tokensForSale = token.balanceOf(this);
    }

    /** @dev Submit a bid. The caller must give the exact position the bid must be inserted into in the list.
     *  In practice, use searchAndBid to avoid the position being incorrect due to a new bid being inserted and changing the position the bid must be inserted at.
     *  @param _maxCap The maximum cap accepted by this bid.
     *  @param _personalMin The minimum sale value for the bid to be included.
     */
    function submitBid(uint _maxCap, uint _personalMin) public payable {
        // Make sure the two valuations are multiples of the increment
        require(now >= startTime && now < endTime); // Check that the bids are still open.
        require(_maxCap >= minValuation && _maxCap > _personalMin);
		require( msg.value > (pokeReward + pokeReward));

        uint minBucketID = (_personalMin - minValuation) / increment;
        uint maxBucketID = (_maxCap - minValuation) / increment; 
		uint realContrib = msg.value - (pokeReward + pokeReward);
	
        ++lastBidID;

		// Create the bid and mark it inactive if the valuation is not within
		// its bounds.
		// TODO : CRITICAL THAT WE SUBTRACT THE POKE REWARD FROM THE AMOUNT SENT WITH THE TRANSACTION
        bids[lastBidID] = Bid({
            maxValuation: _maxCap,
            personalMin: _personalMin,
            contrib: realContrib,
            bonus: bonus(),
            contributor: msg.sender,
            withdrawn: false,
            redeemed: false,
			minBucketID: minBucketID,
			maxBucketID: maxBucketID,
			active: (sumAcceptedContrib+realContrib > _maxCap || sumAcceptedContrib+realContrib < _personalMin) ? false: true,
			creationBlock: block.number,
			pokeOutReward: pokeReward,
			pokeInReward: pokeReward
        });

		Bid storage bid = bids[lastBidID];
		
		// Update the contribution amount with the bonus
		if (bid.active) {
			sumAcceptedContrib += bid.contrib;
			sumAcceptedVirtualContrib += bid.contrib + (bid.contrib * bid.bonus) / BONUS_DIVISOR;
		}

		// Place the bids in the two buckets
        contributorBidIDs[msg.sender].push(lastBidID);
        emit BidSubmitted(msg.sender, lastBidID, now); 
    }


	function bidBufferUint() public constant
		returns (uint[], uint[], uint[], uint[], uint[])
	{
		uint[] memory _maxval = new uint[](lastBidID);
		uint[] memory _pmin = new uint[](lastBidID);
		uint[] memory _contrib = new uint[](lastBidID);
		uint[] memory _bonus = new uint[](lastBidID);
		uint[] memory _block = new uint[](lastBidID);
		uint i = 0;
		
		for (i = 0; i < lastBidID; i++) {
			Bid storage _bid = bids[i];
			_maxval[i] = _bid.maxValuation;
			_pmin[i] = _bid.personalMin;
			_contrib[i] = _bid.contrib;
			_bonus[i] = _bid.bonus;
			_block[i] = _bid.creationBlock;
		}	

		return (_maxval, _pmin, _contrib, _bonus, _block);
	}
		

    /** @dev Withdraw a bid. Can only be called before the end of the withdrawal lock period.
     *  Withdrawing a bid reduces its bonus by 1/3.
     *  For retrieving ETH after an automatic withdrawal, use the redeem function.
     *  @param _bidID The ID of the bid to withdraw.
     */
    function withdraw(uint _bidID) public {
        Bid storage bid = bids[_bidID];
        require(msg.sender == bid.contributor);
        require(now < withdrawalLockTime);
        require(!bid.withdrawn);

        bid.withdrawn = true;
		bid.active = false;
        // Before endFullBonusTime, everything is refunded. Otherwise, an amount decreasing linearly from endFullBonusTime to withdrawalLockTime is refunded.
        uint refund = (now < endFullBonusTime) ? bid.contrib : (bid.contrib * (withdrawalLockTime - now)) / (withdrawalLockTime - endFullBonusTime);
        assert(refund <= bid.contrib); // Make sure that we don't refund more than the contribution. Would a bug arise, we prefer blocking withdrawal than letting someone steal money.
        bid.contrib -= refund;
        bid.bonus = (bid.bonus * 2) / 3; // Reduce the bonus by 1/3.

		/* Only subtract the refund. */
		sumAcceptedContrib -= refund;
		sumAcceptedVirtualContrib -= (bid.bonus * (bid.contrib + 3*refund)) / (2 * BONUS_DIVISOR) + refund;

        msg.sender.transfer(refund);
    }


    /** @dev Finalize by finding the cut-off bid.
     *  Since the amount of bids is not bounded, this function may have to be called multiple times.
     *  The function is O(min(n,_maxIt)) where n is the amount of bids. In total it will perform O(n) computations, possibly in multiple calls.
     *  Each call only has a O(1) storage write operations.
     */
//    function finalize(uint _maxIt) public {
//        require(now >= endTime);
//        require(!finalized);
//
//        // Make local copies of the finalization variables in order to avoid modifying storage in order to save gas.
//        uint localCutOffBidID = cutOffBidID;
//        uint localSumAcceptedContrib = sumAcceptedContrib;
//        uint localSumAcceptedVirtualContrib = sumAcceptedVirtualContrib;
//
//        // Search for the cut-off bid while adding the contributions.
//        for (uint it = 0; it < _maxIt && !finalized; ++it) {
//            Bid storage bid = bids[localCutOffBidID];
//            if (bid.contrib+localSumAcceptedContrib < bid.maxValuation) { // We haven't found the cut-off yet.
//                localSumAcceptedContrib        += bid.contrib;
//                localSumAcceptedVirtualContrib += bid.contrib + (bid.contrib * bid.bonus) / BONUS_DIVISOR;
//                localCutOffBidID = bid.prev; // Go to the previous bid.
//            } else { // We found the cut-off. This bid will be taken partially.
//                finalized = true;
//                uint contribCutOff = bid.maxValuation >= localSumAcceptedContrib ? bid.maxValuation - localSumAcceptedContrib : 0; // The amount of the contribution of the cut-off bid that can stay in the sale without spilling over the maxValuation.
//                contribCutOff = contribCutOff < bid.contrib ? contribCutOff : bid.contrib; // The amount that stays in the sale should not be more than the original contribution. This line is not required but it is added as an extra security measure.
//                bid.contributor.send(bid.contrib-contribCutOff); // Send the non-accepted part. Use send in order to not block if the contributor's fallback reverts.
//                bid.contrib = contribCutOff; // Update the contribution value.
//                localSumAcceptedContrib += bid.contrib;
//                localSumAcceptedVirtualContrib += bid.contrib + (bid.contrib * bid.bonus) / BONUS_DIVISOR;
//                beneficiary.send(localSumAcceptedContrib); // Use send in order to not block if the beneficiary's fallback reverts.
//            }
//        }
//
//        // Update storage.
//        cutOffBidID = localCutOffBidID;
//        sumAcceptedContrib = localSumAcceptedContrib;
//        sumAcceptedVirtualContrib = localSumAcceptedVirtualContrib;
//    }

	function finalize() public {
		require(now >= endTime);
		require(!finalized);

		finalized = true;
		beneficiary.send(sumAcceptedContrib);
	}
    /** @dev Redeem a bid. If the bid is accepted, send the tokens, otherwise refund the ETH.
     *  Note that anyone can call this function, not only the party which made the bid.
     *  @param _bidID ID of the bid to withdraw.
     */
    function redeem(uint _bidID) public {
        Bid storage bid = bids[_bidID];
        Bid storage cutOffBid = bids[cutOffBidID];
        require(finalized);
        require(!bid.redeemed);

        bid.redeemed=true;
        if (bid.maxValuation > cutOffBid.maxValuation || (bid.maxValuation == cutOffBid.maxValuation && _bidID >= cutOffBidID)) // Give tokens if the bid is accepted.
            require(token.transfer(bid.contributor, (tokensForSale * (bid.contrib + (bid.contrib * bid.bonus) / BONUS_DIVISOR)) / sumAcceptedVirtualContrib));
        else                                                                                            // Reimburse ETH otherwise.
            bid.contributor.transfer(bid.contrib);
    }

    /** @dev Fallback. Make a bid if ETH are sent. Redeem all the bids of the contributor otherwise.
     *  Note that the contributor could make this function go out of gas if it has too much bids. This in not a problem as it is still possible to redeem using the redeem function directly.
     *  This allows users to bid and get their tokens back using only send operations.
     */
    function () public payable {
        if (msg.value != 0 && now >= startTime && now < endTime) // Make a bid with an infinite maxValuation if some ETH was sent.
            submitBid(INFINITY, ZERO);
        else if (msg.value == 0 && finalized)                    // Else, redeem all the non redeemed bids if no ETH was sent.
            for (uint i = 0; i < contributorBidIDs[msg.sender].length; ++i)
            {
                if (!bids[contributorBidIDs[msg.sender][i]].redeemed)
                    redeem(contributorBidIDs[msg.sender][i]);
            }
        else                                                     // Otherwise, no actions are possible.
            revert();
    }

	function pokeOut(uint[] _bids) public {
		uint localSumContrib = sumAcceptedContrib;
		uint localVSumContrib = sumAcceptedVirtualContrib;
		uint256 i = 0;
		Bid storage bid = bids[0];		// TEST THIS LINE

		for (i = 0; i < _bids.length; i++) {
			bid = bids[_bids[i]];
			if (bid.active && (localSumContrib < bid.personalMin || localSumContrib > bid.maxValuation)) {
				bid.active = false;
				localSumContrib -= bid.contrib;
				// TODO: subtract from the bonus as well (review how to do that in withdraw)
				if (bid.pokeOutReward != 0) {
					msg.sender.transfer(bid.pokeOutReward);
					bid.pokeOutReward = 0;
				}
				emit PokeOut(msg.sender, _bids[i]);
			}

	
			//if (bid.active) {
			//	if (localSumContrib > bid.maxValuation) {
			//		bid.active = false;
			//		localSumContrib -= bid.contrib;
			//		if (bid.pokeOutReward != 0) {
			//			msg.sender.transfer(bid.pokeOutReward);
			//			bid.pokeOutReward = 0;
			//		}
			//		emit PokeOut(msg.sender, _bids[i]);
			//	}
			//}
		}

		sumAcceptedContrib = localSumContrib;
	}

	function pokeIn(uint[] _bids) public {
		uint localSumContrib = sumAcceptedContrib;
		uint localVSumContrib = sumAcceptedVirtualContrib;
		uint256 i = 0;
		Bid storage bid = bids[0];		// TEST THIS LINE

		for (i = 0; i < _bids.length; i++) {
			bid = bids[_bids[i]];

			if (!bid.active && localSumContrib+bid.contrib >= bid.personalMin 
				&& localSumContrib + bid.contrib <= bid.maxValuation) {
				bid.active = true;
				localSumContrib += bid.contrib;
				if (bid.pokeInReward != 0) {
					msg.sender.transfer(bid.pokeInReward);
					bid.pokeInReward = 0;
				}	
				emit PokeIn(msg.sender, _bids[i]);
			}

			//if (!bid.active) {
			//	if (localSumContrib >= bid.personalMin) {
			//		bid.active = true;
			//		localSumContrib += bid.contrib;
			//		if (bid.pokeInReward != 0) {
			//			msg.sender.transfer(bid.pokeInReward);
			//			bid.pokeInReward = 0;
			//		}
			//		emit PokeIn(msg.sender, _bids[i]);
			//	}
			//}
		}

		sumAcceptedContrib = localSumContrib;
	}

    /* *** View Functions *** */

    /** @dev Return the current bonus. The bonus only changes in 1/BONUS_DIVISOR increments.
     *  @return b The bonus expressed in 1/BONUS_DIVISOR. Will be normalized by BONUS_DIVISOR. For example for a 20% bonus, _maxBonus must be 0.2 * BONUS_DIVISOR.
     */
    function bonus() public view returns(uint b) {
        if (now < endFullBonusTime) // Full bonus.
            return maxBonus;
        else if (now > endTime)     // Assume no bonus after end.
            return 0;
        else                        // Compute the bonus decreasing linearly from endFullBonusTime to endTime.
            return (maxBonus * (endTime - now)) / (endTime - endFullBonusTime);
    }

    /** @dev Get the total contribution of an address.
     *  This can be used for a KYC threshold.
     *  This function is O(n) where n is the amount of bids made by the contributor.
     *  This means that the contributor can make totalContrib(contributor) revert due to an out of gas error on purpose.
     *  @param _contributor The contributor whose contribution will be returned.
     *  @return contribution The total contribution of the contributor.
     */
    function totalContrib(address _contributor) public view returns (uint contribution) {
        for (uint i = 0; i < contributorBidIDs[_contributor].length; ++i)
            contribution += bids[contributorBidIDs[_contributor][i]].contrib;
    }

}
