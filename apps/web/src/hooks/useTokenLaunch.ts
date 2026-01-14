import { useCallback } from 'react'
import { useTokenStore } from '../stores/tokenStore'
import { useProjectStore } from '../stores/projectStore'
import { useAuth } from './useAuth'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787'

export function useTokenLaunch() {
  const {
    formData,
    launchStatus,
    launchError,
    tokenAddress,
    txHash,
    setLaunchStatus,
    setLaunchError,
    setTokenAddress,
    setTxHash,
    resetForm,
  } = useTokenStore()

  const { currentProject, setCurrentProject } = useProjectStore()
  const { address } = useAuth()

  const deployAndLaunch = useCallback(async () => {
    if (!formData.name || !formData.symbol) {
      setLaunchError('Token name and symbol are required')
      return
    }

    if (!currentProject) {
      setLaunchError('No project selected')
      return
    }

    if (!currentProject.code) {
      setLaunchError('No code to deploy')
      return
    }

    setLaunchStatus('deploying')
    setLaunchError(null)

    try {
      // Step 1: Deploy the app
      const deployResponse = await fetch(`${API_URL}/api/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: currentProject.id,
          code: currentProject.code,
        }),
      })

      if (!deployResponse.ok) {
        const error = await deployResponse.json()
        throw new Error(error.error || 'Failed to deploy app')
      }

      const deployData = await deployResponse.json()
      const deploymentUrl = deployData.url

      // Update project with deployment URL
      setCurrentProject({
        ...currentProject,
        deploymentUrl,
        status: 'deployed',
      })

      // Step 2: Launch token
      setLaunchStatus('launching')

      // For now, use a mock token launch since actual wallet transaction requires
      // the user to be connected and have funds
      // In production, this would call the smart contract

      const tokenResponse = await fetch(`${API_URL}/api/tokens/launch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: currentProject.id,
          name: formData.name,
          symbol: formData.symbol.toUpperCase(),
          imageUri: formData.imageUri || '',
          creatorAddress: address || '0x0000000000000000000000000000000000000000',
        }),
      })

      if (!tokenResponse.ok) {
        const error = await tokenResponse.json()
        throw new Error(error.error || 'Failed to launch token')
      }

      const tokenData = await tokenResponse.json()

      // For demo purposes, generate a mock token address
      // In production, this would come from the contract transaction
      const mockTokenAddress = tokenData.tokenAddress ||
        `0x${Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`

      setTokenAddress(mockTokenAddress)
      setTxHash(tokenData.txHash || '0x...')
      setLaunchStatus('success')

      // Update project with token info
      setCurrentProject({
        ...currentProject,
        deploymentUrl,
        tokenAddress: mockTokenAddress,
        status: 'launched',
      })

      resetForm()

    } catch (error) {
      console.error('Deploy/Launch error:', error)
      setLaunchError(error instanceof Error ? error.message : 'Failed to deploy and launch')
      setLaunchStatus('error')
    }
  }, [
    formData,
    currentProject,
    address,
    setLaunchStatus,
    setLaunchError,
    setTokenAddress,
    setTxHash,
    setCurrentProject,
    resetForm,
  ])

  const deployOnly = useCallback(async () => {
    if (!currentProject) {
      setLaunchError('No project selected')
      return
    }

    if (!currentProject.code) {
      setLaunchError('No code to deploy')
      return
    }

    setLaunchStatus('deploying')
    setLaunchError(null)

    try {
      const deployResponse = await fetch(`${API_URL}/api/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: currentProject.id,
          code: currentProject.code,
        }),
      })

      if (!deployResponse.ok) {
        const error = await deployResponse.json()
        throw new Error(error.error || 'Failed to deploy app')
      }

      const deployData = await deployResponse.json()

      setCurrentProject({
        ...currentProject,
        deploymentUrl: deployData.url,
        status: 'deployed',
      })

      setLaunchStatus('idle')

    } catch (error) {
      console.error('Deploy error:', error)
      setLaunchError(error instanceof Error ? error.message : 'Failed to deploy')
      setLaunchStatus('error')
    }
  }, [currentProject, setLaunchStatus, setLaunchError, setCurrentProject])

  return {
    formData,
    launchStatus,
    launchError,
    tokenAddress,
    txHash,
    deployAndLaunch,
    deployOnly,
    isDeployed: currentProject?.status === 'deployed' || currentProject?.status === 'launched',
    isLaunched: currentProject?.status === 'launched',
  }
}
