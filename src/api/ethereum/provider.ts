import { RpcProviderManager } from '~/api/rpcProvider'
import { NETWORK_ID } from './config'
import { getRpcUrls } from './rpcUrls'

export const rpcProvider = new RpcProviderManager(NETWORK_ID, getRpcUrls)
