const { expect } = require("chai");
const { ethers } = require("hardhat");

const usdcAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"

function getSlot(userAddress, mappingSlot) {
    return ethers.utils.solidityKeccak256(
        ["uint256", "uint256"],
        [userAddress, mappingSlot]
    )
}

async function checkSlot(erc20, mappingSlot) {
    const contractAddress = erc20.address
    const userAddress = ethers.constants.AddressZero

    // slot must be a hex string stripped of leading zeros! no padding!
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

it("Change USDC user balance", async function() {
    const usdc = await ethers.getContractAt("IERC20", usdcAddress)
    const [signer] = await ethers.getSigners()
    const signerAddress = await signer.getAddress()
    
    // find mapping slot
    const mappingSlot = await findBalanceSlot(usdc)
    console.log("Found USDC.balanceOf slot: ", mappingSlot)

    // calculate balanceOf[signerAddress] slot
    const signerBalanceSlot = getSlot(signerAddress, mappingSlot)
    
    // set it to value
    const value = 123456789
    await ethers.provider.send(
        "hardhat_setStorageAt",
        [
            usdc.address,
            signerBalanceSlot,
            ethers.utils.hexlify(ethers.utils.zeroPad(value, 32))
        ]
    )

    expect(await usdc.balanceOf(signerAddress)).to.be.eq(value)
})