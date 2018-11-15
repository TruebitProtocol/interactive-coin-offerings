 /**
 *  @title Mini Me Token ERC20
 *  Overwrite the MiniMeToken to make it follow ERC20 recommendation.
 *  This is required because the base token reverts when approve is used with the non zero value while allowed is non zero (which not recommended by the standard, see https://github.com/ethereum/EIPs/blob/master/EIPS/eip-20-token-standard.md).
 *  @author Clément Lesaege - <clement@lesaege.com>
 *  Bug Bounties: This code hasn't undertaken a bug bounty program yet.
 */

pragma solidity ^0.4.18;

import "minimetoken/contracts/MiniMeToken.sol";

contract MiniMeTokenERC20 is MiniMeToken {

    /** @notice Constructor to create a MiniMeTokenERC20
     *  @param _tokenFactory The address of the MiniMeTokenFactory contract that will
     *   create the Clone token contracts, the token factory needs to be deployed first
     *  @param _parentToken Address of the parent token, set to 0x0 if it is a new token
     *  @param _parentSnapShotBlock Block of the parent token that will determine the
     *   initial distribution of the clone token, set to 0 if it is a new token
     *  @param _tokenName Name of the new token
     *  @param _decimalUnits Number of decimals of the new token
     *  @param _tokenSymbol Token Symbol for the new token
     *  @param _transfersEnabled If true, tokens will be able to be transferred
     */
    function MiniMeTokenERC20(
        address _tokenFactory,
        address _parentToken,
        uint _parentSnapShotBlock,
        string _tokenName,
        uint8 _decimalUnits,
        string _tokenSymbol,
        bool _transfersEnabled
    )  MiniMeToken(
        _tokenFactory,
        _parentToken,
        _parentSnapShotBlock,
        _tokenName,
        _decimalUnits,
        _tokenSymbol,
        _transfersEnabled
    ) public {}
    
    /** @notice `msg.sender` approves `_spender` to spend `_amount` tokens on its behalf.
      * This is a ERC20 compliant version.
      * @param _spender The address of the account able to transfer the tokens
      * @param _amount The amount of tokens to be approved for transfer
      * @return True if the approval was successful
      */
    function approve(address _spender, uint256 _amount) public returns (bool success) {
        require(transfersEnabled);
        // Alerts the token controller of the approve function call
        if (isContract(controller)) {
            require(TokenController(controller).onApprove(msg.sender, _spender, _amount));
        }

        allowed[msg.sender][_spender] = _amount;
        Approval(msg.sender, _spender, _amount);
        return true;
    }
}
