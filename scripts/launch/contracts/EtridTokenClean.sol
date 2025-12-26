// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract EtridToken {
string public constant name = "Etrid";
string public constant symbol = "ETR";
uint8 public constant decimals = 18;
uint256 public totalSupply;
mapping(address => uint256) public balanceOf;
mapping(address => mapping(address => uint256)) public allowance;
event Transfer(address indexed from, address indexed to, uint256 value);
event Approval(address indexed owner, address indexed spender, uint256 value);
constructor() {
uint256 s = 10000000 * 10**decimals;
totalSupply = s;
balanceOf[msg.sender] = s;
emit Transfer(address(0), msg.sender, s);
}
function transfer(address to, uint256 a) external returns (bool) {
require(balanceOf[msg.sender] >= a, "err");
balanceOf[msg.sender] -= a;
balanceOf[to] += a;
emit Transfer(msg.sender, to, a);
return true;
}
function approve(address spender, uint256 a) external returns (bool) {
allowance[msg.sender][spender] = a;
emit Approval(msg.sender, spender, a);
return true;
}
function transferFrom(address from, address to, uint256 a) external returns (bool) {
require(allowance[from][msg.sender] >= a, "err");
require(balanceOf[from] >= a, "err");
allowance[from][msg.sender] -= a;
balanceOf[from] -= a;
balanceOf[to] += a;
emit Transfer(from, to, a);
return true;
}
}
