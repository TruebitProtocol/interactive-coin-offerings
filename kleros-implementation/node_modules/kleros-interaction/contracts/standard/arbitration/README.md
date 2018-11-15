# Arbitration
Arbitrable.sol and Arbitrator.sol propose a standard for Arbitrable and Arbitrator contracts.

CentralizedArbitrator.sol implement a centralized arbitrator as an Arbitrator contract.

TwoPartyArbitrable.sol is an abstract contract requiring both parties to pay the arbitration fee and refunding the winning one.

ArbitratedTransaction.sol is a contract allowing ether to be put in escrow, allowing the payer to finalize the transaction, the payee to reimburse part of it and the arbitrator to send the funds to the winning party in case of dispute.
