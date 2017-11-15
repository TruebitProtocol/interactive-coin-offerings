const { should } = require('./helpers/utils')
const CrowdsaleToken = artifacts.require("CrowdsaleToken");

contract('CrowdsaleToken', function () {
    let token

    beforeEach(async () => {
      token = await CrowdsaleToken.deployed()
    })

    it('has a name', async () => {
      const name = await token.name()
      name.should.be.equal("Tester Token")
    })

    it('possesses a symbol', async () => {
      const symbol = await token.symbol()
      symbol.should.be.equal("TST")
    })

    it('contains 18 decimals', async () => {
      const decimals = await token.decimals()
      decimals.should.be.bignumber.equal(18)
    })

    it('initializes with a total supply', async () => {
      const totalSupply = await token.totalSupply()
      totalSupply.should.be.bignumber.equal(2e+25)
    })
});
