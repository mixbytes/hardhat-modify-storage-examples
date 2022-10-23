const { expect } = require("chai");
const { ethers } = require("hardhat");

const usdtAddress = "0xdac17f958d2ee523a2206206994597c13d831ec7"

it("NewCode", async function () {

    // We need two files:
    // - TetherToken.sol - the original USDT
    // - TetherTokenChanger.sol - the new version with the new function added
    // 
    // Goal - to write a new bytecode to the original USDT address
    //
    // Step:
    // 1) deploy new version of USDT
    // 2) take its bytecode from the chain
    // 3) use "hardhat_setCode" to set the updated version of bytecode to the original USDT contract
    // 4) check that new function works

    // get the owner
    const usdtToGetOwner = await ethers.getContractAt("IUSDT", usdtAddress);
    const owner = await usdtToGetOwner.getOwner();
    await hre.network.provider.request({method: "hardhat_impersonateAccount", params: [owner]});

    // change the code
    const USDTnew = await ethers.getContractFactory("TetherTokenChanged");
    const usdtWithNewCode = await USDTnew.deploy(); // we deploy a new contract to extract the bytecode further
    const newUSDTCode = await hre.network.provider.send("eth_getCode", [usdtWithNewCode.address,]); // we take the new Bytecode
    await network.provider.send("hardhat_setCode", [usdtAddress, newUSDTCode]);
    const usdtOldWithNewCode = await USDTnew.attach(usdtAddress);

    // test results
    expect(await usdtOldWithNewCode.balanceOf(usdtAddress)).to.not.be.eq(0); // usdt has its balance
    await usdtOldWithNewCode.connect(await ethers.getSigner(owner))['freeBalance()'](); // run new function
    expect(await usdtOldWithNewCode.balanceOf(usdtAddress)).to.be.eq(0); // check that usdt contract has its balance empty

})