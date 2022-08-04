const { expect } = require("chai");
const { ethers } = require("hardhat");

const usdtAddress = "0xdac17f958d2ee523a2206206994597c13d831ec7"

// slot must be a hex string stripped of leading zeros! no padding!
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