Modify Ethereum storage on Hardhat’s mainnet fork
=================================================

Hardhat has a cool feature to manually set the value of any storage slot with `hardhat_setStorageAt`. This feature is useful for whitehats to demonstrate a working exploit on Ethereum mainnet without causing real damage. The ability to fork mainnet is also useful for developers of integration tests: mocks may not take into account all the features of real contracts in the mainnet.

In this tutorial we'll set up a Hardhat mainnet fork and walk through several examples on how to find and modify storage variables in real contracts on the fork. We'll cover different types of variables including simple integers, packed values, mappings and arrays.


Set up a mainnet fork
=====================

First you need to have a Hardhat installed. Check this tutorial on how to install Hardhat and create your first project: 
* https://hardhat.org/tutorial/setting-up-the-environment

In short you need to run:
```sh
mkdir modify-storage-tutorial
cd modify-storage-tutorial

npm init -y
npm install dotenv hardhat @nomiclabs/hardhat-ethers @nomiclabs/hardhat-waffle ethereum-waffle ethers chai
```

In simple mode Hardhat simulates a blockchain locally on your PC. In the fork mode it redirects your requests to a server with a snapshot of a real blockchain. Such an API, for example, is provided by [alchemy.com](https://www.alchemyapi.io) and [quicknode.com](https://quicknode.com).

You can check their tutorials on how to fork Ethereum mainnet:
* https://docs.alchemy.com/alchemy/guides/how-to-fork-ethereum-mainnet
* https://www.quicknode.com/guides/web3-sdks/how-to-fork-ethereum-mainnet-with-hardhat

In this tutorial we'll work with Alchemy API. You must go to https://www.alchemyapi.io, sign up and create a new App in its dashboard. There you will get the API key needed to configure Hardhat. Put it in the `.env` file and don't forget to add the file name to `.gitignore` as this key is a secret:
```sh
echo 'ALCHEMY_API_KEY=XXXXXXXXXX' >> .env
echo '.env' >> .gitignore
```

Now create a `hardhat.config.js`:
```javascript
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
      {
        version: '0.8.9',
      },
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
```

Finally, you can check that everything works:
```sh
npx hardhat test
```


How to modify a single slot variable
====================================


Change Tether USD contract owner address
----------------------------------------

[USDT smartcontract](https://etherscan.io/token/0xdac17f958d2ee523a2206206994597c13d831ec7) has a public variable [`address owner`](https://etherscan.io/token/0xdac17f958d2ee523a2206206994597c13d831ec7#readContract). Let's find its slot and change it to our signer address. Once this is done we'll be able to run some privileged methods like increasing the total supply.

First we add an interface to communicate with USDT. The interface depends on IERC20 so we need to install Openzeppelin contracts:
```sh
npm install @openzeppelin/contracts
```

Now add a `contracts/IUSDT.sol` file:
```solidity
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IUSDT is IERC20 {
    function getOwner() external view returns (address);

    function issue(uint256) external;
}
```

The first guess is that the `owner` variable is at the zero slot. It appears to be true!
```javascript
const { expect } = require("chai");
const { ethers } = require("hardhat");

const usdtAddress = "0xdac17f958d2ee523a2206206994597c13d831ec7"

// the slot must be a hex string stripped of leading zeros! no padding!
// https://ethereum.stackexchange.com/questions/129645/not-able-to-set-storage-slot-on-hardhat-network
const ownerSlot = "0x0"

it("Change USDT ownership", async function () {
    const usdt = await ethers.getContractAt("IUSDT", usdtAddress);
    const [signer] = await ethers.getSigners();
    const signerAddress = await signer.getAddress();

    // storage value must be a 32 bytes long padded with leading zeros hex string
    const value = ethers.utils.hexlify(ethers.utils.zeroPad(signerAddress, 32))

    await ethers.provider.send("hardhat_setStorageAt", [usdtAddress, ownerSlot, value])

    expect(await usdt.getOwner()).to.be.eq(signerAddress)
})
```

You can run the test to see that it is passing:
```sh
npx hardhat test test/ChangeUSDTOwner.js
```


Mint USDT
---------

Now that we're the owner we can mint additional tokens:
```javascript
const { expect } = require("chai");
const { ethers } = require("hardhat");

const usdtAddress = "0xdac17f958d2ee523a2206206994597c13d831ec7"

// the slot must be a hex string stripped of leading zeros! no padding!
// https://ethereum.stackexchange.com/questions/129645/not-able-to-set-storage-slot-on-hardhat-network
const ownerSlot = "0x0"

it("Mint USDT", async function () {
    const usdt = await ethers.getContractAt("IUSDT", usdtAddress);
    const [signer] = await ethers.getSigners();
    const signerAddress = await signer.getAddress();

    // storage value must be a 32 bytes long padded with leading zeros hex string
    const value = ethers.utils.hexlify(ethers.utils.zeroPad(signerAddress, 32))

    await ethers.provider.send("hardhat_setStorageAt", [usdtAddress, ownerSlot, value])

    expect(await usdt.getOwner()).to.be.eq(signerAddress)

    const amount = 1000
    const before = await usdt.totalSupply()
    await usdt.issue(1000)
    const after = await usdt.totalSupply()

    expect(after - before).to.be.eq(amount)
})
```

Run the test to see that it is passing:
```sh
npx hardhat test test/MintUSDT.js
```


How to modify a mapping
=======================


Change USDC user balance
------------------------

Now let's change a user balance in [USDC smartcontract](https://etherscan.io/token/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48).

User balances are stored in a `mapping(address => uint) balanceOf` variable.

We can edit the balance directly via `hardhat_setStorageAt` but first we need to find the correct slot. It is a bit tricky. You can check how mappings are stored in Ethereum storage in https://docs.soliditylang.org/en/latest/internals/layout_in_storage.html#mappings-and-dynamic-arrays

Basically the user balance is stored at the slot:
```
keccak256(padZeros(userAddress) . mappingSlot)
```

In javascript that is:
```javascript
function getSlot(userAddress, mappingSlot) {
    return ethers.utils.solidityKeccak256(
        ["uint256", "uint256"],
        [userAddress, mappingSlot]
    )
}
```

So how do we know `mappingSlot`? That is the slot of the `balanceOf` variable? We'll bruteforce it. You can read an example on how to do it in https://blog.euler.finance/brute-force-storage-layout-discovery-in-erc20-contracts-with-hardhat-7ff9342143ed

We'll bruteforce it with a simple check:
```javascript
async function checkSlot(erc20, mappingSlot) {
    const contractAddress = erc20.address
    const userAddress = ethers.constants.AddressZero

    // the slot must be a hex string stripped of leading zeros! no padding!
    // https://ethereum.stackexchange.com/questions/129645/not-able-to-set-storage-slot-on-hardhat-network
    const balanceSlot = getSlot(userAddress, mappingSlot)

    // storage value must be a 32 bytes long padded with leading zeros hex string
    const value = 0xDEADBEEF
    const storageValue = ethers.utils.hexlify(ethers.utils.zeroPad(value, 32))

    await ethers.provider.send(
        "hardhat_setStorageAt",
        [
            contractAddress,
            balanceSlot,
            storageValue
        ]
    )
    return await erc20.balanceOf(userAddress) == value
}
```

And here is the bruteforce method:
```javascript
async function findBalanceSlot(erc20) {
    const snapshot = await network.provider.send("evm_snapshot")
    for (let slotNumber = 0; slotNumber < 100; slotNumber++) {
        try {
            if (await checkSlot(erc20, slotNumber)) {
                await ethers.provider.send("evm_revert", [snapshot])
                return slotNumber
            }
        } catch { }
        await ethers.provider.send("evm_revert", [snapshot])
    }
}
```

The `try..catch` and `evm_revert` are needed because random storage modification may break the contract and cause an exception.

Now we can write a final test to check that we can find and modify a user balance in USDC contract:
```javascript
it("Change USDC user balance", async function() {
    const usdc = await ethers.getContractAt("IERC20", usdcAddress)
    const [signer] = await ethers.getSigners()
    const signerAddress = await signer.getAddress()
    
    // automatically find mapping slot
    const mappingSlot = await findBalanceSlot(usdc)
    console.log("Found USDC.balanceOf slot: ", mappingSlot)

    // calculate balanceOf[signerAddress] slot
    const signerBalanceSlot = getSlot(signerAddress, mappingSlot)
    
    // set it to the value
    const value = 123456789
    await ethers.provider.send(
        "hardhat_setStorageAt",
        [
            usdc.address,
            signerBalanceSlot,
            ethers.utils.hexlify(ethers.utils.zeroPad(value, 32))
        ]
    )

    // check that the user balance is equal to the expected value
    expect(await usdc.balanceOf(signerAddress)).to.be.eq(value)
})
```

Run the test to see that it is passing:
```sh
npx hardhat test test/ChangeBalanceOf.js 
```


How to modify an array
======================

Modify Aave LendingPoolAddressesProviderRegistry
------------------------------------------------

Let's analyze a simple example on how to find, read and modify a private dynamic `address` array in Aave's [LendingPoolAddressesProviderRegistry](https://docs.aave.com/developers/v/2.0/the-core-protocol/addresses-provider-registry) which is stored at [0x52D306e36E3B6B02c153d0266ff0f85d18BCD413](https://etherscan.io/address/0x52D306e36E3B6B02c153d0266ff0f85d18BCD413#code).

First we need to know how an `address` array is stored in Ethereum state:
1. Visibility modifiers such as `private`, `public` or `internal` do not affect the storage mechanism
2. For an `address` dynamic array the slot `p` of the variable stores the number of elements. For example if there are two elements in the array then the slot `p` stores `0x02`. 
3. The corresponding two elements are stored consequently starting from `keccak256(p)`. 
4. Even though `address` type is 20 bytes long - each array element is still stored in a separate 32 byte slot. So the first element of the array would be at the slot `keccak256(p) + 0` and the second element would be at `keccak256(p) + 1`.

If you are interested in how other types of arrays are stored read the https://docs.soliditylang.org/en/latest/internals/layout_in_storage.html#mappings-and-dynamic-arrays

The code of `LendingPoolAddressesProviderRegistry` is at  https://github.com/aave/protocol-v2/blob/master/contracts/protocol/configuration/LendingPoolAddressesProviderRegistry.sol

We're interested in this part:
```solidity
contract LendingPoolAddressesProviderRegistry is ... {
  mapping(address => uint256) private _addressesProviders;
  address[] private _addressesProvidersList;
  
  ...

  function getAddressesProvidersList() 
    external 
    view 
    returns (address[] memory) 
  { ... }

  function getAddressesProviderIdByAddress(
    address addressesProvider
  ) 
    external 
    view
    returns (uint256)
  { ... }

  ...
```

We want to find the `_addressesProvidersList` slot. First let's check its contents by calling the `getAddressesProvidersList` method. To do that we need to add an `LendingPoolAddressesProviderRegistry` interface to our project:
```
interface ILendingPoolAddressesProviderRegistry {
    function getAddressesProvidersList() external view returns (address[] memory);

    function getAddressesProviderIdByAddress(address addressesProvider) external view returns (uint256);
}
```

Now we can run it in Hardhat's console. Run the console with
```sh
npx hardhat console
```

Then run the javascript code:
```javascript
const target = await ethers.getContractAt("ILendingPoolAddressesProviderRegistry", "0x52D306e36E3B6B02c153d0266ff0f85d18BCD413")

await target.getAddressesProvidersList()
```

Output:
```javascript
[
  '0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5',
  '0xAcc030EF66f9dFEAE9CbB0cd1B25654b82cFA8d5'
]
```

So the array has two elements. Now we know that the slot of the `_addressesProvidersList` stores the value `0x02`. Let's read first few slots with to search for the value:
```javascript
await ethers.provider.getStorageAt(target.address, "0x0")
await ethers.provider.getStorageAt(target.address, "0x1")
await ethers.provider.getStorageAt(target.address, "0x2")
```

Output:
```javascript
0x000000000000000000000000b9062896ec3a615a4e4444df183f0531a77218ae
0x0000000000000000000000000000000000000000000000000000000000000000
0x0000000000000000000000000000000000000000000000000000000000000002
```

Let's analyze the storage layout:
* `slot 0` is used by some variable outside of our scope. 
* `slot 1` is seem to be used by the mapping `_addressesProviders` since the mapping slot doesn't store elements and it is always zero. 
* `slot 2` stores `0x02` and is seem to be the slot for the `_addressesProvidersList`!

Let't change `slot 2` value to `0x03` so the array `_addressesProvidersList` would have 3 elements:
```javascript
await ethers.provider.send(
  "hardhat_setStorageAt", [
    target.address, 

    // the slot must be a hex string stripped of leading zeros! no padding!
    // https://ethereum.stackexchange.com/questions/129645/not-able-to-set-storage-slot-on-hardhat-network
    "0x2",

    // storage value must be a 32 bytes long padded with leading zeros hex string
    ethers.utils.hexlify(ethers.utils.zeroPad(3, 32))
  ]
)
```

Now let's call `getAddressesProvidersList` to see if that worked:
```javascript
await target.getAddressesProvidersList()
```

Output:
```javascript
[
  '0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5',
  '0xAcc030EF66f9dFEAE9CbB0cd1B25654b82cFA8d5',
  '0x0000000000000000000000000000000000000000'
]
```

It worked! Now let's set the third element of the array to `0xDEADBEEF`:
```javascript
const arraySlot = ethers.BigNumber.from(ethers.utils.solidityKeccak256(["uint256"], [2]))
const elementSlot = arraySlot.add(2).toHexString()
const value = "0xDEADBEEF"
const value32 = ethers.utils.hexlify(ethers.utils.zeroPad(value, 32))

await ethers.provider.send(
  "hardhat_setStorageAt", [
    target.address, 
    elementSlot, 
    value32,
  ])
```

Now if we run `getAddressesProvidersList` again we will get:
```javascript
[
  '0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5',
  '0xAcc030EF66f9dFEAE9CbB0cd1B25654b82cFA8d5',
  '0x0000000000000000000000000000000000000000'
]
```

But why? Didn't we change the third element? The reason is in how the `getAddressesProvidersList` works. It only outputs elements of the array if they are stored in the mapping `_addressesProviders`. See the code at [https://github.com/aave/protocol-v2/blob/master/contracts/protocol/configuration/LendingPoolAddressesProviderRegistry.sol#L33](https://github.com/aave/protocol-v2/blob/master/contracts/protocol/configuration/LendingPoolAddressesProviderRegistry.sol#L33):
```solidity
for (uint256 i = 0; i < maxLength; i++) {
  if (_addressesProviders[addressesProvidersList[i]] > 0) {
    activeProviders[i] = addressesProvidersList[i];
  }
}

return activeProviders;
```

Luckily we already know the slot of the `_addressesProviders` mapping: it is `slot 1`. We can directly add our 0xDEADBEEF to the `_addressesProviders`:
```javascript
const deadBeefSlot = ethers.utils.solidityKeccak256(
  ["uint256", "uint256"],
  [0xDEADBEEF, 1]
)
await ethers.provider.send(
  "hardhat_setStorageAt",
  [
    target.address,
    deadBeefSlot,
    ethers.utils.hexlify(ethers.utils.zeroPad(1, 32))
  ]
)
```

Let's check our array again:
```javascript
await target.getAddressesProvidersList()
```

Output:
```javascript
[
  '0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5',
  '0xAcc030EF66f9dFEAE9CbB0cd1B25654b82cFA8d5',
  '0x00000000000000000000000000000000DeaDBeef'
]
```

Great! The value `0x00000000000000000000000000000000DeaDBeef` is stored as the third element of the `_addressesProvidersList` array.

You can run the full script as follows:
```sh
npx hardhat run scripts/ChangeAaveAddressProviderList.js
```


Сonclusion
==========

In this article, we have analyzed several examples of how to find slots for different types of variables in Ethereum state, how to read and modify their values. We looked at how to modify `public address`, `public mapping(address => uint)` and `private address[]` in such contracts as USDT, USDC and Aave. 

This tricks will definitely help you in preparing and demonstrating working exploits. And if you're not a whitehat but a developer then this will definitely help you in writing integration tests. 

Good luck!



Links
=====

* [MixBytes: How to fork mainnet for testing](https://mixbytes.io/blog/how-fork-mainnet-testing)
* [Euler: Brute Force Storage Layout Discovery in ERC20 Contracts With Hardhat](https://blog.euler.finance/brute-force-storage-layout-discovery-in-erc20-contracts-with-hardhat-7ff9342143ed)
* [Hardhat: Setting up the environment](https://hardhat.org/tutorial/setting-up-the-environment)
* [Hardhat: Forking other networks](https://hardhat.org/hardhat-network/docs/guides/forking-other-networks)
* [Alchemy: How to Fork Ethereum Mainnet](https://docs.alchemy.com/alchemy/guides/how-to-fork-ethereum-mainnet)
* [Quicknode: How To Fork Ethereum Mainnet with Hardhat](https://www.quicknode.com/guides/web3-sdks/how-to-fork-ethereum-mainnet-with-hardhat)
* [&laquo;Not able to set storage slot on hardhat network&raquo;](https://ethereum.stackexchange.com/questions/129645/not-able-to-set-storage-slot-on-hardhat-network)
* [Solidity: Layout of State Variables in Storage](https://docs.soliditylang.org/en/latest/internals/layout_in_storage.html)
* [Aave: Addresses Provider Registry](https://docs.aave.com/developers/v/2.0/the-core-protocol/addresses-provider-registry)
