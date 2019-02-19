const path = require('path');
const HDWalletProvider = require("truffle-hdwallet-provider");
require('dotenv').config();  // Store environment-specific variable from '.env' to process.env
module.exports = {
  contracts_build_directory: path.join(__dirname, './build/contracts'),
  contracts_directory: path.join(__dirname, './contracts'),
  networks: {
    development: {
      host: '127.0.0.1',
      port: 7545,
      network_id: '*'
    },
    rinkeby: {
      provider: () => new HDWalletProvider(process.env.MNENOMIC, "https://rinkeby.infura.io/v3/" + process.env.INFURA_API_KEY),
      network_id: 4
      /* Both gas and gasPrice commented due to error at deploy time: The contract code couldn't be stored, please check your gas amount. */
      //gas: 3000000,
      //gasPrice: 10000000000
    },
  }
};
