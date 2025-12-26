#!/usr/bin/env python3
"""
Solana Base58 Address to H256 Converter
Converts Solana SPL token addresses (Base58) to H256 format for Substrate/Polkadot chains.
"""

import sys
import base58


def base58_to_h256(address: str) -> str:
    """
    Convert a Base58 Solana address to H256 hex format.

    Args:
        address: Base58 encoded Solana address

    Returns:
        H256 hex string with 0x prefix
    """
    try:
        # Decode Base58 to bytes
        decoded = base58.b58decode(address)

        # Solana addresses are 32 bytes
        if len(decoded) != 32:
            raise ValueError(f"Invalid Solana address length: {len(decoded)} bytes (expected 32)")

        # Convert to hex with 0x prefix
        hex_string = "0x" + decoded.hex()

        return hex_string

    except Exception as e:
        raise ValueError(f"Failed to convert address: {e}")


def h256_to_base58(hex_string: str) -> str:
    """
    Convert an H256 hex string back to Base58 Solana address.

    Args:
        hex_string: H256 hex string (with or without 0x prefix)

    Returns:
        Base58 encoded Solana address
    """
    try:
        # Remove 0x prefix if present
        if hex_string.startswith("0x"):
            hex_string = hex_string[2:]

        # Convert hex to bytes
        decoded = bytes.fromhex(hex_string)

        if len(decoded) != 32:
            raise ValueError(f"Invalid H256 length: {len(decoded)} bytes (expected 32)")

        # Encode to Base58
        base58_string = base58.b58encode(decoded).decode('utf-8')

        return base58_string

    except Exception as e:
        raise ValueError(f"Failed to convert hex: {e}")


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 convert-address.py <solana-address>")
        print("       python3 convert-address.py --reverse <h256-hex>")
        print()
        print("Examples:")
        print("  Forward:  python3 convert-address.py CA4ALvCam45ecioBfZ7BzPsXMf3r6BRXZ8iKdGpPmqhp")
        print("  Reverse:  python3 convert-address.py --reverse 0xabcd...")
        sys.exit(1)

    if sys.argv[1] == "--reverse":
        if len(sys.argv) < 3:
            print("Error: Missing H256 hex string for reverse conversion")
            sys.exit(1)

        hex_string = sys.argv[2]
        try:
            base58_address = h256_to_base58(hex_string)
            print(f"H256:         {hex_string}")
            print(f"Base58:       {base58_address}")
        except ValueError as e:
            print(f"Error: {e}")
            sys.exit(1)
    else:
        solana_address = sys.argv[1]
        try:
            h256_hex = base58_to_h256(solana_address)
            print(f"Base58:       {solana_address}")
            print(f"H256:         {h256_hex}")
            print()
            print("Use this H256 value in your Sol-PBC configuration")
        except ValueError as e:
            print(f"Error: {e}")
            sys.exit(1)


if __name__ == "__main__":
    main()
