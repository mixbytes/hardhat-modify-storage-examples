require("@nomiclabs/hardhat-waffle");

// read .env file
require('dotenv').config()

// Go to https://www.alchemyapi.io, sign up, create
// a new App in its dashboard, and export its key
// to the environment variable ALCHEMY_API_KEY
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;

if (!ALCHEMY_API_KEY) throw new Error("ALCHEMY_API_KEY required");

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    compilers: [
      // you can add additional versions for your project
      {version: '0.8.9',},
      {version: '0.4.17',}
    ],
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      forking: {
        url: "https://eth-mainnet.alchemyapi.io/v2/" + ALCHEMY_API_KEY,
        
        // specify a block to fork from
        // remove if you want to fork from the last block
        blockNumber: 14674245,
      }
    }
  }
};
