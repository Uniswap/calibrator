export interface CoinGeckoAssetPlatform {
  id: string
  chain_identifier: number | null
  name: string
  shortname: string
  native_coin_id: string
  image: {
    thumb: string
    small: string
    large: string
  }
}

export interface ChainMapping {
  [chainId: number]: string
}
