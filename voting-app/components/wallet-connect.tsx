"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { useWeb3 } from "@/contexts/web3-context"
import { Wallet, LogOut, AlertCircle, Loader2 } from "lucide-react"

export function WalletConnect() {
  const { account, isConnected, isConnecting, chainId, connectWallet, disconnectWallet } = useWeb3()

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const getChainName = (chainId: number) => {
    switch (chainId) {
      case 1:
        return "Ethereum"
      case 5:
        return "Goerli"
      case 11155111:
        return "Sepolia"
      case 8009:
        return "Zama Devnet"
      default:
        return `Chain ${chainId}`
    }
  }

  if (!isConnected) {
    return (
      <Card className="bg-slate-800/40 backdrop-blur-xl border-slate-700/50">
        <CardContent className="p-6 text-center">
          <div className="p-4 bg-slate-700/30 rounded-full w-fit mx-auto mb-4">
            <Wallet className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="text-white text-lg font-semibold mb-2">Connect Your Wallet</h3>
          <p className="text-slate-400 mb-6">Connect your wallet to create proposals and vote on the blockchain</p>
          <Button
            onClick={connectWallet}
            disabled={isConnecting}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium px-8 py-3 rounded-lg transition-all duration-200"
          >
            {isConnecting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Wallet className="h-4 w-4 mr-2" />
                Connect Wallet
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <div className="text-sm">
          <div className="text-white font-medium">{formatAddress(account!)}</div>
          <div className="text-slate-400 text-xs">{chainId && getChainName(chainId)}</div>
        </div>
      </div>

      {chainId !== 11155111 && (
        <Badge variant="destructive" className="text-xs">
          <AlertCircle className="h-3 w-3 mr-1" />
          Wrong Network
        </Badge>
      )}

      <Button
        onClick={disconnectWallet}
        variant="ghost"
        size="sm"
        className="text-slate-400 hover:text-white hover:bg-slate-700/50"
      >
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  )
}
