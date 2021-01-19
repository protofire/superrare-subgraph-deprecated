import { Bytes, JSONValueKind, ipfs, json, log } from '@graphprotocol/graph-ts'
import { integer, ADDRESS_ZERO } from '@protofire/subgraph-toolkit'

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
} from '../../generated/SuperRare/V1/SupeRare'

import { Artwork, BidLog, SaleLog } from '../../generated/schema'

import { getOrCreateAccount } from '../entities/account'
import { getIpfsHash } from '../helpers'

export function handleWhitelistCreator(event: WhitelistCreatorEvent): void {
  let account = getOrCreateAccount(event.params._creator, false)
  account.isWhitelisted = true

  account.save()
}

export function handleBid(event: BidEvent): void {
  let tokenId = event.params._tokenId.toString()
  let item = Artwork.load(tokenId)

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
  let item = Artwork.load(event.params._tokenId.toString())

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
    item.salePrice = integer.ZERO

    item.save()
  }
}

export function handleSalePriceSet(event: SalePriceSetEvent): void {
  let item = Artwork.load(event.params._tokenId.toString())

  if (item != null) {
    item.salePrice = event.params._price

    item.save()
  }
}

export function handleTransfer(event: TransferEvent): void {
  let account = getOrCreateAccount(event.params._to)
  let tokenId = event.params._tokenId.toString()

  if (event.params._from.toHex() == ADDRESS_ZERO) {
    // Mint token
    let item = new Artwork('V1-' + tokenId)
    item.version = 'V1'
    item.creator = account.id
    item.owner = item.creator
    item.tokenId = event.params._tokenId
    item.descriptorUri = SupeRare.bind(event.address).tokenURI(event.params._tokenId)

    item.created = event.block.timestamp

    readArtworkMetadata(item as Artwork).save()
  } else {
    let item = Artwork.load(tokenId)

    if (item != null) {
      if (event.params._to.toHex() == ADDRESS_ZERO) {
        // Burn token
        item.removed = event.block.timestamp
      } else {
        // Transfer token
        item.owner = account.id
        item.modified = event.block.timestamp
      }

      item.save()
    } else {
      log.warning('Artwork #{} not exists', [tokenId])
    }
  }
}

export function handleApproval(event: ApprovalEvent): void {
  // TODO
}

function readArtworkMetadata(item: Artwork): Artwork {
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
