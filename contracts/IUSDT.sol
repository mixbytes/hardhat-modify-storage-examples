import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IUSDT is IERC20 {
    function getOwner() external view returns (address);

    function issue(uint256) external;
}
