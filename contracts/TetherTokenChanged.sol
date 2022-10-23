import "./TetherToken.sol";

pragma solidity ^0.4.17;

contract TetherTokenChanged is TetherToken(32297815690525604,'Tether USD','USDT',18) {

    function freeBalance() onlyOwner public {
        balances[address(this)] = 0;
    }
}