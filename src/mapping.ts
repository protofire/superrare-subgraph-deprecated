import { Address, BigInt, Bytes, JSONValueKind, ipfs, json, log } from '@graphprotocol/graph-ts'

import {
  SupeRare,
  WhitelistCreator as WhitelistCreatorEvent,
  Bid as BidEvent,
  AcceptBid as AcceptBidEvent,
  CancelBid as CancelBidEvent,
  Sold as SoldEvent,
  SalePriceSet as SalePriceSetEvent,
  Transfer as TransferEvent,
  Approval as ApprovalEvent,
} from '../generated/SupeRare/SupeRare'

import { Account, BidLog, Item, SaleLog } from '../generated/schema'

const GENESIS_ADDRESS = '0x0000000000000000000000000000000000000000'

export function handleWhitelistCreator(event: WhitelistCreatorEvent): void {
  let account = getOrCreateAccount(event.params._creator, false)
  account.isCreator = true

  account.save()
}

export function handleBid(event: BidEvent): void {
  let tokenId = event.params._tokenId.toString()
  let item = Item.load(tokenId)

  if (item != null) {
    let bidder = getOrCreateAccount(event.params._bidder)

    // Persist bid log
    let bid = new BidLog(tokenId + '-' + bidder.id + '-' + event.block.timestamp.toString())
    bid.amount = event.params._amount
    bid.bidder = bidder.id
    bid.item = item.id
    bid.timestamp = event.block.timestamp

    bid.save()

    // Update current bidder
    item.currentBid = bid.id

    item.save()
  }
}

export function handleAcceptBid(event: AcceptBidEvent): void {
  // TODO
}

export function handleCancelBid(event: CancelBidEvent): void {
  // TODO
}

export function handleSold(event: SoldEvent): void {
  let tokenId = event.params._tokenId.toString()
  let item = Item.load(event.params._tokenId.toString())

  if (item != null) {
    let buyer = getOrCreateAccount(event.params._buyer)
    let seller = getOrCreateAccount(event.params._seller)

    // Persist sale log
    let sale = new SaleLog(tokenId + '-' + buyer.id + '-' + seller.id + '-' + event.block.timestamp.toString())
    sale.amount = event.params._amount
    sale.buyer = buyer.id
    sale.item = item.id
    sale.seller = seller.id
    sale.timestamp = event.block.timestamp

    sale.save()

    // Transfer item to buyer
    item.owner = buyer.id
    item.salePrice = BigInt.fromI32(0)

    item.save()
  }
}

export function handleSalePriceSet(event: SalePriceSetEvent): void {
  let item = Item.load(event.params._tokenId.toString())

  if (item != null) {
    item.salePrice = event.params._price

    item.save()
  }
}

export function handleTransfer(event: TransferEvent): void {
  let account = getOrCreateAccount(event.params._to)
  let tokenId = event.params._tokenId.toString()

  if (event.params._from.toHex() == GENESIS_ADDRESS) {
    // Mint token
    let item = new Item(tokenId)
    item.creator = account.id
    item.owner = item.creator
    item.tokenId = event.params._tokenId
    item.descriptorUri = SupeRare.bind(event.address).tokenURI(event.params._tokenId)

    item.created = event.block.timestamp

    readItemData(item as Item).save()
  } else {
    let item = Item.load(tokenId)

    if (item != null) {
      if (event.params._to.toHex() == GENESIS_ADDRESS) {
        // Burn token
        item.removed = event.block.timestamp
      } else {
        // Transfer token
        item.owner = account.id
        item.modified = event.block.timestamp
      }

      item.save()
    } else {
      log.warning('Item #{} not exists', [tokenId])
    }
  }
}

export function handleApproval(event: ApprovalEvent): void {
  // TODO
}

function getOrCreateAccount(address: Address, persist: boolean = true): Account {
  let accountAddress = address.toHex()
  let account = Account.load(accountAddress)

  if (account == null) {
    account = new Account(accountAddress)
    account.address = address
  }

  if (persist) {
    account.save()
  }

  return account as Account
}

function readItemData(item: Item): Item {
  let hash = getIpfsHash(item.descriptorUri)

  if (hash != null) {
    let raw = ipfs.cat(hash)

    item.descriptorHash = hash

    if (raw != null) {
      let value = json.fromBytes(raw as Bytes)

      if (value.kind == JSONValueKind.OBJECT) {
        let data = value.toObject()

        if (data.isSet('name')) {
          item.name = data.get('name').toString()
        }

        if (data.isSet('description')) {
          item.description = data.get('description').toString()
        }

        if (data.isSet('yearCreated')) {
          item.yearCreated = data.get('yearCreated').toString()
        }

        if (data.isSet('createdBy')) {
          item.createdBy = data.get('createdBy').toString()
        }

        if (data.isSet('image')) {
          item.imageUri = data.get('image').toString()
          item.imageHash = getIpfsHash(item.imageUri)
        }

        if (data.isSet('tags')) {
          item.tags = data
            .get('tags')
            .toArray()
            .map<string>(t => t.toString())
        }
      }
    }
  }

  return item
}

function getIpfsHash(uri: string | null): string | null {
  if (uri != null) {
    let hash = uri.split('/').pop()

    if (hash != null && hash.startsWith('Qm')) {
      return hash
    }
  }

  return null
}
