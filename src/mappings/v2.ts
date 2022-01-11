import { Bytes, ipfs, json, JSONValueKind, log } from '@graphprotocol/graph-ts'
import { ADDRESS_ZERO } from '@protofire/subgraph-toolkit'

import {
  SuperRareV2,
  AddToWhitelist as AddToWhitelistEvent,
  OwnershipTransferred as OwnershipTransferredEvent,
  RemoveFromWhitelist as RemoveFromWhitelistEvent,
  TokenURIUpdated as TokenURIUpdatedEvent,
  Transfer as TransferEvent,
} from '../../generated/SuperRare/V2/SuperRareV2'

import { Artwork } from '../../generated/schema'

import { getOrCreateAccount } from '../entities/account'
import { getIpfsHash } from '../helpers'

export function handleAddToWhitelist(event: AddToWhitelistEvent): void {
  let account = getOrCreateAccount(event.params._newAddress, false)
  account.isWhitelisted = true

  account.save()
}

export function handleRemoveFromWhitelist(event: RemoveFromWhitelistEvent): void {
  let account = getOrCreateAccount(event.params._removedAddress, false)
  account.isWhitelisted = false

  account.save()
}

export function handleOwnershipTransferred(event: OwnershipTransferredEvent): void {
  log.warning('Transferred ownership, contract: SuperRareV2, new_admin: {}, previous_owner: {}', [
    event.params.newOwner.toHexString(),
    event.params.previousOwner.toHexString(),
  ])
}

export function handleTokenURIUpdated(event: TokenURIUpdatedEvent): void {
  // TODO
}

export function handleTransfer(event: TransferEvent): void {
  let tokenId = event.params.tokenId.toString()
  let isMint = event.params.from.toHexString() == ADDRESS_ZERO
  let isBurn = event.params.to.toHexString() == ADDRESS_ZERO

  if (isMint) {
    let creator = getOrCreateAccount(event.params.to)

    let artwork = new Artwork('V2-' + tokenId)
    artwork.version = 'V2'
    artwork.creator = creator.id
    artwork.created = event.block.timestamp
    artwork.owner = creator.id
    artwork.tokenId = event.params.tokenId

    // Read artwork metadata (v2)
    artwork.descriptorUri = SuperRareV2.bind(event.address).tokenURI(event.params.tokenId)
    artwork = readArtworkMetadata(artwork)

    artwork.save()
  } else {
    let artwork = Artwork.load('V2-' + tokenId)

    if (artwork != null) {
      if (isBurn) {
        artwork.removed = event.block.timestamp
      } else {
        let newOwner = getOrCreateAccount(event.params.to)

        artwork.owner = newOwner.id
        artwork.modified = event.block.timestamp
      }

      artwork.save()
    } else {
      log.warning('Artwork #{} does not exists', [tokenId])
    }
  }
}

function readArtworkMetadata(artwork: Artwork): Artwork {
  let hash = getIpfsHash(artwork.descriptorUri)

  if (hash != null) {
    let raw = ipfs.cat(hash)

    artwork.descriptorHash = hash

    if (raw != null) {
      let value = json.fromBytes(raw as Bytes)

      if (value.kind == JSONValueKind.OBJECT) {
        let data = value.toObject()

        if (data.isSet('name')) {
          artwork.name = data.get('name').toString()
        }

        if (data.isSet('description')) {
          artwork.description = data.get('description').toString()
        }

        if (data.isSet('yearCreated')) {
          artwork.yearCreated = data.get('yearCreated').toString()
        }

        if (data.isSet('createdBy')) {
          artwork.createdBy = data.get('createdBy').toString()
        }

        if (data.isSet('image')) {
          artwork.imageUri = data.get('image').toString()
          artwork.imageHash = getIpfsHash(artwork.imageUri)
        }

        // TODO: media field

        if (data.isSet('tags')) {
          artwork.tags = data
            .get('tags')
            .toArray()
            .map<string>(t => t.toString())
        }
      }
    }
  }

  return artwork
}
