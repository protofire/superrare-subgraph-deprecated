import { Address } from '@graphprotocol/graph-ts'

import { Account } from '../../generated/schema'

export function getOrCreateAccount(address: Address, persist: boolean = true): Account {
  let accountAddress = address.toHex()
  let account = Account.load(accountAddress)

  if (account == null) {
    account = new Account(accountAddress)
    account.address = address

    if (persist) {
      account.save()
    }
  }

  return account as Account
}
