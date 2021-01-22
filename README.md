# SuperRare Subgraph

SuperRare is a marketplace to collect and trade unique, single-edition digital artworks. Each artwork is authentically
created by an artist in the network, and tokenized as a crypto-collectible digital item that you can own and trade.

## Compatibility

This subgraph handles data from the following ERC-721 tokens:

* [0x41a322b28d0ff354040e2cbc676f0320d8c8850d](https://etherscan.io/address/0x41a322b28d0ff354040e2cbc676f0320d8c8850d) (
  Legacy)
* [0xb932a70a57673d89f4acffbe830e8ed7f75fb9e0](https://etherscan.io/address/0xb932a70a57673d89f4acffbe830e8ed7f75fb9e0) (
  SuperRare V2)

There is a `version` property on `Artwork` entity to identify which version of the token each artwork corresponds to.
The version was added as ID prefix as well, following the `<version>-<token_id>` pattern (e.i. "V2-4485)".
