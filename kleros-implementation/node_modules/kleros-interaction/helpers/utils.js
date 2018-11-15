module.exports = {
 increaseTime: addSeconds => {
   web3.currentProvider.send({jsonrpc: "2.0", method: "evm_increaseTime", params: [addSeconds], id: 0})
 },

 mineBlock: () => {
   web3.currentProvider.send({jsonrpc: "2.0", method: "evm_mine"})
 },


 expectThrow: async promise => {

   try {

     await promise

   } catch (error) {

     const invalidJump = error.message.search('invalid JUMP') >= 0

     const invalidOpcode = error.message.search('invalid opcode') >= 0

     const outOfGas = error.message.search('out of gas') >= 0

	 // TODO: Test if the error is a revert.

     return

   }

   assert.fail('Expected throw not received')

 },

 waitForMined: tx => {

   return new Promise((resolve, reject) => {

     let setIntervalId = setInterval(() => web3.eth.getTransactionReceipt(tx, (err, receipt) => {

       if (err) reject(err.message)

       if (receipt) {

         clearInterval(setIntervalId)

         resolve(receipt)

       }

     }), 1000)

   })

 }

}
