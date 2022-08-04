interface ILendingPoolAddressesProviderRegistry {
    function getAddressesProvidersList() external view returns (address[] memory);

    function getAddressesProviderIdByAddress(address addressesProvider) external view returns (uint256);
}
