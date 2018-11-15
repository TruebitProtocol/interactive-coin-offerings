# Interactive Coin Offering


This contract implements the Interactive Coin Offering token sale as described in this paper:
https://people.cs.uchicago.edu/~teutsch/papers/ico.pdf

Implementation details and modifications compared to the paper:
- A fixed amount of tokens is sold. This allows more flexibility for the distribution of the remaining tokens (rounds, team tokens which can be preallocated, non-initial sell of some cryptographic assets).
- The valuation pointer is only moved when the sale is over. This greatly reduces the amount of write operations and code complexity. However, at least one party must make one or multiple calls to finalize the sale.
- Buckets are not used as they are not required and increase code complexity.
- In case multiple bids have the same maximum valuation, the last ones have the priority. This may seem counter-intuitive, but the maximum valuation you give is the value at which bidders are indifferent wether the bid is accepted or not, so it does not matter which bid is accepted. If the new bidders want to get priority over the old ones, they could just set a maxiumum valuation 1 wei higher. The last bids are more likely to have a lower bonus, so for the other bidders accepted, it tends to be statically better to have the last bids having the priority.
- The bid submitter must provide the insertion spot. A search of the insertion spot is still done in the contract just in case the one provided was wrong or other bids were added between when the TX got signed and executed, but giving the search starting point greatly lowers gas consumption.
- Automatic withdrawals are only possible at the end of the sale. This decreases code complexity and possible interactions between different parts of the code.
- We put a full bonus, free withdrawal period at the beginning. This allows everyone to have a chance to place bids with full bonus and avoids clogging the network just after the sale starts. Note that at this moment, no information can be taken for granted as parties can withdraw freely.
- Calling the fallback function while sending ETH places a bid with an infinite maximum valuation. This allows buyers who want to buy no matter the price not need to use a specific interface and just send ETH. Without ETH, a call to the fallback function redeems the bids of the caller.

Security notes:
- If the fallback function of the cutoff bid reverts on send. The cutoff bid contributor will not receive its ETH back. It's the responsibility of contributors using smart contracts to ensure their fallback functions accept transfers.
- The contract assumes that the owner sets appropriate parameters.
- The contract assumes that just after creation, tokens are transfered to the IICO contract and that the owner calls `setToken`.
- The general philosophy is that users are responsible for their actions, interfaces must help them not to make mistakes but it is not the responsibility of the contract to do so.
- There is a O(1) griefing factor attack to this contract. However, the griefing factor is small. A user could make a lot of useless bids to make the `finalize` function cost more gas to finish or require calling it multiple times due to gas limit.
The griefing factor is small as the attacker needs to pay gas for storage write operations while the defender only needs to pay for storage read operations (plus a constant amount of storage write operations per `finalize` call).
- Parties calling the contract first need to call `search` to give the starting value of the search. Again, an attacker could make a lot of bids at high gas price in order in order to make a TX fail (due to the search taking more time than the max gas because the insertion point would have been changed by the new bids). But again this is a O(1) griefing factor with a really low griefing factor.

The LevelWhitelistedIICO contract inherits from the IICO contract. It implements a basic KYC where users individual contributions are capped and a reinforced KYC where contributions are not limited.


# Running tests

`truffle test`

[Truffle](http://truffleframework.com/) should be installed: `npm install -g truffle`

There is also a stress test that handles 5000 bid and takes 20-30 minutes to run and has intermittent failures for no obvious reasons. See [this issue](https://github.com/kleros/openiico-contract/pull/30). In order to run it:

`truffle test test-stress-finalize/StressFinalize.js`


## Vulnerability bounties (up to 50 ETH)

The bounty program includes contracts develloped by the Kleros team and the third-party ones we will rely upon:
- [IICO.sol](https://github.com/kleros/openiico-contract/blob/master/contracts/IICO.sol)
- [LevelWhitelistedIICO.sol](https://github.com/kleros/openiico-contract/blob/master/contracts/LevelWhitelistedIICO.sol)
- The `token` will be a MiniMeToken (with a slight modification of the approve function to follow ERC20 recommendations) as deployed [here](https://etherscan.io/address/0x93ED3FBe21207Ec2E8f2d3c3de6e058Cb73Bc04d#code).
- The `beneficiary` will be a Gnosis MultiSigWallet that you can find [here](https://github.com/gnosis/MultiSigWallet/blob/master/contracts/MultiSigWallet.sol) at commit e1b25e8.

This contract has up to 50 ETH of bug and vulnerabilities bounties attached.
Only vulnerabilities which can lead to real issues are covered by the bug bounty program. As an example, finding an addition which can overflow leading to someone else loosing money is a vulnerability, but simply stating "Not using SafeMath is bad" isn't (in our case, we chose not to use SafeMath, as blocking the finalization would be a more critical failure mode than an overflow).

The vulnerability payout ranges from 1 ETH (display issue which is unlikely to lead to any significant loss of funds) to 50 ETH (vulnerabilities which would make someone likely to steal ETH from the bidders or the beneficiary).

The OWASP matrix is used to determine payouts:
![OWASP](https://raw.githubusercontent.com/kleros/openiico-contract/master/owasp.png "OWASP")

**Critical**: Up to 50 ETH.

**High**: Up to 30 ETH.

**Medium**: Up to 20 ETH.

**Low**: Up to 4 ETH.

**Note**: Up to 1 ETH.

The final vulnerability classification belongs to the Kleros team, but we are obviously committed to ensure a fair remuneration for bounty hunters in order to improve the security of the Ethereum ecosystem.

Vulnerabilities should be disclosed to contact@kleros.io, please includes [BUG BOUNTY] in the subject. Note that only the first party to report a vulnerabilty is eligible to bounties. The last submissions are due for May 14 in order for us not to start the sale would a vulnerability be discovered. Later submission would still be eligible but at a reduce payout.
Please refrain of any action damaging property that you don't own.

Note that this program is not the only security measure which have been put in place (there was a previous bug bounty program with a lower payout, there are exernal audits and reviews by team members and partners).

# Deployment

1. Deploy a token and IICO contract. Note that you can use the same token contract with multiple IICO contracts.
2. Use `Token.mint(IICOContractAddress)` to mint tokens for the IICO contract on the token contract.
3. Use `IICO.setToken(tokenContractAddress)` to set the token on the IICO contract.
4. If you are using the IICO contract with whitelist functionality, you'll also need to call `IICO.setWhitelister(whitelisterAddress)` so the whitelister can add addresses to the whitelist.

You can also run the [deployment script](https://github.com/kleros/openiico/blob/develop/src/scripts/set-up-sale.js) in the repository with [openiico dapp](https://github.com/kleros/openiico)

[Step-by-step tutorial](https://steemit.com/kleros/@genesisre/kleros-interactive-ico-iico-deploy-your-version-and-try-it-out) also available.
