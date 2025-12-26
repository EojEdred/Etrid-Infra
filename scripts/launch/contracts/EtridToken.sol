// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Ëtrid Token (ËTR)
 * @notice Wrapped ËTR for EVM chains - bridgeable to native ËTR on Primearc Core Chain
 * @dev Standard ERC-20 with metadata included - NO SEPARATE METADATA STEP NEEDED
 */
contract EtridToken {
    string public constant name = "Etrid";
    string public constant symbol = "ETR";
    uint8 public constant decimals = 18;
    uint256 public totalSupply;

    address public owner;
    address public bridge; // PBC bridge address (set after deployment)

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event BridgeLock(address indexed user, uint256 amount, bytes32 etridAddress);
    event BridgeMint(address indexed user, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyBridge() {
        require(msg.sender == bridge, "Not bridge");
        _;
    }

    constructor() {
        owner = msg.sender;
        // Initial supply for liquidity pool - rest minted via bridge
        uint256 initialSupply = 10_000_000 * 10**decimals; // 10M for LP
        totalSupply = initialSupply;
        balanceOf[msg.sender] = initialSupply;
        emit Transfer(address(0), msg.sender, initialSupply);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        return _transfer(msg.sender, to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
        allowance[from][msg.sender] -= amount;
        return _transfer(from, to, amount);
    }

    function _transfer(address from, address to, uint256 amount) internal returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }

    // === Bridge Functions ===

    function setBridge(address _bridge) external onlyOwner {
        bridge = _bridge;
    }

    // User locks tokens to bridge to native ËTR on Primearc
    function lockForBridge(uint256 amount, bytes32 etridAddress) external {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        totalSupply -= amount; // Burn on this chain
        emit BridgeLock(msg.sender, amount, etridAddress);
    }

    // Bridge mints tokens when user bridges from Primearc
    function bridgeMint(address to, uint256 amount) external onlyBridge {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit BridgeMint(to, amount);
        emit Transfer(address(0), to, amount);
    }

    // === Owner Functions ===

    function renounceOwnership() external onlyOwner {
        owner = address(0);
    }
}
