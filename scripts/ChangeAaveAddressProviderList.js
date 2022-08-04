const { ethers } = require("hardhat");

const INTERFACE = "ILendingPoolAddressesProviderRegistry"
const ADDRESS = "0x52D306e36E3B6B02c153d0266ff0f85d18BCD413"

async function main() {
  const target = await ethers.getContractAt(INTERFACE, ADDRESS)

  console.log(
    "LendingPoolAddressesProviderRegistry.getAddressesProvidersList()",
    await target.getAddressesProvidersList(),
  )

  console.log("Settings new _addressesProvidersList.length")
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

  console.log(
    "LendingPoolAddressesProviderRegistry.getAddressesProvidersList()",
    await target.getAddressesProvidersList(),
  )

  console.log("Settings new _addressesProvidersList[2] to 0xDEADBEEF")
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

  console.log("Settings _addressesProviders[0xDEADBEEF] = 1")
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

  console.log(
    "LendingPoolAddressesProviderRegistry.getAddressesProvidersList()",
    await target.getAddressesProvidersList(),
  )
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  });
